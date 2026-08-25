"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Settings, Plus, X, LogOut, Moon, Sun } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useSelector, useDispatch } from "react-redux";
import { RootState } from "@/store";
import { logout } from "@/store/slices/auth-slice";
import { getDashboardTheme } from "./dashboard-theme";
import { DASHBOARD_PATH } from "@/routes/path";
import { useRouter } from "next/navigation";
import { useRepositories } from "@/hooks/use-repositories";
import { LanguageToggle } from "@/app/language-provider";

interface DashboardSidebarProps {
  isDark: boolean;
  onToggleTheme: () => void;
  onNewRepo: () => void;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export default function DashboardSidebar({
  isDark,
  onToggleTheme,
  onNewRepo,
  mobileOpen = false,
  onMobileClose,
}: DashboardSidebarProps) {
  const t = getDashboardTheme(isDark);
  const user = useSelector((state: RootState) => state.auth.user);
  const pathname = usePathname();
  const dispatch = useDispatch();
  const router = useRouter();

  const handleLogout = () => {
    dispatch(logout());
    router.push("/auth/login");
  };
  const { data: repositories = [] } = useRepositories();

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b" style={{ borderColor: t.border }}>
        {onMobileClose && (
          <button
            onClick={onMobileClose}
            className="absolute top-4 right-4 p-1 rounded-md lg:hidden"
            style={{ color: t.textMuted }}
          >
            <X className="w-5 h-5" />
          </button>
        )}

        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold"
            style={{
              background: t.avatarGradient,
              color: t.successText,
            }}
          >
            {user?.name?.charAt(0).toUpperCase() || "U"}
          </div>
          <div className="flex-1 min-w-0">
            <p
              className="text-sm font-semibold truncate"
              style={{ color: t.text }}
            >
              {user?.name || "User"}
            </p>
            <p className="text-xs truncate" style={{ color: t.textMuted }}>
              {user?.email || "user@example.com"}
            </p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        <Link
          href={DASHBOARD_PATH.ROOT}
          onClick={onMobileClose}
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
          style={{
            backgroundColor:
              pathname === DASHBOARD_PATH.ROOT
                ? t.sidebarActive
                : "transparent",
            color: pathname === DASHBOARD_PATH.ROOT ? t.text : t.textSecondary,
          }}
        >
          <Home className="w-4 h-4" />
          Dashboard
        </Link>

        <Link
          href={DASHBOARD_PATH.SETTINGS}
          onClick={onMobileClose}
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
          style={{
            backgroundColor:
              pathname === DASHBOARD_PATH.SETTINGS
                ? t.sidebarActive
                : "transparent",
            color:
              pathname === DASHBOARD_PATH.SETTINGS ? t.text : t.textSecondary,
          }}
        >
          <Settings className="w-4 h-4" />
          Settings
        </Link>

        <div className="py-2">
          <div className="h-px" style={{ backgroundColor: t.border }} />
        </div>

        <button
          onClick={() => {
            onNewRepo();
            onMobileClose?.();
          }}
          className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm font-semibold transition-all"
          style={{
            background: t.accentGradient,
            color: t.successText,
          }}
        >
          <Plus className="w-4 h-4" />
          New Repository
        </button>
        <div className="mt-2 space-y-1">
          {repositories.map((repo) => (
            <Link
              key={repo.id}
              href={`/dashboard/repository/${repo.owner_id}/${repo.name}`}
              className="block px-3 py-2 rounded-lg text-sm truncate"
              style={{ color: t.textSecondary }}
            >
              {repo.name}
            </Link>
          ))}
        </div>
      </nav>

      {/* Footer */}
      <div className="p-3 border-t space-y-2" style={{ borderColor: t.border }}>
        <button
          onClick={onToggleTheme}
          className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
          style={{ color: t.textSecondary }}
        >
          {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          {isDark ? "Light Mode" : "Dark Mode"}
        </button>

        <LanguageToggle
          className="flex items-center justify-center w-full px-3 py-2 rounded-lg text-sm font-bold border transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
          style={{
            borderColor: t.border,
            color: t.textSecondary,
          }}
        />

        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600"
        >
          <LogOut className="w-4 h-4" />
          Logout
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className="hidden lg:flex flex-col w-[260px] border-r h-screen sticky top-0"
        style={{
          backgroundColor: t.surface,
          borderColor: t.border,
        }}
      >
        {sidebarContent}
      </aside>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/50 lg:hidden"
              onClick={onMobileClose}
            />
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed left-0 top-0 bottom-0 z-50 w-[280px] border-r lg:hidden flex flex-col"
              style={{
                backgroundColor: t.surface,
                borderColor: t.border,
              }}
            >
              {sidebarContent}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
