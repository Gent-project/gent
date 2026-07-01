/**
 * Auth service — thin, typed wrappers around the /auth/* endpoints.
 *
 * Functions in this file are intentionally small and dumb: they make one HTTP
 * call and return the parsed body. All UI state (loading, errors, toasts) is
 * the job of the hooks layer in `src/hooks/`.
 */
import { api, tokenStore } from "@/lib/api-client";
import type {
  LoginPayload,
  LoginResponse,
  RegisterPayload,
  RegisterResponse,
  User,
} from "@/types/api";

export const authService = {
  /** POST /auth/login/ — returns the user + token pair. */
  async login(payload: LoginPayload): Promise<LoginResponse> {
    const { data } = await api.post<LoginResponse>("/auth/login/", payload);
    tokenStore.set(data.tokens, data.user);
    return data;
  },

  /** POST /auth/register/ — auto-logs the user in if tokens are returned. */
  async register(payload: RegisterPayload): Promise<RegisterResponse> {
    const { data } = await api.post<RegisterResponse>("/auth/register/", payload);
    if (data.tokens) tokenStore.set(data.tokens, data.user);
    return data;
  },

  /** POST /auth/logout/ — best-effort; we clear locally even if the call fails. */
  async logout(): Promise<void> {
    const refresh = tokenStore.getRefresh();
    try {
      if (refresh) await api.post("/auth/logout/", { refresh });
    } catch {
      /* server may return 400/401 if token already expired; ignore */
    } finally {
      tokenStore.clear();
    }
  },

  /** GET /auth/profile/ — fresh user info, useful after returning from CLI. */
  async profile(): Promise<User> {
    const { data } = await api.get<User>("/auth/profile/");
    return data;
  },
};
