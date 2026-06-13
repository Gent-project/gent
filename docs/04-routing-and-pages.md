# 04 — Routing & Pages

Gent uses the **Next.js 16 App Router**. Every URL maps 1:1 to a folder under
`src/app/`. A folder must contain a `page.tsx` to be a route. `layout.tsx`
files wrap their segment and every child segment.

This document covers every route in the app: what it shows, which hooks it
calls, which components it composes, and any access rules.

---

## Route table (at a glance)

| Route                            | Auth required | Renders                                      | Data sources                              |
|----------------------------------|---------------|----------------------------------------------|-------------------------------------------|
| `/`                              | no            | Marketing landing                             | none                                      |
| `/cli`                           | no            | Interactive CLI explorer                      | `src/lib/cli-commands.ts` (static)        |
| `/faq`                           | no            | Static FAQ                                    | none                                      |
| `/privacy`                       | no            | Privacy policy                                | none                                      |
| `/terms`                         | no            | Terms of service                              | none                                      |
| `/auth/login`                    | redirects when authed | Login form                            | `useAuth().login`                         |
| `/auth/signup`                   | redirects when authed | Registration form                     | `useAuth().register`                      |
| `/app`                           | yes           | Dashboard (project grid + stats)              | `useReposList`                            |
| `/app/new`                       | yes           | Create-project form + CLI snippet             | `useCreateRepo`                           |
| `/app/settings`                  | yes           | Profile + theme picker                        | `useAuth()`, `useTheme()`                 |
| `/app/[ownerId]/[name]`          | yes           | Project detail                                | `useRepoDetail`, `useBranches`, `useCommits`, `useTags` |
| `/app/[ownerId]/[name]/files`    | yes           | File browser (tree + blob viewer)             | `useBranchCommit`, `useTree`, `useBlob`   |

---

## Layouts

Layouts apply to every page below them.

### `src/app/layout.tsx` — root layout

Wraps every route in the app. Responsibilities:

1. Load **Cairo** font with `next/font` and set it as the body font.
2. Inline a tiny `<script>` in `<head>` that reads `localStorage.gent-theme`
   and applies `dark` class to `<html>` **before paint**. This prevents the
   flash of wrong theme on first load.
3. Mount `<Providers>` — Redux store, TanStack QueryClient, Sonner toaster.
4. Default metadata (title, description, og tags).

> Do not add layout-level data fetching here. Anything you need in every
> route belongs in `<Providers>` (a client component) or in the page itself.

### `src/app/app/layout.tsx` — authenticated shell

Wraps every route under `/app/*`. It:

1. Reads `useAuth()` and redirects to `/auth/login` if there is no user.
2. Renders `<AppShell>` with the topbar, user chip, and navigation.
3. Slots the page into the main content area.

Every page under `/app/` therefore gets the same chrome for free — pages
themselves are pure content.

---

## Page-by-page reference

### `/` — Marketing landing

`src/app/page.tsx`

- **Composition**: `<MarketingNav>`, hero with animated terminal,
  features grid, "how it works" section, CTA, `<MarketingFooter>`.
- **Key components**: `AnimatedTerminal` (from `features/cli/`), `Button`,
  `Card`, `Badge`.
- **Animation**: framer-motion `staggerChildren` on the features grid; the
  terminal types out a `gent push` sequence on a loop.
- **Auth**: ignored. Authed users see the same page; they can navigate to
  `/app` from the nav.

### `/cli` — Interactive CLI Explorer

`src/app/cli/page.tsx`

- Reads **`CLI_COMMANDS`** from `src/lib/cli-commands.ts` — a static array of
  every command, its description, usage examples, and tags.
- Renders a left rail of categories, a searchable list, and a detail panel
  that shows the command + a copy-to-clipboard button.
- Powered by `CommandCard` (`components/features/cli/command-card.tsx`).
- Completely static — no API calls, no auth.

### `/faq`, `/privacy`, `/terms`

`src/app/{faq,privacy,terms}/page.tsx`

- Pure content pages. Each uses the `<MarketingPage>` shell to inherit the
  marketing nav + footer. Edit the JSX in place — there is no CMS.

### `/auth/login`

`src/app/auth/login/page.tsx`

- Shell: `<AuthShell>` — split-screen with brand image on one side, form on the other.
- Form: email + password with `<TextField>` primitives.
- On submit, calls `useAuth().login({ email, password })`. On success, the
  hook stores the tokens, sets the user in Redux, and `router.push('/app')`.
- Error states surface as Sonner toasts (`readApiError(err)` parses the body).
- If `useAuth().isAuthenticated` is already true on mount, the page redirects
  to `/app` immediately.

