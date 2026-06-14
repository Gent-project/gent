"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  FolderGit2,
  Plus,
  Settings,
  Terminal,
  LogOut,
  Search,
  Sparkles,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

import { Logo } from "@/components/ui/logo";
import { Avatar } from "@/components/ui/avatar";
import { ThemeToggle } from "./theme-toggle";
import { PATHS } from "@/lib/paths";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";

/**
 * AppShell — the authenticated layout: left sidebar + top bar.
 *
 * Sidebar is sticky on desktop, slides in from the left on mobile, and
 * highlights the currently-active route. The top bar shows the page title
 * (passed in via `title`) and the signed-in user with a small menu.
 */
type AppShellProps = {
  children: React.ReactNode;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
};

export function AppShell({ children, title, subtitle, actions }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout, isCheckingSession } = useAuth();

  // Auth gate: if there's no token by the time we render, kick to /auth/login.
  React.useEffect(() => {
    const hasToken = typeof window !== "undefined" && !!localStorage.getItem("gent.access");
    if (!hasToken && !isCheckingSession) router.replace(PATHS.auth.login);
  }, [router, isCheckingSession]);

  const nav = [
    { href: PATHS.app.dashboard, label: "Projects", icon: FolderGit2 },
    { href: PATHS.app.newProject, label: "New project", icon: Plus },
    { href: PATHS.cli, label: "CLI guide", icon: Terminal },
    { href: PATHS.app.settings, label: "Settings", icon: Settings },
  ];

  const [menuOpen, setMenuOpen] = React.useState(false);

  return (
    <div className="min-h-screen flex bg-surface-container-low">
      {/* Sidebar */}
      <aside className="hidden lg:flex w-64 shrink-0 flex-col border-r border-outline-variant bg-surface-container-lowest">
        <div className="flex items-center gap-2 px-5 py-5">
          <Logo size={26} />
          <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-primary-container px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-on-primary-container">
            <Sparkles className="size-3" /> Beta
          </span>
        </div>
        <nav className="flex-1 px-3 space-y-1">
          {nav.map((item) => {
            const active =
              pathname === item.href ||
              (item.href !== PATHS.app.dashboard && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
                  active
                    ? "bg-primary-container text-on-primary-container"
                    : "text-on-surface-variant hover:bg-surface-container-low hover:text-foreground",
                )}
              >
                <item.icon
                  className={cn(
                    "size-4 transition-transform group-hover:scale-110",
                    active && "text-on-primary-container",
                  )}
                />
                {item.label}
                {active && (
                  <motion.span
                    layoutId="nav-pill"
                    className="ml-auto h-1.5 w-1.5 rounded-full bg-on-primary-container"
                  />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-outline-variant p-3">
          <div className="flex items-center gap-3 rounded-xl px-2 py-2">
            <Avatar seed={user?.email ?? "anon"} name={user?.email ?? "anon"} size={36} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">
                {user
                  ? [user.first_name, user.last_name].filter(Boolean).join(" ") ||
                    user.email
                  : "—"}
              </p>
              <p className="truncate text-xs text-on-surface-variant">
                {user?.email ?? ""}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => logout()}
            className="mt-1 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-error hover:bg-error-container/50 transition"
          >
            <LogOut className="size-4" /> Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 min-w-0 flex flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-30 glass border-b border-outline-variant">
          <div className="flex items-center gap-3 px-4 sm:px-8 h-16">
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className="lg:hidden inline-flex h-10 w-10 items-center justify-center rounded-full border border-outline-variant"
              aria-label="Toggle menu"
            >
              <FolderGit2 className="size-4" />
            </button>
            <div className="hidden md:flex flex-1 items-center max-w-md">
              <label className="relative w-full">
                <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 size-4 text-on-surface-variant" />
                <input
                  type="search"
                  placeholder="Search projects…"
                  className="h-10 w-full rounded-full border border-outline-variant bg-surface-container-lowest pl-9 pr-3 text-sm outline-none focus:border-primary"
                />
              </label>
            </div>
            <div className="flex-1 md:hidden text-sm font-semibold truncate">{title}</div>
            <ThemeToggle />
          </div>
          {(title || subtitle || actions) && (
            <div className="hidden md:flex items-end justify-between gap-4 px-4 sm:px-8 pb-4">
              <div className="min-w-0">
                {title && (
                  <h1 className="text-2xl font-bold tracking-tight truncate">{title}</h1>
                )}
                {subtitle && (
                  <p className="mt-1 text-sm text-on-surface-variant">{subtitle}</p>
                )}
              </div>
              {actions && <div className="flex items-center gap-2">{actions}</div>}
            </div>
          )}
        </header>

        {/* Mobile menu */}
        <AnimatePresence>
          {menuOpen && (
            <motion.aside
              initial={{ x: -260, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -260, opacity: 0 }}
              transition={{ type: "spring", stiffness: 280, damping: 30 }}
              className="lg:hidden fixed inset-y-0 left-0 z-40 w-64 bg-surface-container-lowest border-r border-outline-variant p-3 space-y-1"
            >
              <div className="px-3 py-3"><Logo /></div>
              {nav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium hover:bg-surface-container-low"
                >
                  <item.icon className="size-4" /> {item.label}
                </Link>
              ))}
              <button
                onClick={() => {
                  setMenuOpen(false);
                  logout();
                }}
                className="mt-2 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-error"
              >
                <LogOut className="size-4" /> Sign out
              </button>
            </motion.aside>
          )}
        </AnimatePresence>

        <div className="flex-1 px-4 sm:px-8 py-6 max-w-7xl w-full mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
