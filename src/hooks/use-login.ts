import { API_BASE_URL } from './../lib/axios';
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMutation } from "@tanstack/react-query";
import API_ROUTES from '@/constant/api-routes';
import { toast } from "sonner";
import axios from "@/lib/axios";
export interface LoginResponse {
  token: string;
  refreshToken: string;
  user: any;
}

export const useLogin = () =>
  useMutation<LoginResponse, Error, { email: string; password: string }>({
    mutationFn: async (credentials) => {
      try {
        const response = await axios.post(`${API_BASE_URL}/${API_ROUTES.AUTH.LOGIN}`, credentials, {
          headers: {
            'Content-Type': 'application/json',
          },
          withCredentials: true
        });

        const data = response.data;

        if (!data.token) {
          throw new Error('Login failed: Token not received');
        }

        // Save token in localStorage
        if (typeof window !== 'undefined') {
          localStorage.setItem('token', data.token);
          if (data.refreshToken) {
            localStorage.setItem('refreshToken', data.refreshToken);
          }
        }

        toast.success('Login successful', {
          description: 'Welcome back!',
          duration: 3000,
        });

        return data;
      } catch (error: any) {
        console.error('Login error:', error);
        
        let errorMessage = 'An error occurred during login';
        
        if (error.response) {
          // Handle HTTP errors
          if (error.response.status === 401) {
            errorMessage = 'Incorrect email or password';
          } else if (error.response.data?.message) {
            errorMessage = error.response.data.message;
          }
        } else if (error.request) {
          errorMessage = 'Cannot connect to server. Please check your internet connection';
        } else if (error.message) {
          errorMessage = error.message;
        }
        
        toast.error('Login Error', {
          description: errorMessage,
          duration: 5000,
        });
        
        throw new Error(errorMessage);
      }
    },
  });
