"use client";

import { Search, Plus, Menu, Moon, Sun } from "lucide-react";
import { getDashboardTheme } from "./dashboard-theme";
import GlobalSearch from "@/components/search/GlobalSearch";
import { LanguageToggle } from "@/app/language-provider";

interface DashboardTopBarProps {
  isDark: boolean;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  onNewRepo: () => void;
  onToggleTheme: () => void;
  onMenuOpen: () => void;
  repoCount: number;
}

export default function DashboardTopBar({
  isDark,
  searchQuery,
  onSearchChange,
  onNewRepo,
  onToggleTheme,
  onMenuOpen,
  repoCount,
}: DashboardTopBarProps) {
  const t = getDashboardTheme(isDark);

  return (
    <header
      className="sticky top-0 z-30 flex items-center gap-3 border-b px-4 py-3 backdrop-blur-2xl sm:px-6"
      style={{
        backgroundColor: t.topBarBg,
        borderColor: t.border,
      }}
    >
      <button
        type="button"
        onClick={onMenuOpen}
        className="rounded-xl border p-2 transition-colors lg:hidden"
        style={{ color: t.textMuted, borderColor: t.border, background: t.inputBg }}
        aria-label="Open sidebar"
      >
        <Menu className="w-5 h-5" />
      </button>

      <div className="relative max-w-2xl flex-1">
        <Search
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
          style={{ color: t.textMuted }}
        />
        <input
          type="search"
          placeholder="Find a repository…"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full rounded-xl border py-2.5 pl-10 pr-4 text-sm shadow-sm outline-none transition-all focus:ring-2"
          style={{
            backgroundColor: t.inputBg,
            borderColor: t.border,
            color: t.text,
          }}
        />

      </div>

      <GlobalSearch className="hidden min-w-0 max-w-xs flex-1 lg:block" />

      <span
        className="hidden rounded-full border px-2.5 py-1 font-mono text-[10px] font-medium sm:inline"
        style={{
          backgroundColor: t.sidebarActive,
          color: t.textMuted,
          borderColor: t.border,
        }}
      >
        {repoCount} repos
      </span>

      <button
        type="button"
        onClick={onToggleTheme}
        className="hidden rounded-xl border p-2 transition-colors sm:flex"
        style={{ color: t.textMuted, borderColor: t.border, background: t.inputBg }}
        aria-label="Toggle theme"
      >
        {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
      </button>

      <LanguageToggle
        className="hidden items-center justify-center rounded-xl border px-3 py-2 text-xs font-bold transition-colors sm:flex"
        style={{
          backgroundColor: t.elevated,
          borderColor: t.border,
          color: t.textMuted,
        }}
      />

      <button
        type="button"
        onClick={onNewRepo}
        className="flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-semibold shadow-lg transition-all hover:-translate-y-0.5"
        style={{
          background: t.accentGradient,
          color: t.successText,
        }}
      >
        <Plus className="w-4 h-4" />
        <span className="hidden sm:inline">New</span>
      </button>
    </header>
  );
}
