# 03 — Project Structure

Every folder, file, and convention explained. If the architecture doc tells
you *why* the layers exist, this one tells you *where to put the file you are
about to write*.

---

## Monorepo layout

The frontend lives inside a small monorepo alongside the CLI and the backend.
The repo root is intentionally thin — it just holds the `apps/` and the deploy
manifest:

```
gent/                          ← monorepo root
├─ apps/
│  ├─ Cli/                     ← the `gent` CLI (Node)
│  ├─ server/                  ← the Django REST API
│  └─ frontend/                ← THIS app (the Next.js web frontend)
├─ render.yaml                 ← Render deploy manifest (all apps)
└─ .gitignore
```

Everything in these docs refers to **`apps/frontend/`** unless stated
otherwise. All install/run commands are run from that directory (`cd
apps/frontend`), not the repo root.

---

## App layout (`apps/frontend/`)

```
apps/frontend/
├─ .env.example                ← committed example env vars
├─ .env.local                  ← (gitignored) your local overrides
├─ .vscode/                    ← shared editor settings
├─ components.json             ← shadcn-style component generator config
├─ docs/                       ← this folder
├─ eslint.config.mjs           ← flat ESLint config (Next + TS rules)
├─ next.config.ts              ← Next.js config (kept intentionally minimal)
├─ next-env.d.ts               ← Next's generated TS shims (do not edit)
├─ package.json                ← deps + scripts
├─ package-lock.json           ← npm lockfile (committed, authoritative)
├─ postcss.config.mjs          ← Tailwind v4 PostCSS plugin
├─ public/                     ← static assets served at /
├─ README.md                   ← short app README
├─ src/                        ← all application code
└─ tsconfig.json               ← TS config (path aliases live here)
```

---

## `src/` — the application

```
src/
├─ app/                        ← Next.js App Router segments
│  ├─ layout.tsx               ← root layout: Cairo font, theme bootstrap, providers
│  ├─ page.tsx                 ← / — marketing landing
│  ├─ globals.css              ← design tokens + utilities
│  ├─ favicon.ico
│  │
│  ├─ cli/page.tsx             ← /cli — interactive CLI explorer
│  ├─ faq/page.tsx             ← /faq
│  ├─ privacy/page.tsx         ← /privacy
│  ├─ terms/page.tsx           ← /terms
│  │
│  ├─ auth/
│  │  ├─ login/page.tsx        ← /auth/login
│  │  └─ signup/page.tsx       ← /auth/signup
│  │
│  └─ app/                     ← authenticated zone — every page requires a JWT
│     ├─ layout.tsx            ← AppShell (sidebar/topnav, user chip)
│     ├─ page.tsx              ← /app — dashboard
│     ├─ new/page.tsx          ← /app/new — create project
│     ├─ settings/page.tsx     ← /app/settings — profile + theme
│     └─ [ownerId]/[name]/
│        ├─ page.tsx           ← /app/:ownerId/:name — project detail
│        └─ files/page.tsx     ← /app/:ownerId/:name/files — file browser
│
├─ components/
│  ├─ providers/
│  │  └─ providers.tsx         ← Redux store + QueryClient + Sonner toaster
│  │
│  ├─ ui/                      ← primitive design-system components
│  │  ├─ avatar.tsx
│  │  ├─ badge.tsx
│  │  ├─ button.tsx
│  │  ├─ card.tsx
│  │  ├─ empty-state.tsx
│  │  ├─ input.tsx
│  │  ├─ label.tsx
│  │  ├─ logo.tsx
│  │  ├─ modal.tsx
│  │  ├─ skeleton.tsx
│  │  └─ text-field.tsx
│  │
│  ├─ layout/                  ← page shells
│  │  ├─ app-shell.tsx
│  │  ├─ auth-shell.tsx
│  │  ├─ marketing-footer.tsx
│  │  ├─ marketing-nav.tsx
│  │  ├─ marketing-page.tsx
│  │  └─ theme-toggle.tsx
│  │
│  └─ features/
│     ├─ cli/
│     │  ├─ animated-terminal.tsx
│     │  └─ command-card.tsx
│     │
│     └─ projects/
│        ├─ branch-list.tsx
│        ├─ commit-diff.tsx          ← <CommitDiffPanel> (renders a commit diff)
│        ├─ commit-diff-modal.tsx    ← <CommitDiffModal> (loads the diff on open)
│        ├─ commit-timeline.tsx
│        ├─ create-project-modal.tsx
│        ├─ file-viewer.tsx
│        ├─ interactive-guide-modal.tsx
│        ├─ project-card.tsx
│        └─ tag-list.tsx
│
├─ hooks/
│  ├─ use-auth.ts              ← session + auth mutations
│  ├─ use-repos.ts             ← repo list / detail / create / delete
│  ├─ use-git.ts               ← branches / commits / tags / tree / blob,
│  │                             plus client-side commit diff + per-file blame
│  └─ use-theme.ts             ← light/dark with no-flash bootstrap
│
├─ services/
│  ├─ auth.service.ts          ← /auth/* endpoints
│  ├─ repos.service.ts         ← /repos/* endpoints
│  └─ git.service.ts           ← /repos/.../branches|commits|tags|tree|blob
│
├─ lib/
│  ├─ api-client.ts            ← axios + token store + 401 refresh logic
│  ├─ cli-commands.ts          ← canonical data for /cli explorer
│  ├─ diff.ts                  ← client-side git diff engine (tree + line diff)
│  ├─ gent-urls.ts             ← CLI clone-URL helpers
│  ├─ paths.ts                 ← centralized route paths
│  └─ utils.ts                 ← cn(), timeAgo(), shortSha(), avatarColors(), isBrowser()
│
├─ store/
│  ├─ index.ts                 ← configureStore({ auth, theme })
│  └─ slices/
│     ├─ auth-slice.ts
│     └─ theme-slice.ts
│
└─ types/
   └─ api.ts                   ← typed contracts for every endpoint
```

