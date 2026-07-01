/**
 * API Client - HTTP client for making authenticated API requests
 * Handles request/response interceptors and automatic token refresh
 */

const axios = require('axios');
const { API_BASE_URL } = require('./constants');
const userConfig = require('./user-config');
const authStorage = require('./auth-storage');

// Resolved once per process so commands see a stable URL. CLI runs are short,
// so we don't bother with cache invalidation — the next invocation re-reads.
let _resolvedBaseUrl = null;
async function resolveBaseUrl() {
    if (_resolvedBaseUrl) return _resolvedBaseUrl;
    try {
        const { value } = await userConfig.getResolved('api.base_url');
        _resolvedBaseUrl = value || API_BASE_URL;
    } catch {
        _resolvedBaseUrl = API_BASE_URL;
    }
    return _resolvedBaseUrl;
}

// Create axios instance with base configuration. baseURL is set per-request
// by the interceptor below so config/env changes take effect immediately.
const apiClient = axios.create({
    headers: {
        'Content-Type': 'application/json'
    },
    timeout: 60000 // 60 seconds
});

// Track if we're currently refreshing token to avoid multiple refresh requests
let isRefreshing = false;
let failedRequestsQueue = [];

/**
 * Process queued requests after token refresh
 * @param {Error|null} error - Error if refresh failed
 * @param {string|null} token - New access token if refresh succeeded
 */
function processQueue(error, token = null) {
    failedRequestsQueue.forEach(promise => {
        if (error) {
            promise.reject(error);
        } else {
            promise.resolve(token);
        }
    });

    failedRequestsQueue = [];
}

// Request interceptor - Resolve base URL + add JWT token to headers
apiClient.interceptors.request.use(
    async (config) => {
        if (!config.baseURL) {
            config.baseURL = await resolveBaseUrl();
        }

        const token = await authStorage.getAccessToken();

        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }

        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Response interceptor - Handle 401 errors and refresh token
apiClient.interceptors.response.use(
    (response) => {
        return response;
    },
    async (error) => {
        const originalRequest = error.config;

        // If error is 401 and we haven't tried to refresh yet
        if (error.response?.status === 401 && !originalRequest._retry) {
            if (isRefreshing) {
                // If already refreshing, queue this request
                return new Promise((resolve, reject) => {
                    failedRequestsQueue.push({ resolve, reject });
                })
                    .then(token => {
                        originalRequest.headers.Authorization = `Bearer ${token}`;
                        return apiClient(originalRequest);
                    })
                    .catch(err => {
                        return Promise.reject(err);
                    });
            }

            originalRequest._retry = true;
            isRefreshing = true;

            try {
                const refreshToken = await authStorage.getRefreshToken();

                if (!refreshToken) {
                    // No refresh token, user needs to login again
                    await authStorage.clearAuth();
                    throw new Error('Session expired. Please login again.');
                }

                // Call refresh endpoint (raw axios — bypasses our interceptor
                // intentionally so a 401 here doesn't loop back into refresh).
                const baseUrl = await resolveBaseUrl();
                const response = await axios.post(
                    `${baseUrl}/api/auth/token/refresh/`,
                    { refresh: refreshToken }
                );

                // Backend rotates refresh tokens (ROTATE_REFRESH_TOKENS +
                // BLACKLIST_AFTER_ROTATION); persist the new refresh or the
                // next silent refresh sends a blacklisted token and 401s.
                const { access, refresh } = response.data;
                await authStorage.updateTokens(access, refresh);

                // Update authorization header
                originalRequest.headers.Authorization = `Bearer ${access}`;

                // Process queued requests
                processQueue(null, access);

                isRefreshing = false;

                // Retry original request
                return apiClient(originalRequest);

            } catch (refreshError) {
                // Refresh failed, clear auth and reject
                processQueue(refreshError, null);
                isRefreshing = false;
                await authStorage.clearAuth();
                return Promise.reject(refreshError);
            }
        }

        return Promise.reject(error);
    }
);

/**
 * Make GET request
 * @param {string} url - Endpoint URL
 * @param {Object} config - Axios config
 * @returns {Promise} Response data
 */
async function get(url, config = {}) {
    const response = await apiClient.get(url, config);
    return response.data;
}

/**
 * Make POST request
 * @param {string} url - Endpoint URL
 * @param {Object} data - Request payload
 * @param {Object} config - Axios config
 * @returns {Promise} Response data
 */
async function post(url, data = {}, config = {}) {
    const response = await apiClient.post(url, data, config);
    return response.data;
}

/**
 * Make PUT request
 * @param {string} url - Endpoint URL
 * @param {Object} data - Request payload
 * @param {Object} config - Axios config
 * @returns {Promise} Response data
 */
async function put(url, data = {}, config = {}) {
    const response = await apiClient.put(url, data, config);
    return response.data;
}

/**
 * Make DELETE request
 * @param {string} url - Endpoint URL
 * @param {Object} config - Axios config
 * @returns {Promise} Response data
 */
async function del(url, config = {}) {
    const response = await apiClient.delete(url, config);
    return response.data;
}

/**
 * Make PATCH request
 * @param {string} url - Endpoint URL
 * @param {Object} data - Request payload
 * @param {Object} config - Axios config
 * @returns {Promise} Response data
 */
async function patch(url, data = {}, config = {}) {
    const response = await apiClient.patch(url, data, config);
    return response.data;
}

module.exports = {
    get,
    post,
    put,
    delete: del,
    patch,
    apiClient, // Export raw client if needed
    resolveBaseUrl,
};
