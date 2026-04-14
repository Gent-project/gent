"use client";

import { useState } from "react";
import InputField from "./InputField";
import { AiFillEye, AiFillEyeInvisible } from "react-icons/ai";
import { motion } from "framer-motion";
import { validateSignUp } from "@/utils/validateSignUp";
import { AUTH_PATH } from "@/routes/path";
import axios from "@/lib/axios";
import { AxiosError, isAxiosError } from "axios";

interface SignUpData {
  email: string;
  password: string;
  password_confirm: string;
  first_name: string;
  last_name: string;
}

interface ApiError {
  error: string;
}

export default function SignUpForm() {
  const [formData, setFormData] = useState<SignUpData>({
    email: "",
    password: "",
    password_confirm: "",
    first_name: "",
    last_name: "",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const validationError = validateSignUp(formData);
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsLoading(true);

    try {
      const { data } = await axios.post( AUTH_PATH.LOGIN, formData);
      window.location.href = AUTH_PATH.LOGIN + "?signup=success";
    } catch (err) {
      let errorMessage = "Sign up failed";

      if (isAxiosError(err)) {
        const axiosErr = err as AxiosError<ApiError>;
        errorMessage = axiosErr.response?.data.error || axiosErr.message;
      } else if (err instanceof Error) {
        errorMessage = err.message;
      }

      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 w-112.5 md:w-full">
      {error && (
        <div className="text-red-500 text-sm text-center p-2  bg-red-50 rounded-md">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <InputField
          label="First Name"
          type="text"
          name="first_name"
          value={formData.first_name}
          onChange={handleChange}
          placeholder="John"
          required
        />
        <InputField
          label="Last Name"
          type="text"
          name="last_name"
          value={formData.last_name}
          onChange={handleChange}
          placeholder="Doe"
          required
        />
      </div>

      <InputField
        label="Email"
        type="email"
        name="email"
        value={formData.email}
        onChange={handleChange}
        placeholder="user@example.com"
        required
      />

      <div className="relative">
        <InputField
          label="Password"
          type={showPassword ? "text" : "password"}
          name="password"
          value={formData.password}
          onChange={handleChange}
          placeholder="••••••••"
          required
        />
        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          className="absolute right-3 top-9 text-gray-500 hover:text-gray-700 cursor-pointer"
          tabIndex={-1}
        >
          {showPassword ? (
            <AiFillEyeInvisible size={20} />
          ) : (
            <AiFillEye size={20} />
          )}
        </button>
      </div>

      <InputField
        label="Confirm Password"
        type="password"
        name="password_confirm"
        value={formData.password_confirm}
        onChange={handleChange}
        placeholder="••••••••"
        required
      />

      <motion.button
        type="submit"
        className="w-full bg-[#5A7863] text-[#EBF4DD] hover:bg-[#3B4953] transition-all duration-300   font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline   cursor-pointer disabled:cursor-not-allowed disabled:opacity-70"
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        disabled={isLoading}
      >
        {isLoading ? "Creating Account..." : "Create Account"}
      </motion.button>

      <div className="text-center text-sm text-gray-600 mt-4">
        Already have an account?{" "}
        <a
          href={AUTH_PATH.LOGIN}
          className="text-[#8AAE5C] hover:underline font-medium cursor-pointer"
        >
          sign in
        </a>
      </div>
    </form>
  );
}
