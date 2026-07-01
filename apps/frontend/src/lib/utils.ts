import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * `cn` — class-name composer.
 *
 * Combines `clsx` (handles conditional / nested class objects) with
 * `tailwind-merge` (de-dupes conflicting Tailwind utilities so the last one
 * wins). Use this any time you build a className from multiple sources.
 *
 * @example
 *   <div className={cn("p-4 rounded-md", isActive && "bg-primary text-on-primary")} />
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Returns a short, human-readable git-style sha for display.
 * Falls back gracefully if the value is shorter than the slice.
 */
export function shortSha(sha?: string | null, length = 7): string {
  if (!sha) return "—";
  return sha.length > length ? sha.slice(0, length) : sha;
}

/**
 * Format a Date / ISO string as "N minutes ago", "yesterday", etc.
 * Pure (no locale dependency) so it works the same on server and client.
 */
export function timeAgo(value: string | number | Date): string {
  const date =
    typeof value === "string" || typeof value === "number" ? new Date(value) : value;
  const diff = Date.now() - date.getTime();
  const sec = Math.max(1, Math.floor(diff / 1000));
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  const mo = Math.floor(day / 30);
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.floor(mo / 12)}y ago`;
}

/**
 * Stable, deterministic colour pair for an avatar bubble, derived from a seed
 * (email, username, repo name). Uses CSS variables so it follows light/dark.
 */
export function avatarColors(seed: string) {
  const palettes: Array<{ bg: string; fg: string }> = [
    { bg: "var(--primary)", fg: "var(--on-primary)" },
    { bg: "var(--secondary)", fg: "var(--on-secondary)" },
    { bg: "var(--tertiary)", fg: "var(--on-tertiary)" },
    { bg: "var(--primary-container)", fg: "var(--on-primary-container)" },
    { bg: "var(--secondary-container)", fg: "var(--on-secondary)" },
  ];
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return palettes[hash % palettes.length];
}

/** Pull the leading initial(s) from a name or email for avatar fallback. */
export function initials(value?: string | null): string {
  if (!value) return "?";
  const cleaned = value.includes("@") ? value.split("@")[0] : value;
  const parts = cleaned.split(/[\s._-]+/).filter(Boolean);
  if (parts.length === 0) return cleaned.slice(0, 2).toUpperCase();
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

/** Detect a runtime that has `window` available (Next.js SSR safety). */
export function isBrowser(): boolean {
  return typeof window !== "undefined";
}
