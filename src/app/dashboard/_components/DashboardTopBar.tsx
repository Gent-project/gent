"use client";

import { Search, Plus, Menu, Moon, Sun } from "lucide-react";
import { getDashboardTheme } from "./dashboard-theme";

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
      className="sticky top-0 z-30 flex items-center gap-3 px-4 py-3 border-b backdrop-blur-xl"
      style={{
        backgroundColor: t.topBarBg,
        borderColor: t.border,
      }}
    >
      <button
        type="button"
        onClick={onMenuOpen}
        className="p-2 rounded-md lg:hidden transition-colors"
        style={{ color: t.textMuted }}
        aria-label="Open sidebar"
      >
        <Menu className="w-5 h-5" />
      </button>

      <div className="flex-1 max-w-xl relative">
        <Search
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
          style={{ color: t.textMuted }}
        />
        <input
          type="search"
          placeholder="Find a repository…"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full pl-10 pr-4 py-2 text-sm rounded-md border outline-none transition-shadow focus:ring-2"
          style={{
            backgroundColor: t.inputBg,
            borderColor: t.border,
            color: t.text,
          }}
        />
      </div>

      <span
        className="hidden sm:inline text-xs font-medium px-2 py-1 rounded-full"
        style={{
          backgroundColor: t.sidebarActive,
          color: t.textMuted,
        }}
      >
        {repoCount} repos
      </span>

      <button
        type="button"
        onClick={onToggleTheme}
        className="p-2 rounded-md transition-colors hidden sm:flex"
        style={{ color: t.textMuted }}
        aria-label="Toggle theme"
      >
        {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
      </button>

      <button
        type="button"
        onClick={onNewRepo}
        className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition-all shrink-0 hover:shadow-lg"
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
