"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { GitBranch, Home, Settings, Plus, X, LogOut, Moon, Sun } from "lucide-react";
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
      <div className="border-b p-4" style={{ borderColor: t.border }}>
        {onMobileClose && (
          <button
            onClick={onMobileClose}
            className="absolute top-4 right-4 p-1 rounded-md lg:hidden"
            style={{ color: t.textMuted }}
          >
            <X className="w-5 h-5" />
          </button>
        )}

        <Link href="/home" className="group flex items-center gap-3">
          <span
            className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-2xl border"
            style={{ background: t.accentMuted, borderColor: t.border }}
          >
            <span className="anim-pulse-glow absolute inset-1 rounded-xl" style={{ background: `${t.accent}38` }} />
            <GitBranch className="relative h-5 w-5" style={{ color: t.accent }} />
          </span>
          <span>
            <span className="block font-display text-lg font-bold leading-none" style={{ color: t.text }}>Gent</span>
            <span className="mt-1 block font-mono text-[9px] uppercase tracking-[0.2em]" style={{ color: t.textMuted }}>
              control room
            </span>
          </span>
        </Link>

        <div
          className="mt-5 flex items-center gap-3 rounded-2xl border p-3"
          style={{ background: t.inputBg, borderColor: t.borderMuted }}
        >
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl text-sm font-bold shadow-lg"
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
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        <Link
          href={DASHBOARD_PATH.ROOT}
          onClick={onMobileClose}
          className="flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm font-medium transition-all"
          style={{
            backgroundColor:
              pathname === DASHBOARD_PATH.ROOT
                ? t.sidebarActive
                : "transparent",
            color: pathname === DASHBOARD_PATH.ROOT ? t.text : t.textSecondary,
            borderColor: pathname === DASHBOARD_PATH.ROOT ? t.border : "transparent",
            boxShadow: pathname === DASHBOARD_PATH.ROOT ? t.shadow : "none",
          }}
        >
          <Home className="w-4 h-4" />
          Dashboard
        </Link>

        <Link
          href={DASHBOARD_PATH.SETTINGS}
          onClick={onMobileClose}
          className="flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm font-medium transition-all"
          style={{
            backgroundColor:
              pathname === DASHBOARD_PATH.SETTINGS
                ? t.sidebarActive
                : "transparent",
            color:
              pathname === DASHBOARD_PATH.SETTINGS ? t.text : t.textSecondary,
            borderColor: pathname === DASHBOARD_PATH.SETTINGS ? t.border : "transparent",
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
          className="flex w-full items-center justify-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold shadow-lg transition-all hover:scale-[1.02]"
          style={{
            background: t.accentGradient,
            color: t.successText,
          }}
        >
          <Plus className="w-4 h-4" />
          New Repository
        </button>
        <p className="mb-2 mt-5 px-3 font-mono text-[9px] uppercase tracking-[0.2em]" style={{ color: t.textMuted }}>
          Repositories
        </p>
        <div className="space-y-1">
          {repositories.map((repo) => (
            <Link
              key={repo.id}
              href={`/dashboard/repository/${repo.owner_id}/${repo.name}`}
              className="block truncate rounded-xl border border-transparent px-3 py-2 text-sm transition-all hover:translate-x-1"
              style={{ color: t.textSecondary, background: t.sidebarHover }}
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
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors"
          style={{ color: t.textSecondary, background: t.sidebarHover }}
        >
          {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          {isDark ? "Light Mode" : "Dark Mode"}
        </button>

        <LanguageToggle
          className="flex w-full items-center justify-center rounded-xl border px-3 py-2 text-sm font-bold transition-colors"
          style={{
            borderColor: t.border,
            color: t.textSecondary,
            background: t.inputBg,
          }}
        />

        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-red-500 transition-colors hover:bg-red-500/10"
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
        className="sticky top-0 z-20 hidden h-screen w-[276px] flex-col border-r backdrop-blur-2xl lg:flex"
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
