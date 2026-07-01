/**
 * Auth Service - Authentication operations
 * Handles registration, login, logout, and token management
 */

const apiClient = require('../utils/api-client');
const authStorage = require('../utils/auth-storage');
const { API_ENDPOINTS } = require('../utils/constants');

/**
 * Register a new user
 * @param {string} email - User email
 * @param {string} password - User password
 * @param {string} passwordConfirm - Password confirmation
 * @param {string} firstName - User first name
 * @param {string} lastName - User last name
 * @returns {Promise<Object>} User data
 */
async function register(email, password, passwordConfirm, firstName, lastName) {
    try {
        const payload = {
            email,
            password,
            password_confirm: passwordConfirm,
            first_name: firstName,
            last_name: lastName
        };

        const response = await apiClient.post(API_ENDPOINTS.REGISTER, payload);

        // API returns { message, user: {...}, tokens: { access, refresh } }
        const { tokens, user } = response;

        // Store tokens
        await authStorage.saveTokens(tokens.access, tokens.refresh, user);

        return user;
    } catch (error) {
        if (error.response?.data) {
            // Extract API error messages
            const errors = error.response.data;
            const errorMessages = [];

            for (const [field, messages] of Object.entries(errors)) {
                if (Array.isArray(messages)) {
                    errorMessages.push(...messages);
                } else {
                    errorMessages.push(messages);
                }
            }

            throw new Error(errorMessages.join(', '));
        }

        throw new Error(error.message || 'Registration failed');
    }
}

/**
 * Login user
 * @param {string} email - User email
 * @param {string} password - User password
 * @returns {Promise<Object>} User data
 */
async function login(email, password) {
    try {
        const payload = { email, password };

        const response = await apiClient.post(API_ENDPOINTS.LOGIN, payload);

        // API returns { message, user: {...}, tokens: { access, refresh } }
        const { tokens, user } = response;

        // Store tokens
        await authStorage.saveTokens(tokens.access, tokens.refresh, user);

        return user;
    } catch (error) {
        if (error.response?.status === 401) {
            throw new Error('Invalid email or password');
        }

        if (error.response?.data) {
            const errors = error.response.data;
            const errorMessages = [];

            for (const [field, messages] of Object.entries(errors)) {
                if (Array.isArray(messages)) {
                    errorMessages.push(...messages);
                } else {
                    errorMessages.push(messages);
                }
            }

            throw new Error(errorMessages.join(', '));
        }

        throw new Error(error.message || 'Login failed');
    }
}

/**
 * Logout user
 * @returns {Promise<void>}
 */
async function logout() {
    try {
        const refreshToken = await authStorage.getRefreshToken();

        if (refreshToken) {
            // Call logout endpoint to blacklist refresh token
            await apiClient.post(API_ENDPOINTS.LOGOUT, {
                refresh: refreshToken
            });
        }
    } catch (error) {
        // Even if API call fails, clear local auth
        console.error('Logout API call failed:', error.message);
    } finally {
        // Always clear local authentication
        await authStorage.clearAuth();
    }
}

/**
 * Refresh access token
 * @returns {Promise<string>} New access token
 */
async function refreshToken() {
    try {
        const refreshToken = await authStorage.getRefreshToken();

        if (!refreshToken) {
            throw new Error('No refresh token available');
        }

        const response = await apiClient.post(API_ENDPOINTS.REFRESH, {
            refresh: refreshToken
        });

        // Backend rotates refresh tokens, so persist the new one too.
        const { access, refresh } = response;
        await authStorage.updateTokens(access, refresh);

        return access;
    } catch (error) {
        // If refresh fails, clear auth
        await authStorage.clearAuth();
        throw new Error('Session expired. Please login again.');
    }
}

/**
 * Get current user profile
 * @returns {Promise<Object>} User profile data
 */
async function getProfile() {
    try {
        const response = await apiClient.get(API_ENDPOINTS.PROFILE);
        return response;
    } catch (error) {
        if (error.response?.status === 401) {
            throw new Error('Not authenticated. Please login first.');
        }

        throw new Error(error.message || 'Failed to fetch profile');
    }
}

module.exports = {
    register,
    login,
    logout,
    refreshToken,
    getProfile
};
