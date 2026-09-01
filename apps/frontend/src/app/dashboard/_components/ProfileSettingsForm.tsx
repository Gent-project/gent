"use client";

import { useEffect, useState } from "react";
import { User, Loader2 } from "lucide-react";
import { useProfile, useUpdateProfile } from "@/hooks/use-auth-profile";
import { getDashboardTheme } from "./dashboard-theme";

interface ProfileSettingsFormProps {
  isDark: boolean;
}

export default function ProfileSettingsForm({ isDark }: ProfileSettingsFormProps) {
  const t = getDashboardTheme(isDark);
  const { data: profile, isLoading, isError, error, refetch } = useProfile();
  const updateProfile = useUpdateProfile();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [formError, setFormError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    if (profile) {
      setFirstName(profile.first_name ?? "");
      setLastName(profile.last_name ?? "");
    }
  }, [profile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setSuccessMessage("");

    if (!firstName.trim() && !lastName.trim()) {
      setFormError("Enter at least a first or last name.");
      return;
    }

    try {
      await updateProfile.mutateAsync({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
      });
      setSuccessMessage("Profile updated successfully.");
    } catch (err: unknown) {
      const message =
        err &&
        typeof err === "object" &&
        "response" in err &&
        err.response &&
        typeof err.response === "object" &&
        "data" in err.response &&
        err.response.data &&
        typeof err.response.data === "object"
          ? String(
              (err.response.data as { error?: string; detail?: string }).error ??
                (err.response.data as { detail?: string }).detail ??
                "Failed to update profile"
            )
          : "Failed to update profile";
      setFormError(message);
    }
  };

  const inputStyle = {
    backgroundColor: t.inputBg,
    borderColor: t.border,
    color: t.text,
  };

  return (
    <section
      className="rounded-lg border overflow-hidden"
      style={{
        backgroundColor: t.elevated,
        borderColor: t.border,
      }}
    >
      <div
        className="flex items-start gap-3 px-5 py-4 border-b"
        style={{ borderColor: t.border, backgroundColor: t.canvas }}
      >
        <User className="w-5 h-5 mt-0.5 shrink-0" style={{ color: t.accent }} />
        <div>
          <h2 className="text-base font-semibold" style={{ color: t.text }}>
            Profile
          </h2>
          <p className="text-xs mt-0.5" style={{ color: t.textMuted }}>
            GET / PATCH /api/auth/profile/
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
        {isLoading && (
          <div
            className="flex items-center gap-2 text-sm py-4"
            style={{ color: t.textMuted }}
          >
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading profile…
          </div>
        )}

        {isError && (
          <div className="space-y-2">
            <p className="text-sm text-red-500">
              {(error as Error)?.message ?? "Could not load profile."}
            </p>
            <button
              type="button"
              onClick={() => refetch()}
              className="text-sm font-medium underline"
              style={{ color: t.accent }}
            >
              Retry
            </button>
          </div>
        )}

        {!isLoading && !isError && (
          <>
            <div>
              <label
                className="block text-sm font-medium mb-1.5"
                style={{ color: t.text }}
              >
                Email
              </label>
              <input
                type="email"
                value={profile?.email ?? ""}
                disabled
                className="w-full max-w-md px-3 py-2 text-sm rounded-md border opacity-70 cursor-not-allowed"
                style={inputStyle}
              />
            </div>

            {profile?.username && (
              <div>
                <label
                  className="block text-sm font-medium mb-1.5"
                  style={{ color: t.text }}
                >
                  Username
                </label>
                <input
                  type="text"
                  value={profile.username}
                  disabled
                  className="w-full max-w-md px-3 py-2 text-sm rounded-md border opacity-70 cursor-not-allowed"
                  style={inputStyle}
                />
              </div>
            )}

            <div className="grid sm:grid-cols-2 gap-4 max-w-md">
              <div>
                <label
                  className="block text-sm font-medium mb-1.5"
                  style={{ color: t.text }}
                >
                  First name
                </label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-md border outline-none focus:ring-2"
                  style={inputStyle}
                  placeholder="First name"
                />
              </div>
              <div>
                <label
                  className="block text-sm font-medium mb-1.5"
                  style={{ color: t.text }}
                >
                  Last name
                </label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-md border outline-none focus:ring-2"
                  style={inputStyle}
                  placeholder="Last name"
                />
              </div>
            </div>

            {formError && (
              <p className="text-sm text-red-500">{formError}</p>
            )}
            {successMessage && (
              <p className="text-sm" style={{ color: t.success }}>
                {successMessage}
              </p>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setFirstName(profile?.first_name ?? "");
                  setLastName(profile?.last_name ?? "");
                  setFormError("");
                  setSuccessMessage("");
                }}
                className="px-4 py-2 text-sm font-medium rounded-md border"
                style={{ borderColor: t.border, color: t.textSecondary }}
              >
                Reset
              </button>
              <button
                type="submit"
                disabled={updateProfile.isPending}
                className="px-4 py-2 text-sm font-semibold rounded-lg transition-all hover:shadow-lg disabled:opacity-60 flex items-center gap-2"
                style={{
                  background: t.accentGradient,
                  color: t.successText,
                }}
              >
                {updateProfile.isPending && (
                  <Loader2 className="w-4 h-4 animate-spin" />
                )}
                Save changes
              </button>
            </div>
          </>
        )}
      </form>
    </section>
  );
}