---

## Naming conventions

| Kind                 | Convention                                  | Example                             |
|----------------------|---------------------------------------------|-------------------------------------|
| Files                | kebab-case                                  | `branch-list.tsx`                   |
| React components     | PascalCase, one default export per file     | `export default function BranchList(...)` |
| Hooks                | `use-*.ts`, `useThing()` export             | `use-repos.ts` → `useReposList()`   |
| Services             | `*.service.ts`, `xService` const object     | `repos.service.ts` → `reposService` |
| Types                | PascalCase                                  | `Repository`, `Branch`              |
| Constants            | UPPER_SNAKE                                 | `API_BASE_URL`                      |
| Path aliases         | `@/...` → `src/...` (configured in tsconfig)| `import { api } from "@/lib/api-client"` |

---

## Where to put new code

Use this table when adding a feature.

| You are adding...                            | Put it in...                                  |
|----------------------------------------------|------------------------------------------------|
| A new route                                  | `src/app/<segments>/page.tsx`                  |
| A new shared layout for some routes          | `src/app/<segments>/layout.tsx`                |
| A new primitive (button variant, badge...)   | `src/components/ui/`                           |
| A new shell (a new section's chrome)         | `src/components/layout/`                       |
| A new domain widget                          | `src/components/features/<domain>/`            |
| A new HTTP call                              | extend the matching `*.service.ts`             |
| A new React-y data source                    | extend the matching `use-*.ts`                 |
| A new TypeScript API contract                | `src/types/api.ts`                             |
| A new utility used in 2+ places              | `src/lib/utils.ts` (or its own `lib/` file)    |
| A new global client-state slice              | `src/store/slices/` + register in `index.ts`   |
| A new env-var-driven config                  | `.env.example` + read it in `src/lib/*`        |

---

## Files you should **not** edit by hand

- `next-env.d.ts` — regenerated by Next.
- `tsconfig.tsbuildinfo` — TS incremental cache.
- `.next/` — build output.
- `node_modules/` — `npm install` owns this.
- `package-lock.json` — only change via `npm install`/`npm update`.

---

## Path aliases

`tsconfig.json` configures `@/*` → `src/*`. Always use the alias; relative
paths beyond `./` (e.g. `../../components/ui/button`) read poorly and break
when files move.

```ts
// good
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api-client";

// bad
import { Button } from "../../components/ui/button";
```

---

## `public/`

Static files served at the root.

```
public/
├─ logo.svg
├─ logo-dark.svg
├─ og-image.png
└─ ...
```

Imported by path (`<img src="/logo.svg" />`), not via `import`. Nothing here
is hashed by Next — pick filenames you're willing to commit to forever.
