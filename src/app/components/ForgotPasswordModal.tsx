"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { usePasswordResetRequest } from "@/hooks/use-password-reset";
import { AxiosError } from "axios";
import { useSelector } from "react-redux";
import { RootState } from "@/store";

interface ForgotPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ApiError {
  error?: string;
  detail?: string;
}

export default function ForgotPasswordModal({
  isOpen,
  onClose,
}: ForgotPasswordModalProps) {
  const isDark = useSelector((state: RootState) => state.theme.isDark);
  const [email, setEmail] = useState("");
  const router = useRouter();

  // Handle body overflow and modal state
  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "unset";
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  const mutation = usePasswordResetRequest();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    mutation.mutate(
      { email },
      {
        onSuccess: (data) => {
          // Display the message from backend
          const message =
            data?.message ||
            data?.detail ||
            "If an account with that email exists, a password reset link has been sent.";

          toast.success(message, {
            duration: 6000,
            position: "top-center",
            style: {
              backgroundColor: "#f0fdf4",
              color: "#166534",
              border: "1px solid #bbf7d0",
              borderRadius: "0.5rem",
              padding: "1rem",
              fontSize: "0.875rem",
              textAlign: "left",
              maxWidth: "500px",
            },
          });
          setEmail("");
          onClose();
        },
        onError: (err: Error) => {
          const axiosErr = err as AxiosError<ApiError>;
          const errorMessage =
            axiosErr.response?.data?.error ||
            axiosErr.response?.data?.detail ||
            "An error occurred while sending the email. Please try again.";

          toast.error(errorMessage, {
            duration: 5000,
            position: "top-center",
            style: {
              backgroundColor: "#fef2f2",
              color: "#b91c1c",
              border: "1px solid #fecaca",
              borderRadius: "0.5rem",
              padding: "1rem",
              fontSize: "0.875rem",
              textAlign: "left",
            },
          });
        },
      },
    );
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.5 }}
          exit={{ opacity: 0 }}
          className={`absolute inset-0 ${isDark ? "bg-black/70" : "bg-black/30"}`}
          onClick={onClose}
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.2 }}
          className={`relative rounded-2xl p-6 w-full max-w-md mx-auto shadow-2xl z-10 border transition-all ${
            isDark
              ? "bg-[#0f1419]/95 border-white/20 backdrop-blur-md"
              : "bg-white/95 border-[#5A7863]/30 backdrop-blur-md"
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={onClose}
            className={`absolute right-4 top-4 transition-colors ${
              isDark
                ? "text-white/60 hover:text-white"
                : "text-[#2d3e2d]/60 hover:text-[#2d3e2d]"
            }`}
            aria-label="Close"
          >
            <X size={20} />
          </button>

          <div className="text-center mb-6">
            <h2
              className={`text-2xl font-bold mb-2 ${
                isDark ? "text-white" : "text-[#2d3e2d]"
              }`}
            >
              Reset Password
            </h2>
            <p
              className={`text-sm ${
                isDark ? "text-white/70" : "text-[#2d3e2d]/70"
              }`}
            >
              Enter your email and we&apos;ll send you a link to reset your
              password.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label
                htmlFor="email"
                className={`block text-sm font-medium ${
                  isDark ? "text-white/80" : "text-[#2d3e2d]/80"
                }`}
              >
                Email Address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={`w-full px-3 py-2 rounded-md transition-all border-2 ${
                  isDark
                    ? "border-white/20 bg-white/10 text-white placeholder:text-white/50 focus:border-[#7dd3fc] focus:ring-[#7dd3fc]"
                    : "border-[#5A7863]/30 bg-white/50 text-[#2d3e2d] placeholder:text-[#2d3e2d]/50 focus:border-[#5A7863] focus:ring-[#5A7863]"
                }`}
                placeholder="your@email.com"
                disabled={mutation.isPending}
                required
              />
            </div>

            <div className="pt-2">
              <Button
                type="submit"
                className={`w-full py-2 px-4 rounded-md transition-all font-bold ${
                  isDark
                    ? "bg-gradient-to-r from-[#7dd3fc] to-[#06b6d4] text-[#0f1419] hover:shadow-lg hover:shadow-cyan-500/50"
                    : "bg-gradient-to-r from-[#5A7863] to-[#4a6853] text-white hover:shadow-lg hover:shadow-green-500/50"
                }`}
                disabled={mutation.isPending}
              >
                {mutation.isPending ? "Sending..." : "Send Reset Link"}
              </Button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
