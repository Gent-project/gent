"use client";

import { Sun, Moon, LogOut, User, Mail, Calendar } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/hooks/use-theme";
import { timeAgo, cn } from "@/lib/utils";

/**
 * Settings — minimal profile + theme controls.
 *
 * The Gent API only supports `PUT/PATCH /auth/profile/` for first/last name
 * right now, so we expose read-only profile info plus the theme controls.
 * When email change / password change endpoints land, slot them in here.
 */
export default function SettingsPage() {
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();

  return (
    <AppShell
      title="Settings"
      subtitle="Manage your profile and the way Gent looks."
    >
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Profile card */}
        <Card className="lg:col-span-2">
          <CardContent className="p-6">
            <h2 className="mb-4 text-base font-semibold">Profile</h2>
            <div className="flex items-center gap-4">
              <Avatar seed={user?.email ?? "anon"} name={user?.email} size={56} />
              <div>
                <p className="text-lg font-semibold">
                  {[user?.first_name, user?.last_name].filter(Boolean).join(" ") ||
                    user?.email}
                </p>
                <p className="text-sm text-on-surface-variant">{user?.email}</p>
              </div>
            </div>

            <dl className="mt-6 grid gap-3 sm:grid-cols-2 text-sm">
              <Field icon={<User className="size-4" />} label="User ID" value={user?.id ?? "—"} />
              <Field
                icon={<Mail className="size-4" />}
                label="Email"
                value={user?.email ?? "—"}
              />
              <Field
                icon={<Calendar className="size-4" />}
                label="Joined"
                value={user?.date_joined ? timeAgo(user.date_joined) : "—"}
              />
              <Field
                icon={<User className="size-4" />}
                label="Status"
                value={user?.is_active ? "Active" : "Inactive"}
              />
            </dl>

            <div className="mt-6 border-t border-outline-variant pt-5">
              <Button variant="destructive" onClick={() => logout()}>
                <LogOut className="size-4" /> Sign out
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Appearance */}
        <Card>
          <CardContent className="p-6">
            <h2 className="mb-4 text-base font-semibold">Appearance</h2>
            <p className="text-sm text-on-surface-variant mb-4">
              Choose how Gent looks to you. The choice is remembered on this device.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <ThemeChoice
                selected={theme === "light"}
                onClick={() => setTheme("light")}
                icon={<Sun className="size-4" />}
                label="Light"
              />
              <ThemeChoice
                selected={theme === "dark"}
                onClick={() => setTheme("dark")}
                icon={<Moon className="size-4" />}
                label="Dark"
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

function Field({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-outline-variant p-3">
      <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-on-surface-variant">
        {icon}
        {label}
      </div>
      <div className="mt-1 font-medium">{value}</div>
    </div>
  );
}

function ThemeChoice({
  selected,
  onClick,
  icon,
  label,
}: {
  selected: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-2xl border p-4 transition-all",
        selected
          ? "border-primary bg-primary-container/40 ring-2 ring-primary/30"
          : "border-outline-variant hover:bg-surface-container-low",
      )}
    >
      <span className="text-primary">{icon}</span>
      <span className="text-sm font-medium">{label}</span>
    </button>
  );
}
