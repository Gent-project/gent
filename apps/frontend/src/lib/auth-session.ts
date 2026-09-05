import type { UserProfile } from "@/types/user";

const ACCESS_KEYS = ["gent.access", "token"];
const REFRESH_KEYS = ["gent.refresh", "refreshToken"];

export type ParsedAuthResponse = {
  token: string;
  refreshToken?: string;
  user?: UserProfile | null;
};

/** Normalize login/register API payloads (supports common JWT field names). */
export function parseAuthResponse(
  data: Record<string, unknown> | null | undefined
): ParsedAuthResponse {
  if (!data || typeof data !== "object") {
    return { token: "" };
  }

  const nested =
    typeof data.data === "object" && data.data !== null
      ? (data.data as Record<string, unknown>)
      : data;

  // Check if tokens are nested in a 'tokens' object
  const tokensObj = 
    typeof nested.tokens === "object" && nested.tokens !== null
      ? (nested.tokens as Record<string, unknown>)
      : null;

  const token = String(
    tokensObj?.access ??
      tokensObj?.access_token ??
      nested.token ??
      nested.access ??
      nested.access_token ??
      nested.accessToken ??
      ""
  ).trim();

  const refreshToken = (
    tokensObj?.refresh ??
      tokensObj?.refresh_token ??
      nested.refreshToken ??
      nested.refresh ??
      nested.refresh_token
  ) as string | undefined;

  const rawUser =
    typeof nested.user === "object" && nested.user !== null
      ? (nested.user as UserProfile)
      : null;

  return {
    token,
    refreshToken: refreshToken ? String(refreshToken) : undefined,
    user: rawUser,
  };
}

export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    for (const key of ACCESS_KEYS) {
      const token = localStorage.getItem(key);
      if (token && token !== "undefined" && token !== "null") return token;
    }
    return null;
  } catch {
    return null;
  }
}

export function getStoredRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    for (const key of REFRESH_KEYS) {
      const token = localStorage.getItem(key);
      if (token && token !== "undefined" && token !== "null") return token;
    }
    return null;
  } catch {
    return null;
  }
}

export function storeAuthTokens(token: string, refreshToken?: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem("gent.access", token);
  localStorage.setItem("token", token);
  if (refreshToken) {
    localStorage.setItem("gent.refresh", refreshToken);
    localStorage.setItem("refreshToken", refreshToken);
  }
}

export function clearAuthStorage(): void {
  if (typeof window === "undefined") return;
  ACCESS_KEYS.forEach((key) => localStorage.removeItem(key));
  REFRESH_KEYS.forEach((key) => localStorage.removeItem(key));
  localStorage.removeItem("permissions");
}
