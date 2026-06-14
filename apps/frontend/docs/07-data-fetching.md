# 07 — Data Fetching

Every network call in the app goes through this pipeline:

```
component / page
      │
      ▼
src/hooks/use-*.ts        ← TanStack Query: caching, polling, retries, toasts
      │
      ▼
src/services/*.service.ts ← typed wrapper: builds the URL, parses response
      │
      ▼
src/lib/api-client.ts     ← axios: token, refresh, error normalization
      │
      ▼
   Gent REST API
```

Each layer is dumb about the one above it. A service knows nothing about
caching; a hook knows nothing about axios; the api-client knows nothing about
TanStack Query.

---

## Defaults (from `providers.tsx`)

```ts
{
  queries: {
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: true,
    retry: 1,
  },
  mutations: { retry: 0 },
}
```

- **`staleTime: 30s`** — within 30 seconds of the last fetch, the cached data
  is "fresh" and re-renders won't trigger refetches. After 30s it becomes
  "stale" but is still served instantly; the next mount/focus refetches in
  the background.
- **`gcTime: 5min`** — if no observers (no mounted hook) are listening to a
  query for 5 minutes, it's garbage-collected from the cache.
- **`refetchOnWindowFocus`** — switching back to the tab refreshes stale data.
- **`retry: 1`** — exactly one retry, then we surface the error. We never
  want a 6-retry exponential backoff for a 401.

---

## Polling

Branches, commits, and tags poll every **12 seconds**.

```ts
useQuery({
  queryKey: gitKeys.branches(ownerId, name),
  queryFn: () => gitService.branches(ownerId, name),
  refetchInterval: 12_000,
  refetchOnWindowFocus: true,
});
```

Why 12s?

- Short enough for a `gent push` to feel near-instant on the web.
- Long enough that with hundreds of open tabs, the API on Render is fine.
- Empirically the data is not bigger than a few KB per call, so the cost is
  negligible.

The interval is set per-hook, not globally — change it where it matters and
leave the rest alone.

If a user backgrounds the tab, the polling pauses (React Query checks
`document.visibilityState`). When they come back, the first fetch happens
immediately, not after another 12s.

---

## Query keys

Every key starts with a namespace string so devtools group them sensibly:

| Namespace | Examples                                                          |
|-----------|-------------------------------------------------------------------|
| `auth`    | `["auth", "profile"]`                                             |
| `repos`   | `["repos"]`, `["repos", ownerId, name]`                           |
| `git`     | `["git", "branches", ownerId, name]`, `["git", "commit", ..., sha]`|

For complex modules we centralize keys in an object (`gitKeys` in
`use-git.ts`) so we never typo a key in two places. For one-off keys we
write them inline.

---

## Mutations

Three flavors:

### Plain success → invalidate

Simplest, safest. Don't try to predict server state.

```ts
const create = useMutation({
  mutationFn: reposService.create,
  onSuccess: () => queryClient.invalidateQueries({ queryKey: ["repos"] }),
});
```

### Optimistic add/remove

For lists where the UI should feel instant.

```ts
const remove = useMutation({
  mutationFn: ({ ownerId, name }) => reposService.remove(ownerId, name),
  onMutate: async (vars) => {
    await queryClient.cancelQueries({ queryKey: ["repos"] });
    const previous = queryClient.getQueryData<Repository[]>(["repos"]);
    queryClient.setQueryData<Repository[]>(["repos"], (old) =>
      (old ?? []).filter((r) => !(r.owner_id === vars.ownerId && r.name === vars.name)),
    );
    return { previous };
  },
  onError: (_e, _v, ctx) => {
    if (ctx?.previous) queryClient.setQueryData(["repos"], ctx.previous);
  },
  onSettled: () => queryClient.invalidateQueries({ queryKey: ["repos"] }),
});
```

### Direct setQueryData

Used when the API response is enough to reconstruct the cache entry without a
full refetch. `useAuth().login` does this:

```ts
onSuccess: (data) => {
  queryClient.setQueryData(["auth", "profile"], data.user);
  // ...
}
```

---

## Cancellation

TanStack Query passes an `AbortSignal` to your `queryFn`. We do not use it
yet — axios calls are typically <500ms and abandoning them is rare. If you
add a long-running endpoint, pass the signal through:

```ts
queryFn: ({ signal }) => api.get(url, { signal }),
```

---

## Errors

All errors funnel through `readApiError(err)` from `src/lib/api-client.ts`,
which walks the response body in priority order (`error` → `detail` →
`message` → first field with a string value → axios message).

For mutations, surface the error as a toast:

```ts
onError: (err) => toast.error(readApiError(err))
```

For queries, the hook returns `error`. Pages typically render a small empty
state with a "Try again" button that calls `refetch()`.

---

## SSR / RSC

Currently **none** of the data is fetched server-side. Every `page.tsx` that
needs data is marked `"use client"` and runs the hook in the browser. The
reasons:

- The user's JWT lives in `localStorage`, which a server component cannot read.
- Cookies for auth would change the architecture and aren't worth it yet.

If we move auth to cookies (for SEO on public project pages), the
shape would be:

1. A server component reads the cookie, makes the request server-side via a
   server-only `api` instance.
2. Wraps the result in `dehydrate(queryClient)` and hands it to a client
   provider via `HydrationBoundary`.
3. Client hooks read the hydrated cache instantly.

This is documented as a future direction in the codebase; do not implement
piecemeal.

---

## Useful devtools recipes

- **See every cached query** → open React Query devtools (floating logo in
  dev) and search by namespace (`git`, `repos`).
- **Force a refetch** → in devtools, click a query and hit *Refetch*.
- **Clear the cache** → devtools → "Clear cache". Useful when a stale shape
  is causing render bugs.
- **Watch a query in code** → `queryClient.getQueryState(["git", "commits", ...])`.
