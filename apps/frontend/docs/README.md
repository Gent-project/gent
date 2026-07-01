# Gent Frontend — Documentation

Welcome to the documentation for the **Gent Web Frontend** — the Next.js 16
application that powers `https://gent.app` and talks to the Django REST API at
`https://gent-api.onrender.com/api/`.

This `docs/` folder is the long-form companion to the app's `README.md`. If the
README tells you *how to run it*, the docs tell you *how it is built, why it is
built that way, and how to extend it*.

> **Location.** The frontend lives at **`apps/frontend/`** inside the Gent
> monorepo (alongside `apps/Cli/` and `apps/server/`). All paths and commands in
> these docs are relative to `apps/frontend/` unless stated otherwise.

---

## How the docs are organised

The files are numbered so they read top-to-bottom like a book, but each file is
self-contained and links to the others. Jump to whatever you need.

| #  | File                                                         | What's inside                                                                              |
|----|--------------------------------------------------------------|--------------------------------------------------------------------------------------------|
| 01 | [getting-started.md](./01-getting-started.md)                | Install, environment variables, dev/build/lint scripts, test credentials.                  |
| 02 | [architecture.md](./02-architecture.md)                      | The four-layer architecture (App Router → hooks → services → API).                         |
| 03 | [project-structure.md](./03-project-structure.md)            | Every folder under `src/` explained.                                                       |
| 04 | [routing-and-pages.md](./04-routing-and-pages.md)            | Every route in the App Router, with purpose, data sources, and screenshots of the layout.  |
| 05 | [components/](./05-components/)                              | Detailed reference for every component (UI, layout, features, providers).                  |
| 06 | [state-management.md](./06-state-management.md)              | Redux Toolkit slices + TanStack Query — when each is used.                                 |
| 07 | [data-fetching.md](./07-data-fetching.md)                    | Polling intervals, cache keys, optimistic updates, invalidation.                           |
| 08 | [api-integration.md](./08-api-integration.md)                | Endpoint-by-endpoint mapping between the REST API and the frontend.                        |
| 09 | [authentication.md](./09-authentication.md)                  | JWT flow, refresh token rotation, the 401 interceptor, token storage.                      |
| 10 | [hooks-reference.md](./10-hooks-reference.md)                | API reference for every custom hook in `src/hooks/`.                                       |
| 11 | [services-reference.md](./11-services-reference.md)          | API reference for every service in `src/services/`.                                        |
| 12 | [types-reference.md](./12-types-reference.md)                | TypeScript contracts in `src/types/api.ts`.                                                |
| 13 | [lib-utilities.md](./13-lib-utilities.md)                    | Helpers in `src/lib/` (api-client, paths, utils, cli-commands).                            |
| 14 | [design-system.md](./14-design-system.md)                    | Color tokens, typography (Cairo), motion (framer-motion), light/dark mode.                 |
| 15 | [styling-and-tailwind.md](./15-styling-and-tailwind.md)      | Tailwind v4 setup, custom properties, `cn()`, the `theme-transition` class.                |
| 16 | [environment-and-config.md](./16-environment-and-config.md)  | `.env.local`, build-time vs runtime variables, `next.config.ts`.                           |
| 17 | [build-and-deployment.md](./17-build-and-deployment.md)      | Turbopack, production build, deploying to Vercel / Render / a Node host.                   |
| 18 | [testing.md](./18-testing.md)                                | Test strategy, recommended tools, the live API smoke-test approach.                        |
| 19 | [troubleshooting.md](./19-troubleshooting.md)                | Common errors, what they mean, and how to fix them.                                        |
| 20 | [contributing.md](./20-contributing.md)                      | Branching, commit style, code review expectations.                                         |

---

## Quick map of the codebase

```
gent/                                   ← monorepo root (apps/Cli, apps/server, apps/frontend)
└─ apps/frontend/                       ← THIS app (frontend project root)
   ├─ docs/                             ← you are here
   ├─ src/
   │  ├─ app/                           ← Next.js App Router routes
   │  ├─ components/
   │  │  ├─ ui/                         ← primitive design-system components
   │  │  ├─ layout/                     ← page shells (marketing, auth, app)
   │  │  ├─ features/                   ← domain-specific composed components
   │  │  └─ providers/                  ← Redux + TanStack Query glue
   │  ├─ hooks/                         ← `useAuth`, `useRepos`, `useGit`, `useTheme`
   │  ├─ services/                      ← typed REST wrappers
   │  ├─ lib/                           ← `api-client`, `paths`, `utils`, `diff`, `cli-commands`
   │  ├─ store/                         ← Redux slices (auth, theme)
   │  └─ types/                         ← `api.ts` — single source of truth for API shapes
   ├─ public/                           ← static assets
   ├─ next.config.ts
   ├─ tailwind.config.* (Tailwind v4 — config-less, via PostCSS plugin)
   ├─ tsconfig.json
   └─ package.json
```

---

## Conventions used in these docs

- **File paths** are written relative to the frontend project root
  (`apps/frontend/`) unless otherwise stated.
- **`{ownerId}` and `{name}`** are the two route params that identify a repo
  (e.g. `1/my-app`).
- A line like `POST /auth/login/` always refers to a path on the Gent REST API
  (`https://gent-api.onrender.com/api/...`).
- Code blocks are TypeScript unless tagged otherwise.

---

## Where to start

- New to the project? Read in order: 01 → 02 → 03 → 04.
- Adding a new page? Read 03, 04, 07, 09.
- Adding a new API call? Read 08, 11, 10 (in that order).
- Polishing the UI? Read 05, 14, 15.
- Debugging? Jump to 19.
