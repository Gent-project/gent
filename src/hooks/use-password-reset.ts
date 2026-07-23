import { useMutation } from "@tanstack/react-query";
import axios from "@/lib/axios";
import API_ROUTES from "@/constant/api-routes";

interface PasswordResetRequest {
  email: string;
}

interface PasswordResetConfirm {
  uid: string;
  token: string;
  new_password: string;
  new_password_confirm: string;
}

interface PasswordResetResponse {
  detail?: string;
  message?: string;
}

// Request password reset email
export const usePasswordResetRequest = () => {
  return useMutation<PasswordResetResponse, Error, PasswordResetRequest>({
    mutationFn: async (data) => {
      const response = await axios.post(API_ROUTES.AUTH.PASSWORD_RESET, data);
      return response.data;
    },
  });
};

// Confirm password reset with token
export const usePasswordResetConfirm = () => {
  return useMutation<PasswordResetResponse, Error, PasswordResetConfirm>({
    mutationFn: async (data) => {
      const response = await axios.post(
        API_ROUTES.AUTH.PASSWORD_RESET_CONFIRM,
        data,
      );
      return response.data;
    },
  });
};
