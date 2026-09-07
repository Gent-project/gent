import type { UserProfile } from "@/types/user";

export function getDisplayName(user: UserProfile | null | undefined): string {
  if (!user) return "User";

  const fromParts = [user.first_name, user.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();

  if (fromParts) return fromParts;
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

/**
 * Owner handle for a repository. Prefers the username, which every response
 * carries; falls back to the email local part for older cached payloads.
 * Public discovery responses never include an email.
 *
 * This is the URL/routing identity - use `getRepoOwnerName` for anything the
 * reader is meant to read as a person's name.
 */
export function getRepoOwner(repo: {
  owner_username?: string;
  owner_email?: string;
}): string {
  if (repo.owner_username) return repo.owner_username;
  if (repo.owner_email) return repo.owner_email.split("@")[0];
  return "user";
}

/**
 * Human-readable owner label. `owner_name` is the server's full name and is an
 * empty string when the account has no first/last name, so fall through to the
 * handle rather than showing a blank.
 */
export function getRepoOwnerName(repo: {
  owner_name?: string;
  owner_username?: string;
  owner_email?: string;
}): string {
  if (repo.owner_name?.trim()) return repo.owner_name.trim();
  return getRepoOwner(repo);
}

/**
 * Human-readable label for a repository member. `display_name` mirrors the
 * server's `get_full_name`, which is blank for accounts without a real name.
 */
export function getMemberName(member: {
  display_name?: string;
  first_name?: string;
  username?: string;
  email?: string;
}): string {
  if (member.display_name?.trim()) return member.display_name.trim();
  if (member.first_name?.trim()) return member.first_name.trim();
  if (member.username) return member.username;
  if (member.email) return member.email.split("@")[0];
  return "User";
}
