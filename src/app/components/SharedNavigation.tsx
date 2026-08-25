"use client";

import Link from "next/link";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { GitBranch, Menu, Moon, Sun, Terminal, X } from "lucide-react";
import { useDispatch, useSelector } from "react-redux";

import { AUTH_PATH, DASHBOARD_PATH } from "@/routes/path";
import { RootState } from "@/store";
import { toggleTheme } from "@/store/slices/theme-slice";
import { LanguageToggle } from "@/app/language-provider";

const navLinks = [
  { href: "/home", label: "Home" },
  { href: "/cli", label: "CLI Docs" },
  { href: "/faq", label: "FAQ" },
];

export default function SharedNavigation() {
  const dispatch = useDispatch();
  const isDark = useSelector((state: RootState) => state.theme.isDark);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const shell = isDark
    ? "border-white/10 bg-[#0f1419]/92 text-white"
    : "border-[#5A7863]/15 bg-[#f8faf3]/92 text-[#223022]";
  const navText = isDark
    ? "text-white/70 hover:text-white hover:bg-white/10"
    : "text-[#425442] hover:text-[#223022] hover:bg-white";
  const primary = isDark
    ? "bg-[#7dd3fc] text-[#071018] hover:bg-[#9be1fd]"
    : "bg-[#2d3e2d] text-white hover:bg-[#3b523b]";

  return (
    <motion.header
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={`fixed inset-x-0 top-0 z-50 border-b backdrop-blur-xl ${shell}`}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/home" className="flex items-center gap-3">
          <span
            className={`flex h-9 w-9 items-center justify-center rounded-lg ${
              isDark ? "bg-white/10" : "bg-white"
            }`}
          >
            <GitBranch
              className={`h-5 w-5 ${isDark ? "text-[#7dd3fc]" : "text-[#5A7863]"}`}
            />
          </span>
          <span>
            <span className="block text-base font-bold leading-5">Gent</span>
            <span className={`block text-xs ${isDark ? "text-white/50" : "text-[#5A7863]"}`}>
              CLI + API + Web
            </span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition ${navText}`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <button
            type="button"
            onClick={() => dispatch(toggleTheme())}
            className={`rounded-lg p-2 transition ${navText}`}
            aria-label="Toggle theme"
          >
            {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <LanguageToggle
            className={`rounded-lg px-3 py-2 text-xs font-bold transition ${navText}`}
          />
          <Link
            href={DASHBOARD_PATH.ROOT}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition ${primary}`}
          >
            <Terminal className="h-4 w-4" />
            Dashboard
          </Link>
        </div>

        <div className="flex items-center gap-2 md:hidden">
          <button
            type="button"
            onClick={() => dispatch(toggleTheme())}
            className={`rounded-lg p-2 transition ${navText}`}
            aria-label="Toggle theme"
          >
            {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <LanguageToggle
            className={`rounded-lg px-3 py-2 text-xs font-bold transition ${navText}`}
          />
          <button
            type="button"
            onClick={() => setIsMenuOpen((open) => !open)}
            className={`rounded-lg p-2 transition ${navText}`}
            aria-label="Open menu"
          >
            {isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {isMenuOpen ? (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.18 }}
            className={`border-t px-4 py-3 md:hidden ${isDark ? "border-white/10" : "border-[#5A7863]/15"}`}
          >
            <div className="space-y-1">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setIsMenuOpen(false)}
                  className={`block rounded-lg px-3 py-2 text-sm font-medium transition ${navText}`}
                >
                  {link.label}
                </Link>
              ))}
              <Link
                href={AUTH_PATH.LOGIN}
                onClick={() => setIsMenuOpen(false)}
                className={`mt-2 flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition ${primary}`}
              >
                <Terminal className="h-4 w-4" />
                Sign in
              </Link>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.header>
  );
}
