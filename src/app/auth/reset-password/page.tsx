"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Eye, EyeOff, Lock, CheckCircle2 } from "lucide-react";
import { usePasswordResetConfirm } from "@/hooks/use-password-reset";
import { toast } from "sonner";
import Link from "next/link";
import Atmosphere from "@/app/components/site/Atmosphere";

function ResetPasswordContent() {
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
    if (newPassword !== confirmPassword) return toast.error("Passwords do not match");
    if (newPassword.length < 8)
      return toast.error("Password must be at least 8 characters");
    if (!uid || !token) return;

    mutation.mutate(
      { uid, token, new_password: newPassword, new_password_confirm: confirmPassword },
      {
        onSuccess: () => {
          setSuccess(true);
          toast.success("Password reset successfully!");
          setTimeout(() => router.push("/auth/login"), 3000);
        },
        onError: (error: any) => {
          toast.error(error.response?.data?.detail || "Failed to reset password");
        },
      },
    );
  };

  const inputClass =
    "w-full rounded-xl border border-line bg-surface/60 px-3 py-2.5 pr-10 text-fg placeholder:text-faint transition-all focus:border-brand/60 focus:outline-none focus:ring-2 focus:ring-brand/20";

  return (
    <div className="relative flex min-h-screen items-center justify-center p-4">
      <Atmosphere />
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="glass-strong glow-ring w-full max-w-md rounded-3xl p-8"
      >
        {success ? (
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand/12 ring-1 ring-brand/30">
              <CheckCircle2 className="h-8 w-8 text-brand" />
            </div>
            <h2 className="font-display text-2xl font-bold">Password reset!</h2>
            <p className="mt-2 text-muted">Redirecting you to the login page…</p>
            <Link
              href="/auth/login"
              className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-brand py-3 font-semibold text-brand-ink"
            >
              Go to login
            </Link>
          </div>
        ) : (
          <>
            <div className="mb-8 text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand/12 ring-1 ring-brand/30">
                <Lock className="h-6 w-6 text-brand" />
              </div>
              <h1 className="font-display text-3xl font-bold">Reset password</h1>
              <p className="mt-1 text-sm text-muted">Enter your new password below.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-muted">
                  New password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className={inputClass}
                    placeholder="Enter new password"
                    required
                    minLength={8}
                    disabled={mutation.isPending}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-faint hover:text-fg"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-muted">
                  Confirm password
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className={inputClass}
                    placeholder="Confirm new password"
                    required
                    minLength={8}
                    disabled={mutation.isPending}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-faint hover:text-fg"
                  >
                    {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={mutation.isPending}
                className="group relative w-full overflow-hidden rounded-xl bg-brand py-3 font-semibold text-brand-ink transition-all disabled:opacity-70"
              >
                <span className="anim-shimmer absolute inset-0" />
                <span className="relative">
                  {mutation.isPending ? "Resetting…" : "Reset password"}
                </span>
              </button>

              <div className="text-center">
                <Link href="/auth/login" className="text-sm text-brand hover:underline">
                  Back to login
                </Link>
              </div>
            </form>
          </>
        )}
      </motion.div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-bg" />}>
      <ResetPasswordContent />
    </Suspense>
  );
}
