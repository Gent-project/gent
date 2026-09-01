import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import type { UserProfile } from "@/types/user";
import {
  clearAuthStorage,
  getStoredRefreshToken,
  getStoredToken,
  storeAuthTokens,
} from "@/lib/auth-session";

interface AuthState {
  token: string | null;
  refreshToken: string | null;
  user: UserProfile | null;
}

const initialState: AuthState = {
  token: null,
  refreshToken: null,
  user: null,
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setAuth(
      state,
      action: PayloadAction<{
        token: string;
        refreshToken?: string;
        user?: UserProfile | null;
      }>
    ) {
      state.token = action.payload.token;
      if (action.payload.user !== undefined) {
        state.user = action.payload.user;
      }
      if (action.payload.refreshToken) {
        state.refreshToken = action.payload.refreshToken;
      }
      if (typeof window !== "undefined") {
        storeAuthTokens(action.payload.token, action.payload.refreshToken);
        console.log("✅ Auth tokens saved to localStorage via Redux:", {
          token: action.payload.token.substring(0, 20) + "...",
          refreshToken: action.payload.refreshToken 
            ? action.payload.refreshToken.substring(0, 20) + "..." 
            : "none"
        });
      }
    },
    setUser(state, action: PayloadAction<UserProfile | null>) {
      state.user = action.payload;
    },
    hydrateAuth(state) {
      if (typeof window === "undefined") return;
      const token = getStoredToken();
      const refreshToken = getStoredRefreshToken();
      if (token) {
        state.token = token;
        console.log("🔄 Token restored from localStorage:", token.substring(0, 20) + "...");
      }
      if (refreshToken) {
        state.refreshToken = refreshToken;
        console.log("🔄 Refresh token restored from localStorage:", refreshToken.substring(0, 20) + "...");
      }
      if (!token && !refreshToken) {
        console.log("ℹ️ No tokens found in localStorage");
      }
    },
    logout(state) {
      state.token = null;
      state.refreshToken = null;
      state.user = null;
      clearAuthStorage();
    },
  },
});

export const { setAuth, setUser, hydrateAuth, logout } = authSlice.actions;
export default authSlice.reducer;
