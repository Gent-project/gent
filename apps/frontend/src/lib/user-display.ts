import type { UserProfile } from "@/types/user";

export function getDisplayName(user: UserProfile | null | undefined): string {
  if (!user) return "User";

  const fromParts = [user.first_name, user.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();

  if (fromParts) return fromParts;
  if (user.name?.trim()) return user.name.trim();
  if (user.username) return user.username;
  if (user.email) return user.email.split("@")[0];

  return "User";
}

export function getInitials(user: UserProfile | null | undefined): string {
  if (!user) return "U";

  if (user.first_name || user.last_name) {
    const a = user.first_name?.[0] ?? "";
    const b = user.last_name?.[0] ?? "";
    const initials = `${a}${b}`.toUpperCase();
    if (initials) return initials;
  }

  const display = getDisplayName(user);
  const parts = display.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }

  return display.slice(0, 2).toUpperCase();
}

export function getUsername(user: UserProfile | null | undefined): string {
  if (!user) return "user";
  if (user.username) return user.username;
  if (user.email) return user.email.split("@")[0];
  return "user";
}
