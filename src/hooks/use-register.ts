import { useMutation } from "@tanstack/react-query";
import axios from "@/lib/axios";

export const useRegister = () =>
  useMutation({
    mutationFn: (data: {
      username: string;
      email: string;
      password: string;
    }) => axios.post("register", data),
  });
