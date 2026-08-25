import ax from "axios";
import { toast } from "sonner";
import API_ROUTES from "../constant/api-routes";
import { AUTH_PATH } from "../routes/path";
import {
  clearAuthStorage,
  getStoredRefreshToken,
  getStoredToken,
  storeAuthTokens,
} from "./auth-session";

// Base API URL
export const API_BASE_URL = "https://gent-api.onrender.com/api";
const FULL_API_URL = `${API_BASE_URL}`;

const getToken = getStoredToken;

let isRedirectingToLogin = false;

const handleSessionExpired = () => {
  if (typeof window === "undefined" || isRedirectingToLogin) return;
  isRedirectingToLogin = true;
  try {
    clearAuthStorage();
    if (!window.location.pathname.startsWith(AUTH_PATH.LOGIN)) {
      window.location.replace(AUTH_PATH.LOGIN);
    }
  } catch (error) {
    console.error("Error during session expiry redirect:", error);
  }
};

// Create axios instance
const axios = ax.create({
  baseURL: FULL_API_URL,
  headers: {
    Accept: "application/json",
    "Content-Type": "application/json",
  },
  withCredentials: false,
  timeout: 60000, // Render free tier can be slow on cold start
  maxRedirects: 0, // Prevent redirects that might change POST to GET
});

// Request interceptor
axios.interceptors.request.use(
  (config) => {
    if (typeof window !== "undefined") {
      config.headers = config.headers || {};
      const requestUrl = String(config.url ?? "").toLowerCase();
      const isAuthEndpoint =
        requestUrl.includes("/auth/login") ||
        requestUrl.includes("/auth/register") ||
        requestUrl.includes("/auth/signup") ||
        requestUrl.includes("/auth/token/refresh");

      if (!isAuthEndpoint) {
        const token = getToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
      }

      const language = localStorage.getItem("i18nextLng") || "en";
      config.headers["Accept-Language"] = language;

      // Remove any cache-control headers that might cause CORS issues
      delete config.headers["Cache-Control"];
      delete config.headers["Pragma"];
      delete config.headers["Expires"];

      console.log(
        `[${new Date().toISOString()}] ${config.method?.toUpperCase()} ${config.url}`,
      );
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// Response interceptor
axios.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (typeof window === "undefined") return Promise.reject(error);

    const originalRequest = error.config;

    // Handle redirects (3xx status codes)
    if (
      error?.response?.status &&
      error.response.status >= 300 &&
      error.response.status < 400
    ) {
      const redirectUrl = error.response.headers.location;
      if (redirectUrl) {
        // Follow the redirect with the same method
        return axios({
          ...originalRequest,
          url: redirectUrl,
        });
      }
    }

    // Handle 401 (Unauthorized) and try refresh token
    if (error?.response?.status === 401 && !originalRequest._retry) {
      const requestUrl = String(originalRequest?.url ?? "");
      const isAuthEndpoint =
        requestUrl.includes("auth/login") ||
        requestUrl.includes("auth/register") ||
        requestUrl.includes("auth/signup") ||
        requestUrl.includes("auth/token/refresh") ||
        requestUrl.includes("auth/logout");

      if (isAuthEndpoint) {
        return Promise.reject(error);
      }

      originalRequest._retry = true;
      const refreshToken = getStoredRefreshToken();

      if (!refreshToken) {
        handleSessionExpired();
        return Promise.reject(error);
      }

      try {
        const { data } = await axios.post(API_ROUTES.AUTH.REFRESH_TOKEN, {
          refresh: refreshToken,
          refreshToken,
        });

        const newToken =
          data?.token ?? data?.access ?? data?.access_token ?? null;
        const newRefresh =
          data?.refreshToken ??
          data?.refresh ??
          data?.refresh_token ??
          refreshToken;

        if (newToken) {
          storeAuthTokens(String(newToken), String(newRefresh));
          if (data.permissions) {
            localStorage.setItem(
              "permissions",
              JSON.stringify(data.permissions),
            );
          }

          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return axios(originalRequest);
        }
        throw new Error("Invalid refresh token response");
      } catch (refreshError) {
        handleSessionExpired();
        return Promise.reject(refreshError);
      }
    }

    // For other errors, just reject without showing toast
    return Promise.reject(error);
  },
);

export default axios;
