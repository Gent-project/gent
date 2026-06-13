# Providers

File: `src/components/providers/providers.tsx`

A single component that owns every top-level context the app needs. Mounted
in `src/app/layout.tsx` as the very first child of `<body>`.

What it wires up:

```tsx
<ReduxProvider store={store}>
  <QueryClientProvider client={queryClient}>
    {children}
    <ReactQueryDevtools initialIsOpen={false} />
    <Toaster richColors closeButton position="top-right" />
  </QueryClientProvider>
</ReduxProvider>
```

---

## Redux Provider

Source: `react-redux`. Store: `src/store/index.ts`.

The store holds two slices (`auth`, `theme`). See
[06-state-management.md](../06-state-management.md) for the full breakdown.

The auth slice exists so:

1. Non-React code (e.g. side-effects in hooks) can dispatch logouts.
2. The token is mirrored alongside `tokenStore` in `localStorage` for
   backwards compatibility with earlier app code.

---

## TanStack QueryClient

A single `QueryClient` is created at module scope with these defaults:

```ts
new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: true,
      retry: 1,
    },
    mutations: {
      retry: 0,
    },
  },
});
```

Per-query overrides (e.g. the 12-second polling interval for branches/commits/tags)
are set in the individual hooks — see `src/hooks/use-git.ts`.

> **Do not create new QueryClient instances**. There must be exactly one for
> the lifetime of the app, otherwise caches do not share and every page hits
> the network on mount.

### React Query Devtools

`<ReactQueryDevtools>` is mounted but starts closed. To open it, click the
small floating logo in the bottom-right of the dev server. The devtools are
tree-shaken out of production builds by `@tanstack/react-query-devtools`'s
build config.

---

## Sonner Toaster

`<Toaster>` (from `sonner`) is rendered once globally. Anywhere in the app
you can call:

```ts
import { toast } from "sonner";
toast.success("Saved");
toast.error("Could not save: " + readApiError(err));
toast.message("Background sync running…", { duration: 4_000 });
```

Settings used:

- `position="top-right"` — keeps the toasts out of forms on the left side.
- `richColors` — uses the semantic colors from the design system.
- `closeButton` — every toast has an X.

The hooks layer is the main caller — see `useAuth`, `useCreateRepo`,
`useDeleteRepo`. Component code rarely needs to call `toast` directly.

---

## Adding a new provider

If you need to add another context (e.g. a feature flag client), do it here
— do **not** add a new provider in a page or layout. The order matters: a
provider that reads Redux must be inside `<ReduxProvider>`; a provider that
issues toasts must be above `<Toaster>`.
