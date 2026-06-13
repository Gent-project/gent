# 01 — Getting Started

This guide walks you from a fresh clone to a running dev server, then to a
production build. It assumes a recent **Node 20+** and **npm 10+** on macOS,
Linux, or WSL.

---

## 1. Prerequisites

| Tool        | Minimum  | Notes                                                       |
|-------------|----------|-------------------------------------------------------------|
| Node.js     | 20.x     | Tested against 20 and 22. Avoid odd-numbered Node releases. |
| npm         | 10.x     | Shipped with Node 20+. Yarn/pnpm work but are not tested.   |
| Git         | any      | Required for `git clone` and the project's own dogfooding.  |
| A browser   | recent   | Chromium-based recommended for the in-page CLI explorer.    |

> **Why Node 20?** Next.js 16 requires Node 18.18+ but the dependency graph
> (axios 1.13, `@tanstack/react-query` 5.90, React 19) targets Node 20 LTS as
> its minimum stable runtime. You can use Node 22; just don't ship on Node 18.

---

## 2. Clone & install

```bash
git clone https://github.com/Gent-project/gent.git
cd gent
npm install
```

The install pulls roughly 330 packages (`package-lock.json` is committed and
authoritative — do not delete it). Expect about 25–60 seconds on a fast
connection.

---

## 3. Configure your environment

Copy the example file and edit if needed:

```bash
cp .env.example .env.local
```

The only variable the app reads is:

```bash
# .env.local
NEXT_PUBLIC_GENT_API_URL=https://gent-api.onrender.com/api
```

- Leaving it unset is fine — `src/lib/api-client.ts` falls back to the public
  hosted API.
- Point it at `http://localhost:8000/api` if you are running the Django backend
  locally (see `apps/server/gent_api/`).
- Anything prefixed `NEXT_PUBLIC_` is exposed to client code, so do **not** put
  secrets there.

See [16-environment-and-config.md](./16-environment-and-config.md) for the full
list of variables and how Next handles build-time vs runtime values.

---

## 4. Run the dev server

```bash
npm run dev
```

This starts Next 16 with Turbopack on `http://localhost:3000`.

What to expect:

- The first request takes 1–3 seconds while Turbopack compiles the route.
- Hot reload is sub-second after that.
- The terminal logs every fetch the server-side rendering layer makes.
- If you see `EADDRINUSE :3000`, another process owns the port — run
  `lsof -i :3000` to find it, or start on a different port with
  `PORT=3001 npm run dev`.

### Test credentials

Use these to exercise login against the live API:

| Email                  | Password     | User ID |
|------------------------|--------------|---------|
| `test@gmail.com`       | `12345678A@` | 8       |
| `saad.shayah@mail.com` | `SS99663311` | 1       |

Both accounts have repos and commits, so the dashboard is non-empty.

---

## 5. Build for production

```bash
npm run build
npm start
```

- `build` produces an optimised standalone build under `.next/`.
- `start` serves that build on port 3000 (override with `PORT`).

Expect the build to take 20–60 seconds locally. The build will fail if there
are TypeScript errors or unused imports flagged by the Next ESLint config —
fix them rather than turning checks off.

See [17-build-and-deployment.md](./17-build-and-deployment.md) for hosting
options (Vercel, Render, generic Node host).

---

## 6. Other scripts

| Command         | Purpose                                       |
|-----------------|-----------------------------------------------|
| `npm run dev`   | Dev server with Turbopack hot reload.         |
| `npm run build` | Production build.                             |
| `npm run start` | Serve the production build.                   |
| `npm run lint`  | ESLint with the Next.js + TypeScript rules.   |

There is **no `test` script** committed yet — see
[18-testing.md](./18-testing.md) for the planned approach.

---

## 7. Editor setup

The repo ships a `.vscode/` folder with recommended settings. The minimum your
editor needs is:

- **TypeScript:** use the workspace version (`"typescript.tsdk": "node_modules/typescript/lib"`).
- **ESLint:** auto-fix on save (`"editor.codeActionsOnSave": { "source.fixAll.eslint": "explicit" }`).
- **Tailwind IntelliSense:** install the official VS Code extension; the
  Tailwind v4 PostCSS plugin emits classes IntelliSense can pick up without
  any extra config.

---

## 8. Verifying the install

A 30-second smoke check that everything wired up:

1. `npm run dev`
2. Open `http://localhost:3000` → marketing page renders with the animated
   terminal.
3. Click **Sign in**, log in with one of the test credentials.
4. You land on `/app` and see at least one project card.
5. Click into a project → branches, commits, tags load within a few seconds
   and start polling (look at the network tab — a request fires every ~12s).

If any of those fail, jump to [19-troubleshooting.md](./19-troubleshooting.md).
