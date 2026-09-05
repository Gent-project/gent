"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { GitBranch, Menu, Moon, Sun, Terminal, X } from "lucide-react";
import GlobalSearch from "@/components/search/GlobalSearch";
import { useDispatch, useSelector } from "react-redux";

import { AUTH_PATH, DASHBOARD_PATH } from "@/routes/path";
import { RootState } from "@/store";
import { toggleTheme } from "@/store/slices/theme-slice";
import { LanguageToggle } from "@/app/language-provider";

const navLinks = [
  { href: "/home", label: "Home" },
  { href: "/explore", label: "Explore" },
  { href: "/how-it-works", label: "How it works" },
  { href: "/cli", label: "CLI Docs" },
  { href: "/services", label: "Services" },
  { href: "/faq", label: "FAQ" },
];

export default function SharedNavigation() {
  const dispatch = useDispatch();
  const isDark = useSelector((state: RootState) => state.theme.isDark);
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <motion.header
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="fixed inset-x-0 top-0 z-50 flex justify-center px-3 pt-3 sm:px-5 sm:pt-4"
    >
      <div
        className={`flex w-full max-w-6xl items-center justify-between gap-3 rounded-2xl px-3 py-2 transition-all duration-500 sm:px-4 ${
          scrolled ? "glass-strong glow-ring" : "glass"
        }`}
      >
        {/* logo */}
        <Link href="/home" className="group flex items-center gap-2.5 pl-1">
          <span className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-brand/12 ring-1 ring-brand/30 transition-transform duration-300 group-hover:scale-110">
            <span className="anim-pulse-glow absolute inset-0 rounded-xl bg-brand/25 blur-md" />
            <GitBranch className="relative h-5 w-5 text-brand" />
          </span>
          <span className="leading-none">
            <span className="block font-display text-lg font-bold tracking-tight">
              Gent
            </span>
            <span className="block font-mono text-[10px] uppercase tracking-[0.18em] text-faint">
              cli · api · web
            </span>
          </span>
        </Link>

        {/* header search — available signed in or out */}
        <GlobalSearch className="hidden min-w-0 flex-1 max-w-xs lg:block" />

        {/* desktop links */}
        <nav className="hidden items-center gap-0.5 md:flex">
          {navLinks.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`relative rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  active ? "text-fg" : "text-muted hover:text-fg"
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="nav-active"
                    className="absolute inset-0 -z-10 rounded-lg bg-brand/12 ring-1 ring-brand/25"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
                {link.label}
              </Link>
            );
          })}
        </nav>

        {/* actions */}
        <div className="hidden items-center gap-1.5 md:flex">
          <button
            type="button"
            onClick={() => dispatch(toggleTheme())}
            className="rounded-lg p-2 text-muted transition-colors hover:bg-brand/10 hover:text-fg"
            aria-label="Toggle theme"
          >
            {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <LanguageToggle className="rounded-lg px-2.5 py-2 text-xs font-bold text-muted transition-colors hover:bg-brand/10 hover:text-fg" />
          <Link
            href={DASHBOARD_PATH.ROOT}
            className="group relative ml-1 inline-flex items-center gap-2 overflow-hidden rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-brand-ink transition-transform duration-200 hover:scale-[1.03]"
          >
            <span className="anim-shimmer absolute inset-0" />
            <Terminal className="relative h-4 w-4" />
            <span className="relative">Dashboard</span>
          </Link>
        </div>

        {/* mobile */}
        <div className="flex items-center gap-1 md:hidden">
          <button
            type="button"
            onClick={() => dispatch(toggleTheme())}
            className="rounded-lg p-2 text-muted transition-colors hover:bg-brand/10 hover:text-fg"
            aria-label="Toggle theme"
          >
            {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={() => setIsMenuOpen((o) => !o)}
            className="rounded-lg p-2 text-muted transition-colors hover:bg-brand/10 hover:text-fg"
            aria-label="Open menu"
          >
            {isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {/* Keep discovery visible on the home page and every public route on phones. */}
        <GlobalSearch className="order-3 basis-full md:hidden" />
      </div>

      {/* mobile drawer */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="glass-strong absolute inset-x-3 top-[4.5rem] rounded-2xl p-3 md:hidden"
          >
            <div className="space-y-1">
              <GlobalSearch className="mb-2" />
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setIsMenuOpen(false)}
                  className="block rounded-lg px-3 py-2.5 text-sm font-medium text-muted transition-colors hover:bg-brand/10 hover:text-fg"
                >
                  {link.label}
                </Link>
              ))}
              <div className="flex items-center gap-2 pt-2">
                <LanguageToggle className="rounded-lg border border-line px-3 py-2 text-xs font-bold text-muted" />
                <Link
                  href={AUTH_PATH.LOGIN}
                  onClick={() => setIsMenuOpen(false)}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-brand-ink"
                >
                  <Terminal className="h-4 w-4" />
                  Sign in
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
}
