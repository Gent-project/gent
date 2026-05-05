/**
 * API Client - HTTP client for making authenticated API requests
 * Handles request/response interceptors and automatic token refresh
 */

const axios = require('axios');
const { API_BASE_URL } = require('./constants');
const authStorage = require('./auth-storage');

// Create axios instance with base configuration
const apiClient = axios.create({
    baseURL: API_BASE_URL,
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

// Request interceptor - Add JWT token to headers
apiClient.interceptors.request.use(
    async (config) => {
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

                // Call refresh endpoint
                const response = await axios.post(
                    `${API_BASE_URL}/api/auth/token/refresh/`,
                    { refresh: refreshToken }
                );

                const { access } = response.data;

                // Update stored access token
                await authStorage.updateAccessToken(access);

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
    apiClient // Export raw client if needed
};
