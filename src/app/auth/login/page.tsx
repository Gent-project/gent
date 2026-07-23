"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useDispatch, useSelector } from "react-redux";
import { motion } from "framer-motion";
import { AiFillEye, AiFillEyeInvisible } from "react-icons/ai";
import Link from "next/link";
import axios from "@/lib/axios";
import { parseAuthResponse } from "@/lib/auth-session";
import { setAuth } from "@/store/slices/auth-slice";
import { RootState } from "@/store";
import { AUTH_PATH, DASHBOARD_PATH } from "@/routes/path";
import SharedNavigation from "@/app/components/SharedNavigation";
import ForgotPasswordModal from "@/app/components/ForgotPasswordModal";
import InputField from "@/app/components/InputField";
import TerminalPreview from "@/app/components/TerminalPreview";

export default function LoginPage() {
  const router = useRouter();
  const dispatch = useDispatch();
  const isDark = useSelector((state: RootState) => state.theme.isDark);
  const [isHydrated, setIsHydrated] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [showForgotPasswordModal, setShowForgotPasswordModal] = useState(false);

  useEffect(() => {
    setIsHydrated(true);

    // فحص إذا كان المستخدم قادم من صفحة التسجيل
    const searchParams = new URLSearchParams(window.location.search);
    if (searchParams.get("signup") === "success") {
      setSuccessMessage(
        "Account created successfully! Please sign in with your credentials.",
      );

      // إزالة معامل URL بعد عرض الرسالة
      const url = new URL(window.location.href);
      url.searchParams.delete("signup");
      window.history.replaceState({}, "", url.pathname);
    }
  }, []);

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault();
    }

    setError("");
    setIsLoading(true);

    try {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        throw new Error("Please enter a valid email address");
      }

      if (!password || password.length < 8) {
        throw new Error("Password must be at least 8 characters");
      }

      const response = await axios.post("/auth/login/", { email, password });
      const { token, refreshToken, user } = parseAuthResponse(response.data);

      if (!token) {
        throw new Error("Login failed: token not received from server");
      }

      // حفظ التوكن في localStorage
      if (typeof window !== "undefined") {
        localStorage.setItem("token", token);
        if (refreshToken) {
          localStorage.setItem("refreshToken", refreshToken);
        }
        console.log("✅ Token saved to localStorage:", {
          token: token.substring(0, 20) + "...",
          refreshToken: refreshToken
            ? refreshToken.substring(0, 20) + "..."
            : "none",
        });
      }

      // حفظ في Redux store
      dispatch(setAuth({ token, user, refreshToken }));

      // توجيه للـ Dashboard
      router.replace(DASHBOARD_PATH.ROOT);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || "Login failed");
    } finally {
      setIsLoading(false);
    }
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

  if (!isHydrated) return null;

  return (
    <div
      className={`min-h-screen flex flex-col transition-colors duration-300 ${
        isDark
          ? "bg-gradient-to-br from-[#0f1419] via-[#1a1f2e] to-[#151b28]"
          : "bg-gradient-to-br from-[#bed19e] via-[#a8c88a] to-[#9bc07a]"
      }`}
    >
      <SharedNavigation />

      <div className="flex-1 flex items-center justify-center py-8 px-4 mt-20">
        <div className="w-full max-w-6xl grid lg:grid-cols-2 gap-8 items-center">
          {/* Left Side - Terminal Preview */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="hidden lg:block"
          >
            <TerminalPreview
              title="Quick Start with Git"
              commands={[
                {
                  command: "git clone https://gent.dev/username/repo.git",
                  comment: "Clone your repository",
                },
                { command: "cd repo" },
                {
                  command: "git checkout -b feature/new-feature",
                  comment: "Create new branch",
                },
                { command: "git add .", comment: "Stage your changes" },
                {
                  command: 'git commit -m "Add new feature"',
                  comment: "Commit your work",
                },
                {
                  command: "git push origin feature/new-feature",
                  comment: "Push to remote",
                },
              ]}
            />
          </motion.div>

          {/* Right Side - Login Form */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
            className="w-full"
          >
            <div
              className={`w-full rounded-2xl shadow-2xl p-6 sm:p-8 border transition-all ${
                isDark
                  ? "border-white/20 bg-[#0f1419]/95 backdrop-blur-md"
                  : "border-[#5A7863]/30 bg-white/95 backdrop-blur-md"
              }`}
            >
              <h1
                className={`text-2xl sm:text-3xl font-bold text-center mb-2 ${
                  isDark ? "text-white" : "text-[#2d3e2d]"
                }`}
              >
                Sign In
              </h1>
              <p
                className={`text-center text-sm mb-8 ${
                  isDark ? "text-white/60" : "text-[#2d3e2d]/60"
                }`}
              >
                Welcome back to Gent
              </p>

              <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                className="space-y-4"
              >
                {/* Success Message */}
                {successMessage && (
                  <motion.div
                    className={`text-sm p-3 rounded-md border ${
                      isDark
                        ? "bg-green-500/20 border-green-500/30 text-green-400"
                        : "bg-green-50 border-green-200 text-green-600"
                    }`}
                    variants={itemVariants}
                  >
                    {successMessage}
                  </motion.div>
                )}

                {/* Error Message */}
                {error && (
                  <motion.div
                    className={`text-sm p-3 rounded-md border ${
                      isDark
                        ? "bg-red-500/20 border-red-500/30 text-red-400"
                        : "bg-red-50 border-red-200 text-red-600"
                    }`}
                    variants={itemVariants}
                  >
                    {error}
                  </motion.div>
                )}

                <motion.div variants={itemVariants}>
                  <InputField
                    label="Email"
                    type="email"
                    name="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="user@example.com"
                    required
                  />
                </motion.div>

                <motion.div className="relative" variants={itemVariants}>
                  <InputField
                    label="Password"
                    type={showPassword ? "text" : "password"}
                    name="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className={`absolute right-3 top-9 cursor-pointer transition-colors ${
                      isDark
                        ? "text-white/60 hover:text-white"
                        : "text-[#2d3e2d]/60 hover:text-[#2d3e2d]"
                    }`}
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <AiFillEyeInvisible size={20} />
                    ) : (
                      <AiFillEye size={20} />
                    )}
                  </button>
                </motion.div>

                <motion.div
                  className="flex items-center justify-end"
                  variants={itemVariants}
                >
                  <button
                    type="button"
                    onClick={() => setShowForgotPasswordModal(true)}
                    className={`text-xs hover:underline cursor-pointer ${
                      isDark
                        ? "text-[#7dd3fc] hover:text-white"
                        : "text-[#5A7863] hover:text-[#2d3e2d]"
                    }`}
                  >
                    Forgot password?
                  </button>
                </motion.div>

                <motion.button
                  type="button"
                  onClick={() => handleLogin()}
                  className={`w-full font-bold py-2 px-4 rounded-lg transition-all cursor-pointer disabled:cursor-not-allowed disabled:opacity-70 ${
                    isDark
                      ? "bg-gradient-to-r from-[#7dd3fc] to-[#06b6d4] text-[#0f1419] hover:shadow-lg hover:shadow-cyan-500/50"
                      : "bg-gradient-to-r from-[#5A7863] to-[#4a6853] text-white hover:shadow-lg hover:shadow-green-500/50"
                  }`}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  disabled={isLoading}
                  variants={itemVariants}
                >
                  {isLoading ? "Signing in..." : "Sign In"}
                </motion.button>

                <motion.div
                  className={`text-center text-sm mt-4 ${
                    isDark ? "text-white/70" : "text-[#2d3e2d]/70"
                  }`}
                  variants={itemVariants}
                >
                  Don&apos;t have an account?{" "}
                  <Link
                    href={AUTH_PATH.SIGNIN}
                    className={`font-medium hover:underline transition-colors ${
                      isDark
                        ? "text-[#7dd3fc] hover:text-white"
                        : "text-[#5A7863] hover:text-[#2d3e2d]"
                    }`}
                  >
                    create one
                  </Link>
                </motion.div>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Footer */}
      <footer
        className={`w-full py-4 border-t transition-colors duration-300 ${
          isDark
            ? "border-white/10 bg-[#0f1419]/50"
            : "border-[#5A7863]/20 bg-white/50"
        }`}
      >
        <div className="flex flex-wrap justify-center gap-6 text-xs sm:text-sm">
          <Link
            href="/privacy"
            className={`transition-colors ${
              isDark
                ? "text-white/60 hover:text-white"
                : "text-[#2d3e2d]/60 hover:text-[#2d3e2d]"
            }`}
          >
            Privacy Policy
          </Link>
          <Link
            href="/terms"
            className={`transition-colors ${
              isDark
                ? "text-white/60 hover:text-white"
                : "text-[#2d3e2d]/60 hover:text-[#2d3e2d]"
            }`}
          >
            Terms of Service
          </Link>
          <span className={isDark ? "text-white/30" : "text-[#2d3e2d]/30"}>
            •
          </span>
          <span
            className={`text-xs ${isDark ? "text-white/50" : "text-[#2d3e2d]/50"}`}
          >
            © 2026 Gent. All rights reserved.
          </span>
        </div>
      </footer>

      {/* Forgot Password Modal */}
      <ForgotPasswordModal
        isOpen={showForgotPasswordModal}
        onClose={() => setShowForgotPasswordModal(false)}
      />
    </div>
  );
}
