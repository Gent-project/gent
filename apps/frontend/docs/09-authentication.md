# 09 — Authentication

The Gent API uses **JWT** with separate **access** and **refresh** tokens.
The frontend keeps both in `localStorage`, attaches the access token to
every request, and silently refreshes when it expires.

This doc covers the full lifecycle and the design choices behind it.

---

## High-level flow

```
1. User submits credentials → POST /auth/login/
2. API returns { user, tokens: { access, refresh } }
3. Frontend stores tokens in localStorage + Redux
4. Every request adds: Authorization: Bearer <access>
5. On 401, frontend POSTs the refresh token to /auth/token/refresh/
   ├─ success → retry the original request with the new access token
   └─ failure → clear tokens, redirect to /auth/login
6. Logout → POST /auth/logout/ (best effort) + clear local state
```

---

## Storage

`src/lib/api-client.ts` exposes `tokenStore`:

```ts
tokenStore.getAccess()   // string | null
tokenStore.getRefresh()  // string | null
tokenStore.getUser()     // User | null
tokenStore.set(tokens, user?)
tokenStore.clear()
```

Backed by `localStorage` with these keys:

| Key             | Value          |
|-----------------|----------------|
| `gent.access`   | access token   |
| `gent.refresh`  | refresh token  |
| `gent.user`     | JSON `User`    |

Why `localStorage` and not cookies?

- Simpler — no CSRF dance, no SameSite gotchas across the dev domains.
- Acceptable threat model for a developer tool.
- All access is funneled through `tokenStore` so we can migrate to httpOnly
  cookies later without touching call sites.

What is **not** stored:

- The user's password (obviously).
- Any session ID — JWTs are self-contained.
- Auth state for SSR — there is no server-side auth in this app.

---

## The axios instance

`src/lib/api-client.ts` creates exactly one axios instance and exports it as
`api`. Two interceptors:

### Request interceptor

```ts
api.interceptors.request.use((config) => {
  const token = tokenStore.getAccess();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
```

Runs on every request. If no token, the header is simply omitted.

### Response interceptor — 401 handling

```ts
api.interceptors.response.use(
  (r) => r,
  async (error) => {
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status === 401 && original && !original._retry) {
      original._retry = true;
      const next = await refreshAccessToken();
      if (next) {
        original.headers!.Authorization = `Bearer ${next}`;
        return api.request(original);     // retry once
      }
      tokenStore.clear();
      if (isBrowser() && !window.location.pathname.startsWith("/auth")) {
        window.location.href = PATHS.auth.login;
      }
    }
    return Promise.reject(error);
  },
);
```

Important properties:

- The `_retry` flag prevents infinite refresh loops on a perpetually-failing
  401 (e.g. revoked tokens).
- Multiple concurrent 401s share a single in-flight refresh via the
  `refreshPromise` variable — only one refresh fires even if 5 requests
  fail at once.
- The refresh endpoint *may or may not* rotate the refresh token. We accept
  either case: `tokenStore.set({ access: next.access, refresh: next.refresh ?? refresh })`.
- A failed refresh forcibly redirects the browser. We use
  `window.location.href` rather than `router.push` because we may be inside
  any number of nested routes and we want a clean reload.

### Concurrent refresh handling

```ts
let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken() {
  if (!refreshPromise) {
    refreshPromise = ax.post(`${API_BASE_URL}/auth/token/refresh/`, { refresh })
      .then(...)
      .finally(() => { refreshPromise = null; });
  }
  return refreshPromise;
}
```

This is the standard "single-flight" pattern. Crucial to understand if you
ever debug "why did we get 5 refresh requests for 1 second of activity?" —
the answer is "we shouldn't, and we don't, because of this guard."

---

## The hook

`useAuth()` in `src/hooks/use-auth.ts` is the React surface.

```ts
const {
  user,                  // User | null  (from /auth/profile/ + tokenStore)
  isAuthenticated,       // boolean
  isCheckingSession,     // true while the initial profile load runs
  login,                 // (LoginPayload) => void
  register,              // (RegisterPayload) => void
  logout,                // () => void
  isLoggingIn,
  isRegistering,
} = useAuth();
```

Behavior:

- On mount, if there is a token, runs a `useQuery` against `/auth/profile/`
  with `initialData: tokenStore.getUser()` — so the UI renders the cached
  user instantly and only revalidates in the background.
- `login` dispatches to Redux and `queryClient.setQueryData(["auth", "profile"], user)`
  so any subscribed component sees the fresh user immediately, without a
  network round-trip.
- `logout` calls the API (best effort), clears Redux, clears the query
  cache (`queryClient.clear()`), and `router.push(PATHS.auth.login)`.

### Why both Redux and TanStack Query for auth?

- TanStack Query owns the *network* state (loading, errors, retries).
- Redux owns the *globally-shared* slice that non-React code (axios
  interceptors, side-effects) might write to.

You could collapse to TanStack Query alone if you don't mind some indirection
in the interceptor — but right now this dual setup is the cleanest place to
draw the line.

---

## Login / Register response

Both endpoints return the same envelope:

```ts
type LoginResponse = {
  message: string;
  user: User;
  tokens: AuthTokens;     // { access, refresh }
};

type RegisterResponse = {
  message?: string;
  user: User;
  tokens?: AuthTokens;    // omitted if the API requires email verification
};
```

If `register` returns no tokens, the UI redirects to `/auth/login` with a
"Please sign in" toast. If it does return tokens, the user is logged in
straight away.

---

## Logout

```ts
async logout() {
  const refresh = tokenStore.getRefresh();
  try {
    if (refresh) await api.post("/auth/logout/", { refresh });
  } catch {
    /* may return 400/401 if the token expired — ignore */
  } finally {
    tokenStore.clear();
  }
}
```

Logout is **always** successful client-side. The server call is best-effort —
if it fails (no network, expired token), we still clear local state so the
user actually appears logged out.

---

## Guard pattern (no middleware)

There is no `middleware.ts`. The guard lives in `src/app/app/layout.tsx`:

```tsx
"use client";
export default function AppLayout({ children }) {
  const { isAuthenticated, isCheckingSession } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isCheckingSession && !isAuthenticated) {
      router.replace(PATHS.auth.login);
    }
  }, [isAuthenticated, isCheckingSession, router]);

  if (isCheckingSession) return <FullPageSkeleton />;
  if (!isAuthenticated)  return null;
  return <AppShell>{children}</AppShell>;
}
```

Pros: simple, no edge runtime, no cookie wrangling.
Cons: a brief flicker of `<FullPageSkeleton />` while the token check runs.

If we move to cookie-based auth, we should add a `middleware.ts` that
short-circuits unauthenticated requests at the edge.

---

## Common pitfalls

- **Two open tabs, one logs out** — the logging-out tab clears `localStorage`,
  but the other tab still has Redux state. Next request 401s, interceptor
  fails to refresh, redirects to login. Not great UX but not broken either.
  Fix: subscribe to `storage` events in `useAuth` to react across tabs.
- **Clock skew on the device** — if the device clock is fast, tokens may be
  considered expired earlier than the server expects. We rely on the API
  returning 401 to drive refreshes; we never check `exp` ourselves.
- **Refresh token theft** — out of scope for this app. The threat model is
  developers signing in on their own machines.
