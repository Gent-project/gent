"use client";

import { Palette } from "lucide-react";
import { useDashboard } from "../_components/DashboardContext";
import ProfileSettingsForm from "../_components/ProfileSettingsForm";
import ChangePasswordForm from "../_components/ChangePasswordForm";
import { getDashboardTheme } from "../_components/dashboard-theme";

export default function DashboardSettingsPage() {
  const { isDark } = useDashboard();
  const t = getDashboardTheme(isDark);

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <div className="mb-8">
        <h1
          className="text-2xl sm:text-3xl font-bold tracking-tight"
          style={{ color: t.text }}
        >
          Settings
        </h1>
        <p className="text-sm mt-1" style={{ color: t.textMuted }}>
          Manage your account. Profile is connected to the API.
        </p>
      </div>

      <div className="space-y-6">
        <ProfileSettingsForm isDark={isDark} />
        <ChangePasswordForm isDark={isDark} />

        <section
          className="rounded-lg border p-5 flex items-center gap-3"
          style={{
            backgroundColor: t.accentMuted,
            borderColor: t.border,
          }}
        >
          <Palette className="w-5 h-5 shrink-0" style={{ color: t.accent }} />
          <p className="text-sm" style={{ color: t.textSecondary }}>
            Theme: <strong>{isDark ? "Dark" : "Light"}</strong> — toggle from
            the sidebar profile menu.
          </p>
        </section>
      </div>
    </div>
  );
}
