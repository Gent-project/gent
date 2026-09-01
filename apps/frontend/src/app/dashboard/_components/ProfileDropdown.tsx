"use client";

import { motion } from "framer-motion";
import { User, Settings, LogOut, Moon, Sun, HelpCircle, Loader2 } from "lucide-react";
import Link from "next/link";
import { useSelector } from "react-redux";
import { RootState } from "@/store";
import { getDashboardTheme } from "./dashboard-theme";
import { DASHBOARD_PATH } from "@/routes/path";
import { useLogout } from "@/hooks/use-auth-profile";
import { getDisplayName, getUsername } from "@/lib/user-display";

interface ProfileDropdownProps {
  isDark: boolean;
  onToggleTheme: () => void;
  onClose: () => void;
}

export default function ProfileDropdown({
  isDark,
  onToggleTheme,
  onClose,
}: ProfileDropdownProps) {
  const t = getDashboardTheme(isDark);
  const user = useSelector((state: RootState) => state.auth.user);
  const logoutMutation = useLogout();

  const items = [
    { icon: User, label: "Your profile", href: DASHBOARD_PATH.SETTINGS },
    { icon: Settings, label: "Settings", href: DASHBOARD_PATH.SETTINGS },
    { icon: HelpCircle, label: "Documentation", href: "/faq" },
  ];

  const handleLogout = () => {
    onClose();
    logoutMutation.mutate();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.15 }}
      className="absolute left-0 right-0 mx-3 mt-2 rounded-lg border overflow-hidden z-50"
      style={{
        backgroundColor: t.elevated,
        borderColor: t.border,
        boxShadow: t.shadow,
      }}
    >
      <div
        className="px-4 py-3 border-b"
        style={{ borderColor: t.border, backgroundColor: t.canvas }}
      >
        <p className="text-sm font-semibold truncate" style={{ color: t.text }}>
          {getDisplayName(user)}
        </p>
        <p className="text-xs truncate" style={{ color: t.textMuted }}>
          @{getUsername(user)}
        </p>
      </div>

      <div className="py-1">
        {items.map(({ icon: Icon, label, href }) => (
          <Link
            key={label}
            href={href}
            onClick={onClose}
            className="flex items-center gap-3 px-4 py-2 text-sm transition-colors"
            style={{ color: t.textSecondary }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = t.sidebarHover;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
            }}
          >
            <Icon className="w-4 h-4" />
            {label}
          </Link>
        ))}
        <button
          type="button"
          onClick={onToggleTheme}
          className="flex items-center gap-3 px-4 py-2 w-full text-sm transition-colors"
          style={{ color: t.textSecondary }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = t.sidebarHover;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "transparent";
          }}
        >
          {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          {isDark ? "Light mode" : "Dark mode"}
        </button>
      </div>

      <div className="border-t py-1" style={{ borderColor: t.border }}>
        <button
          type="button"
          onClick={handleLogout}
          disabled={logoutMutation.isPending}
          className="flex items-center gap-3 px-4 py-2 w-full text-sm transition-colors disabled:opacity-60"
          style={{ color: t.textSecondary }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = t.sidebarHover;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "transparent";
          }}
        >
          {logoutMutation.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <LogOut className="w-4 h-4" />
          )}
          Sign out
        </button>
      </div>
    </motion.div>
  );
}
