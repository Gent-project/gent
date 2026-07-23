"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Eye, EyeOff, Lock, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePasswordResetConfirm } from "@/hooks/use-password-reset";
import { toast } from "sonner";
import { useSelector } from "react-redux";
import { RootState } from "@/store";
import Link from "next/link";

function ResetPasswordContent() {
  const isDark = useSelector((state: RootState) => state.theme.isDark);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [success, setSuccess] = useState(false);

  const router = useRouter();
  const searchParams = useSearchParams();
  const uid = searchParams.get("uid");
  const token = searchParams.get("token");

  const mutation = usePasswordResetConfirm();

  useEffect(() => {
    if (!uid || !token) {
      toast.error("Invalid reset link");
      router.push("/auth/login");
    }
  }, [uid, token, router]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    if (newPassword.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }

    if (!uid || !token) return;

    mutation.mutate(
      {
        uid,
        token,
        new_password: newPassword,
        new_password_confirm: confirmPassword,
      },
      {
        onSuccess: () => {
          setSuccess(true);
          toast.success("Password reset successfully!");
          setTimeout(() => router.push("/auth/login"), 3000);
        },
        onError: (error: any) => {
          toast.error(
            error.response?.data?.detail || "Failed to reset password",
          );
        },
      },
    );
  };

  if (success) {
    return (
      <div
        className="min-h-screen flex items-center justify-center p-4"
        style={{
          background: isDark
            ? "linear-gradient(135deg, #0f1419 0%, #1a2332 100%)"
            : "linear-gradient(135deg, #f0f9f4 0%, #e8f5e9 100%)",
        }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className={`w-full max-w-md p-8 rounded-2xl text-center ${
            isDark
              ? "bg-[#0f1419]/80 border border-white/20"
              : "bg-white/80 border border-[#5A7863]/30"
          }`}
        >
          <CheckCircle2 className="w-16 h-16 mx-auto mb-4 text-green-500" />
          <h2
            className={`text-2xl font-bold mb-2 ${
              isDark ? "text-white" : "text-[#2d3e2d]"
            }`}
          >
            Password Reset Successful!
          </h2>
          <p
            className={`mb-4 ${isDark ? "text-white/70" : "text-[#2d3e2d]/70"}`}
          >
            Redirecting you to login page...
          </p>
          <Link href="/auth/login">
            <Button
              className={`w-full ${
                isDark
                  ? "bg-gradient-to-r from-[#7dd3fc] to-[#06b6d4] text-[#0f1419]"
                  : "bg-gradient-to-r from-[#5A7863] to-[#4a6853] text-white"
              }`}
            >
              Go to Login
            </Button>
          </Link>
        </motion.div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{
        background: isDark
          ? "linear-gradient(135deg, #0f1419 0%, #1a2332 100%)"
          : "linear-gradient(135deg, #f0f9f4 0%, #e8f5e9 100%)",
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`w-full max-w-md p-8 rounded-2xl ${
          isDark
            ? "bg-[#0f1419]/80 border border-white/20"
            : "bg-white/80 border border-[#5A7863]/30"
        }`}
      >
        <div className="text-center mb-8">
          <Lock
            className={`w-12 h-12 mx-auto mb-4 ${
              isDark ? "text-[#7dd3fc]" : "text-[#5A7863]"
            }`}
          />
          <h1
            className={`text-3xl font-bold mb-2 ${
              isDark ? "text-white" : "text-[#2d3e2d]"
            }`}
          >
            Reset Password
          </h1>
          <p
            className={`text-sm ${
              isDark ? "text-white/70" : "text-[#2d3e2d]/70"
            }`}
          >
            Enter your new password below
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* New Password */}
          <div className="space-y-2">
            <label
              className={`block text-sm font-medium ${
                isDark ? "text-white/80" : "text-[#2d3e2d]/80"
              }`}
            >
              New Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className={`w-full px-3 py-2 pr-10 rounded-md transition-all border-2 ${
                  isDark
                    ? "border-white/20 bg-white/10 text-white placeholder:text-white/50 focus:border-[#7dd3fc]"
                    : "border-[#5A7863]/30 bg-white/50 text-[#2d3e2d] placeholder:text-[#2d3e2d]/50 focus:border-[#5A7863]"
                }`}
                placeholder="Enter new password"
                required
                minLength={8}
                disabled={mutation.isPending}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className={`absolute right-3 top-1/2 -translate-y-1/2 ${
                  isDark
                    ? "text-white/50 hover:text-white"
                    : "text-[#2d3e2d]/50 hover:text-[#2d3e2d]"
                }`}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* Confirm Password */}
          <div className="space-y-2">
            <label
              className={`block text-sm font-medium ${
                isDark ? "text-white/80" : "text-[#2d3e2d]/80"
              }`}
            >
              Confirm Password
            </label>
            <div className="relative">
              <input
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={`w-full px-3 py-2 pr-10 rounded-md transition-all border-2 ${
                  isDark
                    ? "border-white/20 bg-white/10 text-white placeholder:text-white/50 focus:border-[#7dd3fc]"
                    : "border-[#5A7863]/30 bg-white/50 text-[#2d3e2d] placeholder:text-[#2d3e2d]/50 focus:border-[#5A7863]"
                }`}
                placeholder="Confirm new password"
                required
                minLength={8}
                disabled={mutation.isPending}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className={`absolute right-3 top-1/2 -translate-y-1/2 ${
                  isDark
                    ? "text-white/50 hover:text-white"
                    : "text-[#2d3e2d]/50 hover:text-[#2d3e2d]"
                }`}
              >
                {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <Button
            type="submit"
            disabled={mutation.isPending}
            className={`w-full py-2 rounded-md font-bold transition-all ${
              isDark
                ? "bg-gradient-to-r from-[#7dd3fc] to-[#06b6d4] text-[#0f1419] hover:shadow-lg hover:shadow-cyan-500/50"
                : "bg-gradient-to-r from-[#5A7863] to-[#4a6853] text-white hover:shadow-lg hover:shadow-green-500/50"
            }`}
          >
            {mutation.isPending ? "Resetting..." : "Reset Password"}
          </Button>

          <div className="text-center">
            <Link
              href="/auth/login"
              className={`text-sm hover:underline ${
                isDark ? "text-[#7dd3fc]" : "text-[#5A7863]"
              }`}
            >
              Back to Login
            </Link>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ResetPasswordContent />
    </Suspense>
  );
}
