import { createSlice, PayloadAction } from "@reduxjs/toolkit";

interface User {
  id: string;
  email: string;
  name: string;
}

interface AuthState {
  token: string | null;
  refreshToken: string | null;
  user: User | null;
}

// Helper function to safely get token from localStorage
const getInitialToken = (): string | null => {
  // Only run on client-side
  if (typeof window === 'undefined') return null;
  
  try {
    return localStorage.getItem("token");
  } catch (error) {
    console.error('Error accessing localStorage:', error);
    return null;
  }
};

// Helper function to safely get refreshToken from localStorage
const getInitialRefreshToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  
  try {
    return localStorage.getItem("refreshToken");
  } catch (error) {
    console.error('Error accessing localStorage:', error);
    return null;
  }
};

const initialState: AuthState = {
  token: getInitialToken(),
  refreshToken: getInitialRefreshToken(),
  user: null,
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setAuth(
      state,
      action: PayloadAction<{ token: string; refreshToken?: string; user: User }>
    ) {
      state.token = action.payload.token;
      state.user = action.payload.user;
      if (action.payload.refreshToken) {
        state.refreshToken = action.payload.refreshToken;
      }
    },
    logout(state) {
      state.token = null;
      state.user = null;
      // Only clear localStorage on client-side
      if (typeof window !== 'undefined') {
        try {
          localStorage.clear();
        } catch (error) {
          console.error('Error clearing localStorage:', error);
        }
      }
    },
  },
});

export const { setAuth, logout } = authSlice.actions;
export default authSlice.reducer;
