"use client";

/**
 * Theme hook.
 *
 * Wraps the inline-bootstrap script in `app/layout.tsx`. The bootstrap reads
 * `localStorage.gent-theme` *before* paint so we never flash the wrong theme;
 * this hook keeps the runtime state in sync once React mounts.
 */
import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "gent-theme";
export type ThemeMode = "light" | "dark";

function resolveInitial(): ThemeMode {
  if (typeof window === "undefined") return "light";
  const stored = localStorage.getItem(STORAGE_KEY) as ThemeMode | null;
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function useTheme() {
  const [theme, setTheme] = useState<ThemeMode>("light");

  useEffect(() => {
    setTheme(resolveInitial());
  }, []);

  const apply = useCallback((mode: ThemeMode) => {
    const root = document.documentElement;
    // Add the transition class for the duration of the swap, then remove it
    // so it doesn't interfere with normal hover/focus transitions.
    root.classList.add("theme-transition");
    root.classList.toggle("dark", mode === "dark");
    localStorage.setItem(STORAGE_KEY, mode);
    setTheme(mode);
    window.setTimeout(() => root.classList.remove("theme-transition"), 400);
  }, []);

  const toggle = useCallback(() => {
    apply(theme === "dark" ? "light" : "dark");
  }, [apply, theme]);

  return { theme, setTheme: apply, toggle };
}
