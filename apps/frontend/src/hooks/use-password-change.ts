import { useMutation } from "@tanstack/react-query";
import axios from "@/lib/axios";
import API_ROUTES from "@/constant/api-routes";

interface PasswordChangePayload {
  current_password: string;
  new_password: string;
  new_password_confirm: string;
}

interface PasswordChangeResponse {
  detail?: string;
  message?: string;
}

export const usePasswordChange = () => {
  return useMutation<PasswordChangeResponse, Error, PasswordChangePayload>({
    mutationFn: async (data) => {
      const response = await axios.post(API_ROUTES.AUTH.PASSWORD_CHANGE, data);

      return response.data;
    },
  });
};
