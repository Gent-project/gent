"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useMutation } from "@tanstack/react-query";
import axios from "@/lib/axios";
import { AxiosError } from "axios";

interface ForgotPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ForgotPasswordPayload {
  email: string;
}



interface ApiError {
  error: string;
}

export default function ForgotPasswordModal({ isOpen, onClose }: ForgotPasswordModalProps) {
  const [email, setEmail] = useState("");
  const router = useRouter();

  // Handle body overflow and modal state
  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : 'unset';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  const mutation = useMutation({
    mutationFn: async (payload: ForgotPasswordPayload) => {
      const { data } = await axios.post("/auth/forgot-password", payload);
      return data;
    },
    onSuccess: () => {
      toast.success('Password reset link has been sent to your email', {
        duration: 5000,
        position: 'top-center',
        style: {
          backgroundColor: '#f0fdf4',
          color: '#166534',
          border: '1px solid #bbf7d0',
          borderRadius: '0.5rem',
          padding: '1rem',
          fontSize: '0.875rem',
          textAlign: 'left',
        }
      });
      onClose();
      setTimeout(() => router.push('/auth/login'), 300);
    },
    onError: (err: AxiosError<ApiError>) => {
      toast.error(err.response?.data?.error || 'An error occurred while sending the email', {
        duration: 5000,
        position: 'top-center',
        style: {
          backgroundColor: '#fef2f2',
          color: '#b91c1c',
          border: '1px solid #fecaca',
          borderRadius: '0.5rem',
          padding: '1rem',
          fontSize: '0.875rem',
          textAlign: 'left',
        }
      });
      onClose();
      setTimeout(() => router.push('/auth/login'), 300);
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    mutation.mutate({ email });
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.5 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black"
          onClick={onClose}
        />
        
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.2 }}
          className="relative bg-white rounded-2xl p-6 w-full max-w-md mx-auto shadow-xl z-10"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={onClose}
            className="absolute right-4 top-4 text-gray-500 hover:text-gray-700 transition-colors"
            aria-label="Close"
          >
            <X size={20} />
          </button>

          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-[#5A7863] mb-2">Reset Password</h2>
            <p className="text-gray-600 text-sm">
              Enter your email and we&apos;ll send you a link to reset your password.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-[#5A7863] focus:border-[#5A7863]"
                placeholder="your@email.com"
                disabled={mutation.isPending}
                required
              />
            </div>

            <div className="pt-2">
              <Button
                type="submit"
                className="w-full bg-[#5A7863] hover:bg-[#4a6752] text-white py-2 px-4 rounded-md transition-colors"
                disabled={mutation.isPending}
              >
                {mutation.isPending ? 'Sending...' : 'Send Reset Link'}
              </Button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
