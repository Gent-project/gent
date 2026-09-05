/**
 * Top-level path segments that must never be treated as a username.
 *
 * `/[username]` is a root-level dynamic segment. Next.js already gives static
 * routes priority, so these resolve to their real pages; this list stops a
 * typo'd URL from silently becoming a profile lookup.
 */
export const RESERVED_SLUGS = new Set([
  "api",
  "auth",
  "cli",
  "dashboard",
  "explore",
  "faq",
  "home",
  "how-it-works",
  "privacy",
  "services",
  "terms",
]);

export const isReservedSlug = (slug: string) =>
  RESERVED_SLUGS.has(slug.toLowerCase());
