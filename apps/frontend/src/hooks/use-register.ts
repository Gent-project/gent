import { useMutation } from "@tanstack/react-query";
import axios from "@/lib/axios";
import API_ROUTES from "@/constant/api-routes";

interface RegisterPayload {
  username: string;
  email: string;
  password: string;
}

interface RegisterResponse {
  id: number;
  username: string;
  email: string;
  message?: string;
}

export const useRegister = () =>
  useMutation<RegisterResponse, Error, RegisterPayload>({
    mutationFn: async (data) => {
      const response = await axios.post(API_ROUTES.AUTH.REGISTER, data);
      return response.data;
    },
  });
