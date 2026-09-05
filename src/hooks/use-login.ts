import { useMutation } from "@tanstack/react-query";
import axios from "axios";

export interface LoginResponse {
  message: string;
  user: {
    id: number;
    email: string;
    first_name: string;
    last_name: string;
    date_joined: string;
    is_active: boolean;
  };
  tokens: {
    access: string;
    refresh: string;
  };
}

export const useLogin = () =>
  useMutation<LoginResponse, Error, { email: string; password: string }>({
    mutationFn: async (credentials) => {
      try {
        // Use the same-origin Next.js proxy. Calling the backend directly from
        // the browser makes login depend on cross-origin policy and can surface
        // only a generic "Network Error" even while the API itself is healthy.
        const response = await axios.post("/api/auth/login", credentials);

        const data = response.data;

        if (!data.tokens || !data.tokens.access) {
          console.error('Token check failed. data.tokens:', data.tokens);
          throw new Error('Login failed: token not received from server');
        }

        // Save token in localStorage
        if (typeof window !== 'undefined') {
          localStorage.setItem('token', data.tokens.access);
          localStorage.setItem('refreshToken', data.tokens.refresh);
        }

        // DON'T show toast - it might cause issues
        // toast.success('Login successful', {
        //   description: 'Welcome back!',
        //   duration: 3000,
        // });

        return data;
      } catch (error: any) {
        console.error('Login error:', error);
        
        let errorMessage = 'An error occurred during login';
        
        if (error.response) {
          // Handle HTTP errors
          if (error.response.status === 401) {
            errorMessage = 'Incorrect email or password';
          } else if (error.response.status === 405) {
            errorMessage = 'Login endpoint not available. Please check the API configuration.';
          } else if (error.response.data?.error) {
            errorMessage = error.response.data.error;
          } else if (error.response.data?.message) {
            errorMessage = error.response.data.message;
          } else {
            errorMessage = `Server error: ${error.response.status}`;
          }
        } else if (error.request) {
          errorMessage = 'Cannot connect to server. Please check your internet connection';
        } else if (error.message) {
          errorMessage = error.message;
        }
        
        // DON'T show toast on error either
        // toast.error('Login Error', {
        //   description: errorMessage,
        //   duration: 5000,
        // });
        
        throw new Error(errorMessage);
      }
    },
  });
