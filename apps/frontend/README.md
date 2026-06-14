# Gent — Web Frontend

A modern, animated, Git-shaped UI for the [Gent](https://gent-api.onrender.com)
version-control platform. Built with **Next.js 16 (App Router) + TypeScript +
TanStack Query + Tailwind v4 + framer-motion + Cairo**, and wired straight into
the live REST API.

```
┌──────────────────┐     login / push     ┌──────────────────┐
│   Gent CLI       │ ───────────────────▶ │   Gent server    │
│   (terminal)     │                      │  (Django REST)   │
└──────────────────┘                      └────────┬─────────┘
                                                   │ polls every ~12s
                                                   ▼
                                          ┌──────────────────┐
                                          │   Gent web UI    │  ← this app
                                          └──────────────────┘
```

---

## Quick start

```bash
# 1) Install deps
npm install

# 2) Run dev server (port 3000 by default)
npm run dev

# 3) Build for production
npm run build && npm start
```

The default API URL is the public hosted one
(`https://gent-api.onrender.com/api`). Override it with `NEXT_PUBLIC_GENT_API_URL`
in `.env.local` (see `.env.example`).

---

## Test credentials

Use these to exercise login against the live API:

| Email                 | Password   | User ID |
|-----------------------|------------|---------|
| `test@gmail.com`      | `12345678A@` | 8     |
| `saad.shayah@mail.com`| `SS99663311` | 1     |

---

## Project structure

The layout is heavily inspired by
[aleppo.dev](https://github.com/aleppo-dev-community/aleppo.dev): a clean
`src/` split into route segments, primitives, feature modules, services, hooks,
types and a small `lib/`.

```
src/
├─ app/                      ← Next.js App Router segments
│  ├─ page.tsx               · / (landing)
│  ├─ cli/page.tsx           · /cli (interactive CLI reference)
│  ├─ auth/
│  │  ├─ login/page.tsx      · /auth/login
│  │  └─ signup/page.tsx     · /auth/signup
│  ├─ app/                   ← authenticated section
│  │  ├─ page.tsx            · /app (dashboard)
│  │  ├─ new/page.tsx        · /app/new
│  │  ├─ settings/page.tsx   · /app/settings
│  │  └─ [ownerId]/[name]/page.tsx  · /app/:ownerId/:name
│  ├─ globals.css            · design tokens + utilities
│  └─ layout.tsx             · Cairo font + theme bootstrap + providers
│
├─ components/
│  ├─ providers/             · Redux + TanStack Query glue
│  ├─ ui/                    · Button, Input, TextField, Card, Badge,
│  │                            Avatar, Modal, EmptyState, Skeleton, Logo
│  ├─ layout/                · MarketingNav/Footer, AuthShell, AppShell,
│  │                            ThemeToggle
│  └─ features/
│     ├─ projects/           · ProjectCard, CreateProjectModal,
│     │                        CommitTimeline, BranchList, TagList
│     └─ cli/                · AnimatedTerminal, CommandCard
│
├─ services/                 · thin wrappers around REST endpoints
│  ├─ auth.service.ts
│  ├─ repos.service.ts
│  └─ git.service.ts         · branches / commits / tags
│
├─ hooks/                    · TanStack Query hooks per resource
│  ├─ use-auth.ts
│  ├─ use-repos.ts
│  ├─ use-git.ts
│  └─ use-theme.ts
│
├─ lib/
│  ├─ api-client.ts          · axios instance + token store + refresh logic
│  ├─ cli-commands.ts        · canonical data for the CLI Explorer
│  ├─ paths.ts               · centralised route paths
│  └─ utils.ts               · cn(), timeAgo(), shortSha(), avatarColors()
│
├─ types/
│  └─ api.ts                 · TS contracts for every endpoint
│
└─ store/                    · (kept Redux slice for compatibility)
   ├─ index.ts
   └─ slices/{auth,theme}-slice.ts
```

---

## Pages at a glance

| Route                          | Purpose                                                            |
|--------------------------------|--------------------------------------------------------------------|
| `/`                            | Marketing landing — animated hero, features, "how it works", CTA. |
| `/cli`                         | Interactive CLI Explorer — every command, searchable + copyable.   |
| `/auth/login`                  | Email + password login (POST `/auth/login/`).                      |
| `/auth/signup`                 | Account creation (POST `/auth/register/`).                         |
| `/app`                         | Dashboard — projects grid, stats, "new project" CTA.               |
| `/app/new`                     | Full-page create-project form with CLI snippet helper.             |
| `/app/[ownerId]/[name]`        | Project detail — clone URL, commits, branches, tags, live sync.    |
| `/app/settings`                | Profile info + light/dark theme picker.                            |

---

## API integration

Everything goes through `src/lib/api-client.ts` (one axios instance,
auto-refresh on 401, JWT in `Authorization`). The service files convert REST
responses to TypeScript and hooks (`src/hooks/*`) expose them with TanStack
Query caching, polling and optimistic updates.

| Endpoint                                            | Used by                            |
|-----------------------------------------------------|-------------------------------------|
| `POST /auth/login/`                                 | `useAuth().login`                   |
| `POST /auth/register/`                              | `useAuth().register`                |
| `GET  /auth/profile/`                               | `useAuth()` background revalidate   |
| `POST /auth/logout/`                                | `useAuth().logout`                  |
| `POST /auth/token/refresh/`                         | axios interceptor (auto-refresh)    |
| `GET  /repos/`                                      | `useReposList`                      |
| `POST /repos/create/`                               | `useCreateRepo`                     |
| `GET  /repos/{owner}/{name}/`                       | `useRepoDetail`                     |
| `DELETE /repos/{owner}/{name}/delete/`              | `useDeleteRepo`                     |
| `GET  /repos/{owner}/{name}/branches/`              | `useBranches` (polls every 12 s)    |
| `GET  /repos/{owner}/{name}/commits/`               | `useCommits` (polls every 12 s)     |
| `GET  /repos/{owner}/{name}/tags/`                  | `useTags` (polls every 12 s)        |

That's how a `gent push` from the CLI shows up here without any manual refresh.

---

## Design system

- **Palette**: the project's Flutter `AppColorScheme` translated to CSS
  custom properties (see `src/app/globals.css`). Light + dark modes are both
  fully supported and animated in `useTheme`.
- **Font**: [Cairo](https://fonts.google.com/specimen/Cairo), Latin + Arabic.
- **Motion**: `framer-motion` for page transitions, list staggers, the
  animated terminal, modal scale-in, theme toggle, and live-sync pulse dots.
- **Components**: small, typed primitives in `src/components/ui/`, composed in
  `src/components/features/*` and `src/components/layout/*`.

---

## Scripts

| Command         | Purpose                                  |
|-----------------|-------------------------------------------|
| `npm run dev`   | Dev server with Turbopack hot reload.     |
| `npm run build` | Production build.                         |
| `npm run start` | Serve the production build.               |
| `npm run lint`  | ESLint (Next.js + TS rules).              |
