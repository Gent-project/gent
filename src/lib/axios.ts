import ax from "axios";
import { toast } from "sonner";
import API_ROUTES from "../constant/api-routes";
import { AUTH_PATH } from "../routes/path";

// Base API URL
export const API_BASE_URL = "https://gent-api.onrender.com/api";
const FULL_API_URL = `${API_BASE_URL}`;

// Helper: get token safely
const getToken = (): string | null => {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem("token");
  } catch (error) {
    console.error("Error accessing localStorage:", error);
    return null;
  }
};

// Helper: logout user
const handleLogout = () => {
  if (typeof window !== "undefined") {
    try {
      localStorage.clear();
      window.location.href = AUTH_PATH.LOGIN;
    } catch (error) {
      console.error("Error during logout:", error);
      window.location.href = AUTH_PATH.LOGIN;
    }
  }
};

// Create axios instance
const axios = ax.create({
  baseURL: FULL_API_URL,
  headers: {
    Accept: "application/json",
    "Content-Type": "application/json",
  },
  withCredentials: true,
  timeout: 10000, // 10s
});

// Request interceptor
axios.interceptors.request.use(
  (config) => {
    if (typeof window !== "undefined") {
      const token = getToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }

      const language = localStorage.getItem("i18nextLng") || "en";
      config.headers["Accept-Language"] = language;

      // Cache control
      config.headers["Cache-Control"] = "no-cache";
      config.headers["Pragma"] = "no-cache";
      config.headers["Expires"] = "0";

      console.log(`[${new Date().toISOString()}] ${config.method?.toUpperCase()} ${config.url}`);
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor
axios.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (typeof window === "undefined") return Promise.reject(error);

    const originalRequest = error.config;

    // Handle non-401 errors
    if (error?.response?.status !== 401) {
      const errorMessage = error?.response?.data?.errorMessage || "An error occurred";
      toast.error(errorMessage);
      return Promise.reject(error);
    }

    // Handle 401 (Unauthorized) and try refresh token
    if (!originalRequest._retry) {
      originalRequest._retry = true;
      const refreshToken = localStorage.getItem("refreshToken");

      if (!refreshToken) {
        handleLogout();
        return Promise.reject(error);
      }

      try {
        const { data } = await axios.post(API_ROUTES.AUTH.REFRESH_TOKEN, { refreshToken });
        if (data.token && data.refreshToken) {
          localStorage.setItem("token", data.token);
          localStorage.setItem("refreshToken", data.refreshToken);
          if (data.permissions) localStorage.setItem("permissions", JSON.stringify(data.permissions));

          originalRequest.headers.Authorization = `Bearer ${data.token}`;
          return axios(originalRequest);
        } else throw new Error("Invalid refresh token response");
      } catch (refreshError) {
        handleLogout();
        return Promise.reject(refreshError);
      }
    }

    handleLogout();
    return Promise.reject(error);
  }
);

export default axios;
