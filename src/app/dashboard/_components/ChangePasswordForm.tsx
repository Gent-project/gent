"use client";

import { useState } from "react";
import { Eye, EyeOff, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { usePasswordChange } from "@/hooks/use-password-change";

interface ChangePasswordFormProps {
  isDark: boolean;
}

export default function ChangePasswordForm({
  isDark,
}: ChangePasswordFormProps) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const mutation = usePasswordChange();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }

    if (newPassword.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }

    if (currentPassword === newPassword) {
      toast.error("New password must be different from your current password");
      return;
    }

    mutation.mutate(
      {
        current_password: currentPassword,
        new_password: newPassword,
        new_password_confirm: confirmPassword,
      },
      {
        onSuccess: () => {
          setCurrentPassword("");
          setNewPassword("");
          setConfirmPassword("");

          toast.success("Password changed successfully");
        },
        onError: (error: any) => {
          const message =
            error?.response?.data?.detail ||
            error?.response?.data?.message ||
            "Failed to change password";

          toast.error(message);
        },
      },
    );
  };

  const inputClassName = `w-full px-3 py-2 pr-10 rounded-md border transition-all ${
    isDark
      ? "border-white/20 bg-white/10 text-white placeholder:text-white/40 focus:border-[#7dd3fc]"
      : "border-[#5A7863]/30 bg-white text-[#2d3e2d] placeholder:text-[#2d3e2d]/40 focus:border-[#5A7863]"
  }`;

  const labelClassName = `block text-sm font-medium ${
    isDark ? "text-white/80" : "text-[#2d3e2d]/80"
  }`;

  const eyeButtonClassName = `absolute right-3 top-1/2 -translate-y-1/2 ${
    isDark
      ? "text-white/50 hover:text-white"
      : "text-[#2d3e2d]/50 hover:text-[#2d3e2d]"
  }`;

  return (
    <section
      className="rounded-lg border overflow-hidden"
      style={{
        backgroundColor: isDark ? "#111820" : "#ffffff",
        borderColor: isDark ? "rgba(255,255,255,0.12)" : "#5A7863",
      }}
    >
      <div
        className="flex items-start gap-3 px-5 py-4"
        style={{
          backgroundColor: isDark ? "#0f1419" : "#f8faf8",
        }}
      >
        <Lock
          className="w-5 h-5 mt-0.5 shrink-0"
          style={{
            color: isDark ? "#7dd3fc" : "#5A7863",
          }}
        />

        <div>
          <h2
            className="text-base font-semibold"
            style={{
              color: isDark ? "#ffffff" : "#2d3e2d",
            }}
          >
            Change Password
          </h2>

          <p
            className="text-xs mt-0.5"
            style={{
              color: isDark ? "rgba(255,255,255,0.6)" : "rgba(45,62,45,0.65)",
            }}
          >
            Update your password to keep your account secure.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="p-5 space-y-5">
        {/* Current Password */}
        <div className="space-y-2">
          <label htmlFor="current-password" className={labelClassName}>
            Current Password
          </label>

          <div className="relative">
            <input
              id="current-password"
              type={showCurrentPassword ? "text" : "password"}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Enter your current password"
              required
              disabled={mutation.isPending}
              className={inputClassName}
            />

            <button
              type="button"
              onClick={() => setShowCurrentPassword((previous) => !previous)}
              className={eyeButtonClassName}
              aria-label={
                showCurrentPassword
                  ? "Hide current password"
                  : "Show current password"
              }
            >
              {showCurrentPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        {/* New Password */}
        <div className="space-y-2">
          <label htmlFor="new-password" className={labelClassName}>
            New Password
          </label>

          <div className="relative">
            <input
              id="new-password"
              type={showNewPassword ? "text" : "password"}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Enter your new password"
              required
              minLength={8}
              disabled={mutation.isPending}
              className={inputClassName}
            />

            <button
              type="button"
              onClick={() => setShowNewPassword((previous) => !previous)}
              className={eyeButtonClassName}
              aria-label={
                showNewPassword ? "Hide new password" : "Show new password"
              }
            >
              {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        {/* Confirm Password */}
        <div className="space-y-2">
          <label htmlFor="confirm-password" className={labelClassName}>
            Confirm New Password
          </label>

          <div className="relative">
            <input
              id="confirm-password"
              type={showConfirmPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm your new password"
              required
              minLength={8}
              disabled={mutation.isPending}
              className={inputClassName}
            />

            <button
              type="button"
              onClick={() => setShowConfirmPassword((previous) => !previous)}
              className={eyeButtonClassName}
              aria-label={
                showConfirmPassword
                  ? "Hide password confirmation"
                  : "Show password confirmation"
              }
            >
              {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        <Button
          type="submit"
          disabled={
            mutation.isPending ||
            !currentPassword ||
            !newPassword ||
            !confirmPassword
          }
          className={`w-full ${
            isDark
              ? "bg-gradient-to-r from-[#7dd3fc] to-[#06b6d4] text-[#0f1419]"
              : "bg-gradient-to-r from-[#5A7863] to-[#4a6853] text-white"
          }`}
        >
          {mutation.isPending ? "Changing Password..." : "Change Password"}
        </Button>
      </form>
    </section>
  );
}
