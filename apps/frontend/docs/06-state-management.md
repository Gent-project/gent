# 06 — State Management

The app uses **two state systems on purpose**:

| System              | Owns                                                        | Why                                                                              |
|---------------------|-------------------------------------------------------------|----------------------------------------------------------------------------------|
| **TanStack Query**  | Server state — anything that came from the API              | Caching, polling, request dedup, invalidation, optimistic updates                |
| **Redux Toolkit**   | Client state we want globally shared                         | A single source for the auth token + theme, accessible to non-React code         |

Local component state stays in `useState`. React Context is not used directly
— everything that would have been Context lives in TanStack Query or Redux
instead.

```
┌────────────────────────────────────────────────────────────────────┐
│                       App component tree                            │
├────────────────────────────────────────────────────────────────────┤
│ useReposList()  ─► reads TanStack Query cache (key: ["repos"])      │
│ useBranches(o, n)─► reads TanStack Query cache (polls every 12s)    │
│ useAuth()       ─► reads Redux auth slice + TanStack Query profile  │
│ useTheme()      ─► reads Redux theme slice + localStorage bootstrap │
└────────────────────────────────────────────────────────────────────┘
```

---

## TanStack Query

Set up in `src/components/providers/providers.tsx`. One `QueryClient` for
the whole app. Defaults:

| Option                  | Value      | Reason                                                                |
|-------------------------|------------|-----------------------------------------------------------------------|
| `staleTime`             | `30_000`   | Most data does not change *that* fast; cuts request volume.           |
| `gcTime`                | `5 * 60_000` | Tab away for 5 min, your data is dropped from cache to free RAM.    |
| `refetchOnWindowFocus`  | `true`     | Coming back to the tab should show fresh data.                        |
| `retry`                 | `1`        | One retry only; we never want chatty backoff loops.                   |

### Query keys

Keys are arrays, scoped by namespace. We centralize them where it matters:

```ts
// src/hooks/use-git.ts
export const gitKeys = {
  branches: (o, n)            => ["git", "branches", String(o), n] as const,
  branchDetail: (o, n, b)      => ["git", "branch",   String(o), n, b] as const,
  commits: (o, n)             => ["git", "commits",  String(o), n] as const,
  commit: (o, n, sha)         => ["git", "commit",   String(o), n, sha] as const,
  tags: (o, n)                => ["git", "tags",     String(o), n] as const,
  tree: (o, n, sha)           => ["git", "tree",     String(o), n, sha] as const,
  blob: (o, n, sha)           => ["git", "blob",     String(o), n, sha] as const,
};
```

Other modules use ad-hoc keys (`["auth", "profile"]`, `["repos"]`,
`["repos", ownerId, name]`). If you find yourself typing the same key in two
files, hoist it.

### Polling

Hooks that need live data set `refetchInterval`:

```ts
useQuery({
  queryKey: gitKeys.commits(ownerId, name),
  queryFn: () => gitService.commits(ownerId, name),
  refetchInterval: 12_000,
  refetchOnWindowFocus: true,
});
```

12 seconds is the agreed cadence between the CLI demo and the web. It is
short enough that a `gent push` feels instant, long enough that the API on
Render isn't hammered by every open tab.

If you add a new polled query, **reuse the same 12s** unless you have a
specific reason otherwise.

### Mutations & invalidation

Pattern: do the mutation, then either:

- **Invalidate** the keys whose data is now stale; or
- **Set** the cache directly (faster, but easier to get wrong).

`useCreateRepo` example:

```ts
const create = useMutation({
  mutationFn: reposService.create,
  onSuccess: (newRepo) => {
    queryClient.invalidateQueries({ queryKey: ["repos"] });
    toast.success("Repository created.");
  },
});
```

`useDeleteRepo` example with optimistic update:

```ts
const remove = useMutation({
  mutationFn: ({ ownerId, name }) => reposService.remove(ownerId, name),
  onMutate: async (vars) => {
    await queryClient.cancelQueries({ queryKey: ["repos"] });
    const previous = queryClient.getQueryData<Repository[]>(["repos"]);
    queryClient.setQueryData<Repository[]>(["repos"], (old) =>
      old?.filter((r) => !(r.owner_id === vars.ownerId && r.name === vars.name)) ?? [],
    );
    return { previous };
  },
  onError: (_e, _v, ctx) => {
    if (ctx?.previous) queryClient.setQueryData(["repos"], ctx.previous);
  },
  onSettled: () => queryClient.invalidateQueries({ queryKey: ["repos"] }),
});
```

The trio `onMutate` / `onError` / `onSettled` is the canonical pattern — copy
it when you write a new mutation that affects a list.

---

## Redux Toolkit

`src/store/index.ts`:

```ts
export const store = configureStore({
  reducer: {
    auth: authReducer,
    theme: themeReducer,
  },
});
```

### `auth` slice

`src/store/slices/auth-slice.ts`

```ts
type AuthState = {
  token: string | null;
  refreshToken: string | null;
  user: { id: string; email: string; name: string } | null;
};
```

Actions:

- `setAuth({ token, refreshToken, user })` — replace everything.
- `logout()` — clear everything.

Why a slice for this when `tokenStore` also exists?

- Non-React code dispatches `logoutAction` so the UI updates even if the call
  did not come from a hook.
- It makes the user info reactive throughout the tree — `useSelector` triggers
  re-renders, where `localStorage` does not.

`tokenStore` (in `src/lib/api-client.ts`) is the source of truth at the
network boundary; the slice is a *mirror* for React.

### `theme` slice

`src/store/slices/theme-slice.ts`

Holds the current theme `'light' | 'dark'`. Mainly historical — `useTheme()`
manages the DOM class and `localStorage`. We keep the slice around so other
parts of the app (e.g. a graph that needs theme-aware colors) can subscribe
without re-deriving from `document.documentElement.classList`.

---

## Local state

Use `useState` / `useReducer` for anything that:

- Lives in exactly one component.
- Does not need to survive a route change.
- Is not derived from the server.

Examples: form drafts (before submit), open/close state of a modal, current
tab in a tabs widget.

---

## When to add a new global piece of state

Use this checklist:

1. **Does it come from the API?** → Add a TanStack Query hook. Stop.
2. **Is it derived from existing state?** → Just compute it in the component.
3. **Is it used by two or more sibling components AND it changes over time?**
   → Probably a Redux slice. Add it under `src/store/slices/` and register in
   `index.ts`.
4. **Is it persisted across reloads?** → If so, decide where: Redux + an
   effect that writes to `localStorage` (like `theme`), or a hook that wraps
   `localStorage` directly (like `tokenStore`).

The shortest-lived state should be the most local. Global is a last resort.
