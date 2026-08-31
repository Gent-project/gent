"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useDispatch } from "react-redux";
import { motion } from "framer-motion";
import { AiFillEye, AiFillEyeInvisible } from "react-icons/ai";
import { GitBranch } from "lucide-react";
import Link from "next/link";
import axios from "@/lib/axios";
import { isAxiosError } from "axios";
import { parseAuthResponse, storeAuthTokens } from "@/lib/auth-session";
import { setAuth } from "@/store/slices/auth-slice";
import { AUTH_PATH, DASHBOARD_PATH } from "@/routes/path";
import ForgotPasswordModal from "@/app/components/ForgotPasswordModal";
import InputField from "@/app/components/InputField";
import AuthShell from "@/app/components/site/AuthShell";
import AnimatedTerminal from "@/app/components/site/AnimatedTerminal";

export default function LoginPage() {
  const router = useRouter();
  const dispatch = useDispatch();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [showForgotPasswordModal, setShowForgotPasswordModal] = useState(false);

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    if (searchParams.get("signup") === "success") {
      setSuccessMessage(
        "Account created successfully! Please sign in with your credentials.",
      );
      const url = new URL(window.location.href);
      url.searchParams.delete("signup");
      window.history.replaceState({}, "", url.pathname);
    }
  }, []);

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isLoading) return;
    setError("");

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.trim()) return setError("Email is required");
    if (!emailRegex.test(email.trim()))
      return setError("Please enter a valid email address");
    if (!password) return setError("Password is required");
    if (password.length < 8)
      return setError("Password must be at least 8 characters");

    setIsLoading(true);
    try {
      const response = await axios.post("/auth/login/", {
        email: email.trim(),
        password,
      });
      const { token, refreshToken, user } = parseAuthResponse(response.data);
      if (!token) throw new Error("Login failed: token not received from server");
      storeAuthTokens(token, refreshToken);
      dispatch(setAuth({ token, user, refreshToken }));
      router.replace(DASHBOARD_PATH.ROOT);
    } catch (err: unknown) {
      let errorMessage = "Login failed";
      if (isAxiosError(err)) {
        const data = err.response?.data;
        if (data?.email) {
          errorMessage = Array.isArray(data.email) ? data.email[0] : data.email;
        } else if (data?.password) {
          errorMessage = Array.isArray(data.password) ? data.password[0] : data.password;
        } else if (data?.detail) {
          errorMessage = Array.isArray(data.detail) ? data.detail[0] : data.detail;
        } else if (data?.error) {
          errorMessage = Array.isArray(data.error) ? data.error[0] : data.error;
        } else if (data?.non_field_errors) {
          errorMessage = Array.isArray(data.non_field_errors)
            ? data.non_field_errors[0]
            : data.non_field_errors;
        } else if (typeof data === "string") {
          errorMessage = data;
        } else if (err.message) {
          errorMessage = err.message;
        }
      } else if (err instanceof Error) {
        errorMessage = err.message;
      }
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthShell
      showcase={
        <div>
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-line bg-surface/50 px-3 py-1.5 text-xs text-muted backdrop-blur">
            <GitBranch className="h-3.5 w-3.5 text-brand" /> Welcome back to Gent
          </div>
          <h2 className="font-display text-4xl font-bold leading-tight">
            Pick up right where
            <span className="text-gradient"> you pushed.</span>
          </h2>
          <p className="mt-4 max-w-md text-muted">
            Your repositories, branches, and commits are waiting — synced from
            the same objects your CLI writes.
          </p>
          <div className="mt-8">
            <AnimatedTerminal />
          </div>
        </div>
      }
    >
      <h1 className="font-display text-3xl font-bold">Sign in</h1>
      <p className="mt-1 text-sm text-muted">Access your Gent dashboard.</p>

      <form onSubmit={handleLogin} noValidate className="mt-8 space-y-4">
        {successMessage && (
          <div className="rounded-xl border border-brand/30 bg-brand/10 p-3 text-sm text-brand-2">
            {successMessage}
          </div>
        )}
        {error && (
          <div
            role="alert"
            className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm font-medium text-destructive"
          >
            {error}
          </div>
        )}

        <InputField
          label="Email"
          type="email"
          name="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (error) setError("");
          }}
          placeholder="user@example.com"
          required
        />

        <div className="relative">
          <InputField
            label="Password"
            type={showPassword ? "text" : "password"}
            name="password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (error) setError("");
            }}
            placeholder="••••••••"
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-9 text-faint transition-colors hover:text-fg"
            tabIndex={-1}
          >
            {showPassword ? <AiFillEyeInvisible size={20} /> : <AiFillEye size={20} />}
          </button>
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setShowForgotPasswordModal(true)}
            className="text-xs text-brand hover:underline"
          >
            Forgot password?
          </button>
        </div>

        <motion.button
          type="submit"
          className="group relative w-full overflow-hidden rounded-xl bg-brand py-3 font-semibold text-brand-ink transition-all disabled:opacity-70"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          disabled={isLoading}
        >
          <span className="anim-shimmer absolute inset-0" />
          <span className="relative">{isLoading ? "Signing in…" : "Sign in"}</span>
        </motion.button>

        <p className="text-center text-sm text-muted">
          Don&apos;t have an account?{" "}
          <Link href={AUTH_PATH.SIGNIN} className="font-medium text-brand hover:underline">
            create one
          </Link>
        </p>
      </form>

      <ForgotPasswordModal
        isOpen={showForgotPasswordModal}
        onClose={() => setShowForgotPasswordModal(false)}
      />
    </AuthShell>
  );
}