### `/auth/signup`

`src/app/auth/signup/page.tsx`

- Same shape as login. Fields: first name, last name, email, password,
  confirm password.
- Calls `useAuth().register(...)`. The API can choose to auto-log-in
  (returning tokens) or not (returning just the user) — the hook handles both.

### `/app` — Dashboard

`src/app/app/page.tsx`

- Calls `useReposList()`. Shows a grid of `<ProjectCard>`s and a "new project"
  CTA.
- Stats strip at the top counts public/private repos.
- Empty state: `<EmptyState>` primitive with a CTA to `/app/new`.
- Loading: `<Skeleton>` cards while the query is in flight.

### `/app/new` — Create project

`src/app/app/new/page.tsx`

- Form: `name`, `description`, `is_private` toggle, `default_branch` (default
  `main`).
- On submit, calls `useCreateRepo()`. On success, `router.push` to the
  newly-created project's page.
- Side panel: a copy-able `gent` CLI snippet that clones / pushes the new
  repo. The clone URL is built by `gentCloneUrl(owner, name)` in
  `src/lib/gent-urls.ts`.

### `/app/settings`

`src/app/app/settings/page.tsx`

- Reads `useAuth().user` to show the email, first name, last name, and join date.
- Reads `useTheme()` to render the light/dark picker (`<ThemeToggle>`).
- Currently read-only: there is no `PATCH /auth/profile/` wired up. Adding it
  is straightforward — extend `authService` and `useAuth()`.

### `/app/[ownerId]/[name]` — Project detail

`src/app/app/[ownerId]/[name]/page.tsx`

The flagship screen. It composes four data sources:

```tsx
const { data: repo }     = useRepoDetail(ownerId, name);
const { data: branches } = useBranches(ownerId, name);   // polls every 12s
const { data: commits }  = useCommits(ownerId, name);    // polls every 12s
const { data: tags }     = useTags(ownerId, name);       // polls every 12s
```

Layout:

- Header: repo name, owner avatar, private/public badge, "live" pulse dot.
- Clone URL block (read from `gentCloneUrl`) with copy button.
- Tabs:
  - **Commits** → `<CommitTimeline>` — vertical timeline with author chips,
    short SHAs, relative time (`timeAgo()`), commit messages.
  - **Branches** → `<BranchList>` — branch name, latest commit SHA, age.
  - **Tags** → `<TagList>` — tag name, target SHA, annotated/not.
- "Open file browser" button → `/app/[ownerId]/[name]/files`.
- "Interactive guide" modal — `<InteractiveGuideModal>` walks new users
  through `clone → edit → push`.

### `/app/[ownerId]/[name]/files` — File browser

`src/app/app/[ownerId]/[name]/files/page.tsx`

- Branch picker (default = `repo.default_branch`).
- Calls `useBranchCommit` to resolve the branch tip → commit.
- From `commit.tree_sha`, calls `useTree` to load directory entries.
- Renders rows with `<FileTreeRow>` (folder vs blob icon, name, mode).
- Clicking a blob calls `useBlob(blobSha)` and opens `<FileViewer>` —
  - utf-8 → render with line numbers
  - base64 → "binary file" placeholder with size in KB
- Uses `isEmptySha(sha)` to short-circuit brand-new empty branches.

---

## Linking between pages

Always import from `src/lib/paths.ts`:

```tsx
import Link from "next/link";
import { PATHS } from "@/lib/paths";

<Link href={PATHS.app.project(repo.owner_id, repo.name)}>{repo.name}</Link>
<Link href={PATHS.auth.login}>Sign in</Link>
```

Never hardcode `/app/${id}/${name}` at call sites — if a route ever moves,
you want one place to update.

---

## Auth guards

There is **no middleware** in this repo. Auth checks are done in client
components:

- `src/app/app/layout.tsx` redirects to `/auth/login` when there is no token.
- `/auth/login` and `/auth/signup` redirect to `/app` when the user is
  already authenticated.

If you add a new protected segment, put it under `src/app/app/` so it inherits
the guard automatically.

---

## Adding a new page — recipe

1. Create the folder under `src/app/<segment>/` and add `page.tsx`.
2. If the page needs the user, mark it `"use client"` and read `useAuth()`.
3. Compose existing primitives (`Button`, `Card`, `EmptyState`...).
4. If you need new data, extend `src/services/*.ts` and add a hook in
   `src/hooks/*.ts` — do not call axios from the page.
5. Add the route to `src/lib/paths.ts` so other pages can link to it.
6. Update the **Route table** at the top of this file.
