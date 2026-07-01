/**
 * Auth Storage - Secure token and user data storage
 * Handles encryption and persistence of authentication data
 */

const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const CryptoJS = require('crypto-js');
const { GENT_DIR, AUTH_FILE } = require('./constants');

// Simple encryption key (in production, use environment variable or OS keychain)
const ENCRYPTION_KEY = 'gent-cli-secret-key-v1';

/**
 * Get the auth file path
 * @returns {string} Path to auth.json file
 */
function getAuthFilePath() {
    return path.join(os.homedir(), GENT_DIR, AUTH_FILE);
}

/**
 * Encrypt data
 * @param {Object} data - Data to encrypt
 * @returns {string} Encrypted string
 */
function encrypt(data) {
    const jsonString = JSON.stringify(data);
    return CryptoJS.AES.encrypt(jsonString, ENCRYPTION_KEY).toString();
}

/**
 * Decrypt data
 * @param {string} encryptedData - Encrypted string
 * @returns {Object} Decrypted data
 */
function decrypt(encryptedData) {
    const bytes = CryptoJS.AES.decrypt(encryptedData, ENCRYPTION_KEY);
    const decryptedString = bytes.toString(CryptoJS.enc.Utf8);
    return JSON.parse(decryptedString);
}

/**
 * Save authentication tokens and user data
 * @param {string} accessToken - JWT access token
 * @param {string} refreshToken - JWT refresh token
 * @param {Object} user - User profile data
 */
async function saveTokens(accessToken, refreshToken, user) {
    const authFilePath = getAuthFilePath();
    const gentDir = path.join(os.homedir(), GENT_DIR);

    const authData = {
        accessToken,
        refreshToken,
        user,
        timestamp: new Date().toISOString()
    };

    const encryptedData = encrypt(authData);

    try {
        // Ensure .gent directory exists
        await fs.mkdir(gentDir, { recursive: true });
        await fs.writeFile(authFilePath, JSON.stringify({ data: encryptedData }), 'utf8');
    } catch (error) {
        throw new Error(`Failed to save authentication data: ${error.message}`);
    }
}

/**
 * Read authentication data from file
 * @returns {Object|null} Decrypted auth data or null if not found
 */
async function readAuthData() {
    const authFilePath = getAuthFilePath();

    try {
        const fileContent = await fs.readFile(authFilePath, 'utf8');
        const { data } = JSON.parse(fileContent);
        return decrypt(data);
    } catch (error) {
        // File doesn't exist or is corrupted
        return null;
    }
}

/**
 * Get access token
 * @returns {string|null} Access token or null
 */
async function getAccessToken() {
    const authData = await readAuthData();
    return authData ? authData.accessToken : null;
}

/**
 * Get refresh token
 * @returns {string|null} Refresh token or null
 */
async function getRefreshToken() {
    const authData = await readAuthData();
    return authData ? authData.refreshToken : null;
}

/**
 * Get user profile
 * @returns {Object|null} User data or null
 */
async function getUser() {
    const authData = await readAuthData();
    return authData ? authData.user : null;
}

/**
 * Check if user is authenticated
 * @returns {boolean} True if authenticated
 */
async function isAuthenticated() {
    const authData = await readAuthData();
    return authData !== null && authData.accessToken !== null;
}

/**
 * Clear authentication data
 */
async function clearAuth() {
    const authFilePath = getAuthFilePath();

    try {
        await fs.unlink(authFilePath);
    } catch (error) {
        // File doesn't exist, nothing to clear
    }
}

/**
 * Update stored tokens after a refresh. The backend rotates refresh tokens
 * (ROTATE_REFRESH_TOKENS + BLACKLIST_AFTER_ROTATION), so the new refresh token
 * MUST be persisted or the next refresh sends a blacklisted token and 401s.
 * @param {string} newAccessToken - New access token
 * @param {string} [newRefreshToken] - New (rotated) refresh token, if returned
 */
async function updateTokens(newAccessToken, newRefreshToken) {
    const authData = await readAuthData();

    if (!authData) {
        throw new Error('No authentication data found');
    }

    authData.accessToken = newAccessToken;
    if (newRefreshToken) {
        authData.refreshToken = newRefreshToken;
    }
    authData.timestamp = new Date().toISOString();

    const authFilePath = getAuthFilePath();
    const gentDir = path.join(os.homedir(), GENT_DIR);
    const encryptedData = encrypt(authData);

    // Ensure .gent directory exists
    await fs.mkdir(gentDir, { recursive: true });
    await fs.writeFile(authFilePath, JSON.stringify({ data: encryptedData }), 'utf8');
}

// Back-compat alias: same as updateTokens with no rotated refresh.
async function updateAccessToken(newAccessToken) {
    return updateTokens(newAccessToken);
}

module.exports = {
    saveTokens,
    getAccessToken,
    getRefreshToken,
    getUser,
    isAuthenticated,
    clearAuth,
    updateAccessToken,
    updateTokens
};
