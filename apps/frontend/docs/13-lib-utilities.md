# 13 — `lib/` Utilities

`src/lib/` holds modules used across the app that aren't React components,
hooks, or services.

| File              | Exports                                                                                  |
|-------------------|------------------------------------------------------------------------------------------|
| `api-client.ts`   | `api`, `tokenStore`, `API_BASE_URL`, `readApiError`                                       |
| `paths.ts`        | `PATHS` (all client-side routes)                                                         |
| `utils.ts`        | `cn`, `timeAgo`, `shortSha`, `avatarColors`, `isBrowser` (and others)                   |
| `gent-urls.ts`    | `gentCloneUrl(owner, name)` (and possibly more URL helpers for the CLI snippet UI)        |
| `cli-commands.ts` | `CLI_COMMANDS` — canonical data for the `/cli` explorer                                  |

---

## `api-client.ts`

The axios instance and token plumbing. Detailed in
[09-authentication.md](./09-authentication.md). Quick reference:

```ts
import { api, tokenStore, readApiError, API_BASE_URL } from "@/lib/api-client";

// Make a request (only do this in services!)
const { data } = await api.get("/some/endpoint/");

// Inspect tokens
tokenStore.getAccess();
tokenStore.getRefresh();
tokenStore.getUser();

// Read a friendly error message
toast.error(readApiError(error));
```

---

## `paths.ts`

Centralised, typed route paths. Always use these — never hardcode URLs at
call sites.

```ts
PATHS.home                                       // "/"
PATHS.cli                                        // "/cli"
PATHS.auth.login                                 // "/auth/login"
PATHS.auth.signup                                // "/auth/signup"
PATHS.app.dashboard                              // "/app"
PATHS.app.newProject                             // "/app/new"
PATHS.app.settings                               // "/app/settings"
PATHS.app.project(ownerId, name)                 // "/app/<id>/<name>"
PATHS.app.projectFiles(ownerId, name)            // "/app/<id>/<name>/files"
PATHS.app.projectCli(ownerId, name)              // "/app/<id>/<name>/cli"
```

When you add a new route:

1. Add the path to `paths.ts`.
2. Use `PATHS.x` everywhere it's linked from.
3. Mention the route in [04-routing-and-pages.md](./04-routing-and-pages.md).

---

## `utils.ts`

A handful of pure helpers. The important ones:

### `cn(...inputs)`

```ts
import { cn } from "@/lib/utils";
<div className={cn("p-4", isActive && "bg-accent", className)} />
```

Wraps `clsx` and `tailwind-merge`. Use it whenever you compose Tailwind
classes from props — it dedupes and resolves conflicts (`p-2 p-4` → `p-4`).

### `timeAgo(iso: string): string`

Returns "2 minutes ago", "yesterday", "Jun 12, 2025" etc. depending on how
recent the date is. Used for every commit, branch, and tag timestamp.

### `shortSha(sha: string): string`

Returns the first 7 chars of a SHA. The convention used in `<CommitTimeline>`,
`<BranchList>`, `<TagList>`, and the file viewer's URL bar.

### `avatarColors(seed: string): { bg, fg }`

Hashes a string (typically an email) to a stable HSL pair for the `<Avatar>`
fallback. Same input always returns the same color, so the same user has a
consistent badge across sessions.

### `isBrowser(): boolean`

`typeof window !== "undefined"`. Used in `tokenStore` and any place that
must guard SSR — even though the app is mostly client-rendered, Next still
runs module top-level code on the server.

---

## `gent-urls.ts`

Helpers for the CLI snippets that appear on `/app/new` and the project
detail page.

```ts
gentCloneUrl(owner, name)
// "https://gent.app/<owner>/<name>.git" (or whatever the canonical form is)
```

Keeping these in one file means a URL scheme change is a one-line edit, not
a sweep through every component that displays a clone block.

---

## `cli-commands.ts`

The static, in-app source of truth for the CLI explorer. Each entry:

```ts
type CliCommand = {
  name: string;          // "gent push"
  summary: string;       // one-line description
  usage: string;         // canonical signature
  examples: string[];    // copy-paste-ready snippets
  tags: string[];        // for filtering: "auth", "network", "safety", ...
};
```

Why static and not from the API?

- The CLI ships its own commands; the API doesn't expose them.
- Updates here are part of the frontend release cycle — no fetch on page load.
- Filtering, searching, and copy-buttons all work offline.

To add a command, append to the `CLI_COMMANDS` array and verify the page
re-renders.
