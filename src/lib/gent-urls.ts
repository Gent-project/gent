/**
 * Helpers that build URLs and command snippets the **CLI** consumes.
 *
 * The Gent CLI (npm package `gent-cli`) parses clone URLs with this regex:
 *   /\/api\/repos\/(\d+)\/([^/]+)\/?$/
 *
 * Anything we surface to the user that they'll paste back into a terminal
 * must match that shape, otherwise they get:
 *   ✖ Invalid repository URL
 *   Expected format: /api/repos/{owner_id}/{repo_name}
 *
 * Keep all URL/command construction in this file so it stays consistent across
 * the dashboard, project page, files page and interactive guide modal.
 */
import { API_BASE_URL } from "@/lib/api-client";

/** Public npm name of the CLI binary. Used in install instructions. */
export const CLI_NPM_PACKAGE = "gent-cli";

/**
 * Build the CLI-accepted clone URL for a repository.
 *
 * @example
 *   repoCloneUrl(10, "first-project")
 *   // → "https://gent-api.onrender.com/api/repos/10/first-project"
 */
export function repoCloneUrl(ownerId: number | string, name: string): string {
  // API_BASE_URL already ends with `/api` — strip a trailing slash if any so
  // we don't end up with `/api//repos/…`.
  const base = API_BASE_URL.replace(/\/$/, "");
  return `${base}/repos/${ownerId}/${encodeURIComponent(name)}`;
}

/** `gent clone <url>` snippet shown next to the URL in the UI. */
export function cloneCommand(ownerId: number | string, name: string): string {
  return `gent clone ${repoCloneUrl(ownerId, name)}`;
}

/** `npm i -g gent-cli` snippet used in onboarding and the CLI page. */
export const installCommand = `npm i -g ${CLI_NPM_PACKAGE}`;
