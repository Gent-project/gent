/**
 * `api` — the single axios instance the whole app uses to talk to gent-api.
 *
 * Responsibilities:
 *   1. Inject the JWT access token on every request (if one exists).
 *   2. On a 401, try the refresh token once; if that fails too, log the user
 *      out and bounce them to /auth/login.
 *
 * The token store is small (`localStorage`) but isolated behind helpers so we
 * could swap it for cookies/IndexedDB later without touching call sites.
 */
import ax, { AxiosError, InternalAxiosRequestConfig } from "axios";
import { PATHS } from "@/lib/paths";
import { isBrowser } from "@/lib/utils";
import type { AuthTokens, User } from "@/types/api";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_GENT_API_URL ?? "https://gent-api.onrender.com/api";

const STORAGE = {
  access: "gent.access",
  refresh: "gent.refresh",
  user: "gent.user",
} as const;

/* ----------- Token storage helpers ----------- */

export const tokenStore = {
  getAccess(): string | null {
    if (!isBrowser()) return null;
    try {
      return localStorage.getItem(STORAGE.access);
    } catch {
      return null;
    }
  },
  getRefresh(): string | null {
    if (!isBrowser()) return null;
    try {
      return localStorage.getItem(STORAGE.refresh);
    } catch {
      return null;
    }
  },
  getUser(): User | null {
    if (!isBrowser()) return null;
    try {
      const raw = localStorage.getItem(STORAGE.user);
      return raw ? (JSON.parse(raw) as User) : null;
    } catch {
      return null;
    }
  },
  set(tokens: AuthTokens, user?: User) {
    if (!isBrowser()) return;
    try {
      localStorage.setItem(STORAGE.access, tokens.access);
      localStorage.setItem(STORAGE.refresh, tokens.refresh);
      if (user) localStorage.setItem(STORAGE.user, JSON.stringify(user));
    } catch {}
  },
  clear() {
    if (!isBrowser()) return;
    try {
      localStorage.removeItem(STORAGE.access);
      localStorage.removeItem(STORAGE.refresh);
      localStorage.removeItem(STORAGE.user);
    } catch {}
  },
};

/* ----------- Axios instance ----------- */

export const api = ax.create({
  baseURL: API_BASE_URL,
  headers: { Accept: "application/json", "Content-Type": "application/json" },
  timeout: 20_000,
});

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = tokenStore.getAccess();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Track an in-flight refresh so concurrent 401s queue behind a single call.
let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const refresh = tokenStore.getRefresh();
  if (!refresh) return null;

  if (!refreshPromise) {
    refreshPromise = ax
      .post(`${API_BASE_URL}/auth/token/refresh/`, { refresh })
      .then((res) => {
        const next = res.data as Partial<AuthTokens>;
        if (next.access) {
          // Refresh response may or may not rotate the refresh token.
          tokenStore.set({
            access: next.access,
            refresh: next.refresh ?? refresh,
          });
          return next.access;
        }
        return null;
      })
      .catch(() => null)
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

api.interceptors.response.use(
  (r) => r,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // Only attempt one refresh per request, and only on 401.
    if (error.response?.status === 401 && original && !original._retry) {
      original._retry = true;
      const next = await refreshAccessToken();
      if (next) {
        original.headers!.Authorization = `Bearer ${next}`;
        return api.request(original);
      }
      // Refresh failed → log out client-side.
      tokenStore.clear();
      if (isBrowser() && !window.location.pathname.startsWith("/auth")) {
        window.location.href = PATHS.auth.login;
      }
    }

    return Promise.reject(error);
  },
);

/**
 * Pull a readable error message out of an Axios error.
 * The Gent API uses several shapes — `error`, `detail`, field arrays —
 * so we walk them in priority order and fall back to the HTTP message.
 */
export function readApiError(err: unknown): string {
  if (!ax.isAxiosError(err)) return "Something went wrong.";
  const body = err.response?.data as Record<string, unknown> | undefined;
  if (!body) return err.message;
  if (typeof body.error === "string") return body.error;
  if (typeof body.detail === "string") return body.detail;
  if (typeof body.message === "string") return body.message;
  // First field with a string/array value
  for (const [k, v] of Object.entries(body)) {
    if (typeof v === "string") return `${k}: ${v}`;
    if (Array.isArray(v) && v.length && typeof v[0] === "string") return `${k}: ${v[0]}`;
  }
  return err.message;
}
