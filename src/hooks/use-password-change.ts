import { useMutation } from "@tanstack/react-query";
import axios from "@/lib/axios";

interface PasswordChangePayload {
  old_password: string;
  new_password: string;
  new_password_confirm: string;
}

interface PasswordChangeResponse {
  detail?: string;
  message?: string;
}

// Change password for authenticated user
export const usePasswordChange = () => {
  return useMutation<PasswordChangeResponse, Error, PasswordChangePayload>({
    mutationFn: async (data) => {
      const response = await axios.post("/auth/password/change/", data);
      return response.data;
    },
  });
};
