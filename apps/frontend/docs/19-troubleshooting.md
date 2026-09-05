# 19 — Troubleshooting

Common errors, what they mean, and how to fix them.

---

## "Module not found: Can't resolve '@/...'"

Cause: TS path alias not picked up. Almost always one of:

- You created a file in a folder Next doesn't know yet (rare — `tsconfig`
  uses a glob).
- Your editor's TS server hasn't refreshed.

Fix:

1. Restart the TS server (VS Code: `Cmd+Shift+P` → `TypeScript: Restart TS server`).
2. Confirm `tsconfig.json` still has `"paths": { "@/*": ["./src/*"] }`.
3. Hard-reload the dev server (`Ctrl+C`, `npm run dev`).

---

## "Hydration failed — server and client render different content"

Cause: a component reads something that exists only on the client (e.g.
`localStorage`, `window`) during its first render.

Fix:

- Mark the component `"use client"` (most of ours are).
- Guard with `isBrowser()` from `src/lib/utils.ts`:

  ```ts
  const [value, setValue] = useState<string | null>(null);
  useEffect(() => {
    setValue(localStorage.getItem("foo"));
  }, []);
  ```

Don't read browser globals during render — read them in `useEffect`.

---

## Theme flashes on first load (light → dark snap)

Cause: the bootstrap `<script>` in `app/layout.tsx` was removed, edited, or
moved.

Fix: ensure the inline script that reads `localStorage.gent-theme` and sets
the `dark` class on `<html>` runs **before** the React tree mounts. It must
be in `<head>` or as the first child of `<body>`.

---

## "401 Unauthorized" loops forever

Cause: refresh endpoint is returning 401 too, and the interceptor's `_retry`
flag isn't engaging.

Diagnosis:

1. Open the Network tab. How many `token/refresh/` calls per second? One per
   request is wrong — it should be at most one in-flight at any time.
2. Inspect `tokenStore.getRefresh()` in the console. If it's `null`, login
   was never completed; if it's set, the refresh token has been revoked.

Fix:

- Clear localStorage (`localStorage.clear()`) and log in again.
- If the loop persists, check that `refreshPromise` in
  `src/lib/api-client.ts` is being reset in the `.finally(...)` block — a
  prior edit may have removed it.

---

## "Cannot read properties of undefined (reading 'X')" on a page

Almost always: a TanStack Query returned `undefined` because it's still
loading or it failed.

Fix:

```tsx
const { data: repos = [], isLoading, error } = useReposList();
if (isLoading) return <Skeleton />;
if (error)    return <EmptyState ... />;
// only now is `repos` guaranteed
```

Don't destructure deeply from `data` before checking the loading state.

---

## Live polling stopped working

Cause: the tab was in the background long enough for `gcTime` to evict the
query (default 5 min). Returning to the tab causes a fresh fetch; if it
fails (network blip), polling won't auto-resume until the next observer
mounts.

Fix: focus the tab and click into the page again — the hook re-subscribes
and polling resumes. If the bug looks systematic, check `refetchInterval` is
still 12_000 in `src/hooks/use-git.ts`.

---

## "Window is not defined" in `npm run build`

Cause: a module reads `window` at top level.

Fix: move the read into `useEffect`, or guard with `isBrowser()`. The build
runs server-rendering pre-flight even for client components.

---

## Tailwind classes show up but have no effect

Cause: the import in `globals.css` was removed or the PostCSS plugin isn't
loaded.

Fix:

- Ensure `src/app/globals.css` has `@import "tailwindcss";` at the top.
- Ensure `postcss.config.mjs` has `"@tailwindcss/postcss": {}` in plugins.
- Restart the dev server.

---

## "useRouter only works in a Client Component"

You're calling `useRouter()` (or any `next/navigation` hook) from a server
component. Add `"use client"` at the top of the file.

---

## CORS error against a local backend

Cause: `NEXT_PUBLIC_GENT_API_URL=http://localhost:8000/api` but the Django
backend isn't allowing `http://localhost:3000`.

Fix: configure CORS on the backend (in `apps/server/gent_api/`). Don't
disable CORS in the browser — that hides the real bug.

---

## `npm install` fails with peer dependency warnings

`npm 10+` is strict about peer deps. Common offenders:

- React 19 is brand new; some lib will warn it expects 18.

Fix: read the warning carefully. If the library actually works on 19 (most
do), add `--legacy-peer-deps` only as a temporary unblock and open an issue
upstream. Do not commit `--legacy-peer-deps` to the repo — fix the library
or replace it.

---

## "Maximum update depth exceeded" in `useAuth`

Cause: a component dispatches Redux on every render (e.g. inside the render
function instead of `useEffect`).

Fix: wrap the dispatch in `useEffect` with the right deps. `useAuth()`
itself is well-behaved; the bug is almost always upstream.

---

## Devtools query cache shows everything as "stale" forever

Cause: a previous tab's `gcTime: 0` setting bled over (devtools quirk).

Fix: refresh the page and clear the cache button in devtools.

---

## Where to ask for help

1. Check this doc again.
2. Search the codebase: `grep -r "TheErrorMessage" src/`.
3. Look at the relevant doc section ([08-api-integration.md](./08-api-integration.md)
   is the most-frequently relevant).
4. If still stuck, open an issue describing what you did, what you expected,
   and what happened.
