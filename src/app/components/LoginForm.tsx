"use client";

import { useState } from "react";
import InputField from "./InputField";
import LoginButton from "./LoginButton";
import ForgotPasswordModal from "./ForgotPasswordModal";
import { useLogin } from "@/hooks/use-login";
import { useDispatch } from "react-redux";
import { setAuth } from "@/store/slices/auth-slice";
import { validatePassword } from "@/utils/validatePassword";
import { AiFillEye, AiFillEyeInvisible } from "react-icons/ai";
import { motion } from "framer-motion";

export default function LoginForm() {
  const dispatch = useDispatch();
  const login = useLogin();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");
  const [showForgotPassword, setShowForgotPassword] = useState(false);

  const handleLogin = async () => {
    setError(""); // Reset error message

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError("Please enter a valid email address");
      return;
    }

    if (!password) {
      setError("Please enter your password");
      return;
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
      setError(passwordError);
      return;
    }

    setError("");

    login.mutate(
      { email, password },
      {
        onSuccess: (data) => {
          if (typeof window !== "undefined") {
            // Token is saved in useLogin
            dispatch(
              setAuth({
                token: data.token,
                user: data.user,
                refreshToken: data.refreshToken,
              }),
            );
            window.location.href = "/";
          }
        },
        onError: (error) => {
          console.error("Login failed:", error);
        },
      },
    );
  };

  const containerVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        staggerChildren: 0.1,
        duration: 0.5,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
  };

  return (
    <motion.div
      className="flex flex-col gap-4"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Email Field */}
      <motion.div className="flex flex-col" variants={itemVariants}>
        <label className="text-sm font-sans font-bold text-gray-400 mb-1">
          Email Address
        </label>
        <InputField
          placeholder="Enter your email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="placeholder:text-gray-500 text-gray-900"
        />
      </motion.div>

      {/* Password Field */}
      <motion.div className="flex flex-col relative" variants={itemVariants}>
        <label className="text-sm font-sans font-bold text-gray-400 mb-1">
          Password
        </label>
        <InputField
          type={showPassword ? "text" : "password"}
          placeholder="Enter your password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="placeholder:text-gray-500 pr-10 text-gray-900"
        />
        <div
          className="absolute right-3 top-9.5 cursor-pointer text-gray-500 hover:text-gray-700"
          onClick={() => setShowPassword(!showPassword)}
        >
          {showPassword ? <AiFillEyeInvisible /> : <AiFillEye />}
        </div>
      </motion.div>

      {/* Error Message */}
      {error && (
        <motion.div
          className="text-red-500 text-sm"
          variants={itemVariants}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          {error}
        </motion.div>
      )}

      {/* Remember Me + Forgot Password */}
      <motion.div
        className="flex justify-between items-center text-sm text-gray-600"
        variants={itemVariants}
      >
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={rememberMe}
            onChange={() => setRememberMe(!rememberMe)}
            className="h-4 w-4 cursor-pointer"
          />
          Remind me
        </label>
        <button
          type="button"
          onClick={() => setShowForgotPassword(true)}
          className="hover:underline text-[#5A7863] font-medium cursor-pointer"
        >
          Forgot password?
        </button>
      </motion.div>

      {/* Login Button */}
      <motion.div variants={itemVariants}>
        <LoginButton onClick={handleLogin} />
      </motion.div>

      <ForgotPasswordModal
        isOpen={showForgotPassword}
        onClose={() => setShowForgotPassword(false)}
      />
    </motion.div>
  );
}
