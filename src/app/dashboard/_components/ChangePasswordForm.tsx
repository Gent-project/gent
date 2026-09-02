"use client";

import { useState } from "react";
import { Eye, EyeOff, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { usePasswordChange } from "@/hooks/use-password-change";
import { getDashboardTheme } from "./dashboard-theme";

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
  const t = getDashboardTheme(isDark);

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

  const inputClassName =
    "w-full rounded-lg border px-3 py-2 pr-10 outline-none transition-all focus:ring-2 focus:ring-violet-500/20";
  const labelClassName = "block text-sm font-medium";
  const eyeButtonClassName =
    "absolute right-3 top-1/2 -translate-y-1/2 transition-colors";

  return (
    <section
      className="overflow-hidden rounded-2xl border"
      style={{
        backgroundColor: t.elevated,
        borderColor: t.border,
      }}
    >
      <div
        className="flex items-start gap-3 px-5 py-4"
        style={{
          backgroundColor: t.surface,
        }}
      >
        <Lock
          className="w-5 h-5 mt-0.5 shrink-0"
          style={{
            color: t.accent,
          }}
        />

        <div>
          <h2
            className="text-base font-semibold"
            style={{
              color: t.text,
            }}
          >
            Change Password
          </h2>

          <p
            className="text-xs mt-0.5"
            style={{
              color: t.textMuted,
            }}
          >
            Update your password to keep your account secure.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="p-5 space-y-5">
        {/* Current Password */}
        <div className="space-y-2">
          <label htmlFor="current-password" className={labelClassName} style={{ color: t.textSecondary }}>
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
              style={{ backgroundColor: t.inputBg, borderColor: t.border, color: t.text }}
            />

            <button
              type="button"
              onClick={() => setShowCurrentPassword((previous) => !previous)}
              className={eyeButtonClassName}
              style={{ color: t.textMuted }}
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
          <label htmlFor="new-password" className={labelClassName} style={{ color: t.textSecondary }}>
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
              style={{ backgroundColor: t.inputBg, borderColor: t.border, color: t.text }}
            />

            <button
              type="button"
              onClick={() => setShowNewPassword((previous) => !previous)}
              className={eyeButtonClassName}
              style={{ color: t.textMuted }}
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
          <label htmlFor="confirm-password" className={labelClassName} style={{ color: t.textSecondary }}>
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
              style={{ backgroundColor: t.inputBg, borderColor: t.border, color: t.text }}
            />

            <button
              type="button"
              onClick={() => setShowConfirmPassword((previous) => !previous)}
              className={eyeButtonClassName}
              style={{ color: t.textMuted }}
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
          className="w-full font-semibold"
          style={{ background: t.accentGradient, color: t.successText }}
        >
          {mutation.isPending ? "Changing Password..." : "Change Password"}
        </Button>
      </form>
    </section>
  );
}
