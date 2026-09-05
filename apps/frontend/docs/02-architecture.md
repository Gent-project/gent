# 02 — Architecture

The frontend is a **four-layer Next.js 16 application** that wraps a thin,
typed client around the Gent REST API. Each layer has a single responsibility
and depends only on the layer beneath it.

```
┌──────────────────────────────────────────────────────────────────────┐
│ src/app/**                  Routes (App Router, RSC + client islands) │
│                             — receives params, renders UI            │
├──────────────────────────────────────────────────────────────────────┤
│ src/components/features/**  Composed feature components               │
│ src/components/{ui,layout}  Primitive + shell components              │
├──────────────────────────────────────────────────────────────────────┤
│ src/hooks/**                React state — TanStack Query + Redux glue │
│                             — owns loading/error/polling/optimism     │
├──────────────────────────────────────────────────────────────────────┤
│ src/services/**             Pure typed HTTP wrappers                  │
│ src/lib/api-client.ts       axios instance + token store + refresh    │
├──────────────────────────────────────────────────────────────────────┤
│        Gent REST API  (https://gent-api.onrender.com/api/)           │
└──────────────────────────────────────────────────────────────────────┘
```

Each arrow points downward. **Pages never import services directly** — they
always go through a hook. **Services never read storage or render UI** — they
just call axios and return parsed data. This discipline keeps the surface
between layers small and lets us swap any one of them without rewriting the
others.

---

## Why this shape

1. **The backend is the source of truth.** The Django REST service stores
   commits, branches, and tags. The frontend is a read-mostly view that polls
   for changes. We optimise for low ceremony per fetch, not local persistence.
2. **The CLI and the web hit the same API.** A `gent push` from a terminal
   must appear on the web within seconds. That is achieved by polling, not by
   websockets, because the API does not (yet) expose a streaming endpoint.
3. **JWT in `localStorage` is good enough.** The threat model is small (we are
   not handling payments). Tokens auto-refresh on 401 inside axios. We can
   migrate to cookies later without touching call sites because the token
   store is isolated in `tokenStore` in `lib/api-client.ts`.
4. **Some "git" features are derived in the browser.** The API exposes trees and
   blobs but no diff endpoint, so commit diffs and per-file "last commit" blame
   are computed client-side in `src/lib/diff.ts` (consumed by `useCommitDiff`
   and `useDirLastCommits`). The pattern stays the same — a hook owns the work
   and feeds a presentational component — the data source is just the layers
   below rather than a single endpoint.

---

## The four layers in detail

### Layer 1 — Routes (`src/app/`)

Next.js App Router. Files named `page.tsx` are routes; `layout.tsx` files are
shared shells. Pages are kept thin: they read URL params, render a shell, and
delegate state to hooks.

A typical page (`/app/[ownerId]/[name]/page.tsx`):

```tsx
"use client";
export default function ProjectPage({ params }: { params: { ownerId: string; name: string } }) {
  const { data: repo, isLoading } = useRepoDetail(params.ownerId, params.name);
  const { data: branches } = useBranches(params.ownerId, params.name);
  const { data: commits } = useCommits(params.ownerId, params.name);

  if (isLoading) return <ProjectSkeleton />;
  return <ProjectView repo={repo} branches={branches} commits={commits} />;
}
```

That's the whole pattern. See [04-routing-and-pages.md](./04-routing-and-pages.md).

### Layer 2 — Components

Three buckets:

- **`ui/`** — primitives like `Button`, `Input`, `Card`, `Modal`. Stateless,
  themed, used everywhere.
- **`layout/`** — page shells (`MarketingNav`, `AuthShell`, `AppShell`). They
  own navigation and the surrounding chrome.
- **`features/`** — domain components like `BranchList`, `CommitTimeline`,
  `CreateProjectModal`. They consume hooks and render UI; they do not call
  axios.

See [05-components/](./05-components/).

### Layer 3 — Hooks (`src/hooks/`)

Every server-derived value is a TanStack Query hook. Each file groups related
queries and mutations:

| File           | Exports                                                                             |
|----------------|-------------------------------------------------------------------------------------|
| `use-auth.ts`  | `useAuth()` — current user, login, register, logout                                 |
| `use-repos.ts` | `useReposList`, `useRepoDetail`, `useCreateRepo`, `useDeleteRepo`                   |
| `use-git.ts`   | `useBranches`, `useCommits`, `useTags`, `useBranchCommit`, `useTree`, `useBlob`, `useCommitDiff`, `useDirLastCommits` |
| `use-theme.ts` | `useTheme()` — light/dark with no-flash bootstrap                                   |

Hooks own caching, polling, optimistic updates, and toast notifications. See
[10-hooks-reference.md](./10-hooks-reference.md).

### Layer 4 — Services + API client

`src/services/*.service.ts` are plain TypeScript objects that call axios and
return typed data. They never touch React. Pattern:

```ts
export const reposService = {
  async list(): Promise<Repository[]> {
    const { data } = await api.get<Repository[]>("/repos/");
    return data;
  },
  // ...
};
```

`src/lib/api-client.ts` owns the axios instance, the token store, the request
interceptor (adds `Authorization: Bearer ...`), and the response interceptor
(refresh-on-401). See [09-authentication.md](./09-authentication.md).

---

## State management at a glance

Two systems coexist on purpose:

- **TanStack Query** owns *server* state — anything that exists because the
  API said so (user profile, repos, branches, commits, tags).
- **Redux Toolkit** owns *client* state we want to share globally — currently
  the auth token (so non-React code can read it) and the theme.

This is a deliberate split: TanStack Query is the only system that should
cache anything fetched from the API. Redux is the small global store for
things React Context could also do, but that we prefer to centralize.

See [06-state-management.md](./06-state-management.md).

---

## Rendering model

- All routes are **client components** by default — every page is marked
  `"use client"` because the data is JWT-gated and lives in `localStorage`,
  which a server component cannot read. The marketing landing page is a
  client component too (it animates heavily and reads theme).
- The **app shell** (`AppShell`, `MarketingNav`) is shared via `layout.tsx`
  files. They subscribe to `useAuth()` for the user chip and avatar.
- **No SSR data fetching is wired up** — there is no `loader.ts`/`route.ts`
  hitting the API on the server. The browser does all fetching, with hydration
  handled by TanStack Query's `hydrate`/`dehydrate`.

This keeps the architecture simple and the server bundle small. If we ever
need SEO for project pages, the path is: add a server component, fetch from
the API in `generateMetadata`, hand the rest off to the existing client
components.

---

## Where things are tested in real life

There are no unit tests committed yet. The current verification loop is:

1. `npm run dev`
2. Hit the live API with the test credentials.
3. Run `gent push` from the CLI in another terminal.
4. Verify the new commit shows up on the web within 12s.

A roadmap for proper tests is in [18-testing.md](./18-testing.md).

---

## Where to go next

- See **how every route is wired** → [04-routing-and-pages.md](./04-routing-and-pages.md)
- See **every API call we make** → [08-api-integration.md](./08-api-integration.md)
- See **how the design system is built** → [14-design-system.md](./14-design-system.md)
