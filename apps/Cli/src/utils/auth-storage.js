/**
 * Auth Storage - Secure token and user data storage
 * Handles encryption and persistence of authentication data
 */

const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { GENT_DIR, AUTH_FILE } = require('./constants');

// Simple encryption key (in production, use environment variable or OS keychain)
const ENCRYPTION_KEY = 'gent-cli-secret-key-v1';
const FORMAT_PREFIX = 'v2';
const KEY = crypto.createHash('sha256').update(ENCRYPTION_KEY).digest();

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
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', KEY, iv);
    const encrypted = Buffer.concat([cipher.update(jsonString, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return [FORMAT_PREFIX, iv.toString('base64'), tag.toString('base64'), encrypted.toString('base64')].join(':');
}

/**
 * Decrypt data
 * @param {string} encryptedData - Encrypted string
 * @returns {Object} Decrypted data
 */
function decrypt(encryptedData) {
    if (!encryptedData.startsWith(`${FORMAT_PREFIX}:`)) return decryptLegacy(encryptedData);
    const [, ivText, tagText, encryptedText] = encryptedData.split(':');
    if (!ivText || !tagText || !encryptedText) throw new Error('Invalid auth data');
    const decipher = crypto.createDecipheriv('aes-256-gcm', KEY, Buffer.from(ivText, 'base64'));
    decipher.setAuthTag(Buffer.from(tagText, 'base64'));
    const decrypted = Buffer.concat([
        decipher.update(Buffer.from(encryptedText, 'base64')),
        decipher.final()
    ]);
    return JSON.parse(decrypted.toString('utf8'));
}

// CryptoJS passphrase encryption used the OpenSSL "Salted__" AES-256-CBC
// format. Keep read compatibility so upgrading does not sign users out.
function decryptLegacy(encryptedData) {
    const payload = Buffer.from(encryptedData, 'base64');
    if (payload.length < 16 || payload.subarray(0, 8).toString('ascii') !== 'Salted__') {
        throw new Error('Invalid legacy auth data');
    }
    const salt = payload.subarray(8, 16);
    const password = Buffer.from(ENCRYPTION_KEY, 'utf8');
    let derived = Buffer.alloc(0);
    let block = Buffer.alloc(0);
    while (derived.length < 48) {
        block = crypto.createHash('md5').update(Buffer.concat([block, password, salt])).digest();
        derived = Buffer.concat([derived, block]);
    }
    const decipher = crypto.createDecipheriv('aes-256-cbc', derived.subarray(0, 32), derived.subarray(32, 48));
    const decrypted = Buffer.concat([decipher.update(payload.subarray(16)), decipher.final()]);
    return JSON.parse(decrypted.toString('utf8'));
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
        await fs.writeFile(authFilePath, JSON.stringify({ data: encryptedData }), { encoding: 'utf8', mode: 0o600 });
        await fs.chmod(authFilePath, 0o600);
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
    await fs.writeFile(authFilePath, JSON.stringify({ data: encryptedData }), { encoding: 'utf8', mode: 0o600 });
    await fs.chmod(authFilePath, 0o600);
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
