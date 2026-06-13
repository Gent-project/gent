# 10 — Hooks Reference

API reference for every custom hook under `src/hooks/`. Each section lists
signature, return shape, behavior, and a usage example.

> Source files: `use-auth.ts`, `use-repos.ts`, `use-git.ts`, `use-theme.ts`.

---

## `useAuth()`

`src/hooks/use-auth.ts`

```ts
function useAuth(): {
  user: User | null;
  isAuthenticated: boolean;
  isCheckingSession: boolean;
  login: (payload: LoginPayload) => void;
  register: (payload: RegisterPayload) => void;
  logout: () => void;
  isLoggingIn: boolean;
  isRegistering: boolean;
};
```

Behavior:

- Reads the access token from Redux + `tokenStore` to decide
  `isAuthenticated`.
- Runs a background `useQuery` against `/auth/profile/` (key
  `["auth", "profile"]`), with `initialData: tokenStore.getUser()` so the
  user is available instantly. Revalidates with `staleTime: 60s`.
- `login`, `register`, `logout` are mutations. On success they update Redux,
  set the TanStack cache, and toast.
- See [09-authentication.md](./09-authentication.md) for the deep dive.

Usage:

```tsx
const { user, isAuthenticated, login, isLoggingIn } = useAuth();

if (!isAuthenticated) return <LoginForm onSubmit={login} loading={isLoggingIn} />;
return <h1>Welcome, {user?.first_name}!</h1>;
```

---

## `useReposList()`

`src/hooks/use-repos.ts`

```ts
function useReposList(): UseQueryResult<Repository[]>;
```

- Key: `["repos"]`.
- Calls `reposService.list()`.
- Honors global defaults (`staleTime: 30s`, refetch on focus).
- Enabled only when there is a token (skips for anonymous visitors).

Usage:

```tsx
const { data: repos = [], isLoading, error } = useReposList();
if (isLoading) return <SkeletonGrid />;
if (error)    return <EmptyState ... />;
return repos.map((r) => <ProjectCard key={r.id} repo={r} />);
```

---

## `useRepoDetail(ownerId, name)`

```ts
function useRepoDetail(
  ownerId: number | string,
  name: string,
): UseQueryResult<Repository>;
```

- Key: `["repos", String(ownerId), name]`.
- Disabled when either param is empty.
- Calls `reposService.detail(ownerId, name)`.

---

## `useCreateRepo()`

```ts
function useCreateRepo(): UseMutationResult<Repository, unknown, CreateRepoPayload>;
```

- On success: invalidates `["repos"]` and toasts.
- On error: toasts the parsed error.

Usage:

```tsx
const create = useCreateRepo();
<Button onClick={() => create.mutate({ name: "my-app" })} isLoading={create.isPending}>
  Create
</Button>
```

---

## `useDeleteRepo()`

```ts
function useDeleteRepo(): UseMutationResult<void, unknown, { ownerId: number; name: string }>;
```

- Optimistically removes the repo from `["repos"]`.
- On error, rolls back.
- On settle, invalidates `["repos"]` to reconcile with the server.

---

## `useBranches(ownerId, name)`

`src/hooks/use-git.ts`

```ts
function useBranches(
  ownerId: number | string,
  name: string,
): UseQueryResult<Branch[]>;
```

- Key: `["git", "branches", String(ownerId), name]`.
- Polls every **12 seconds**.
- Refetches on window focus.

---

## `useCommits(ownerId, name)`

```ts
function useCommits(
  ownerId: number | string,
  name: string,
): UseQueryResult<Commit[]>;
```

- Same shape as `useBranches`, key `["git", "commits", ...]`.
- Polls every 12s.

---

## `useTags(ownerId, name)`

```ts
function useTags(
  ownerId: number | string,
  name: string,
): UseQueryResult<Tag[]>;
```

- Same shape, key `["git", "tags", ...]`, polls every 12s.

---

## `useBranchCommit(ownerId, name, branchName)`

```ts
function useBranchCommit(
  ownerId: number | string,
  name: string,
  branchName: string,
): UseQueryResult<{ branch: Branch; commit: Commit | null }>;
```

- Two-step query: first fetch the branch, then fetch its tip commit by SHA.
- Returns `commit: null` if the branch is empty (`isEmptySha(branch.commit_sha)`).
- Key: `["git", "branch", String(ownerId), name, branchName]`.
- Polls every 12s.

Useful for "show me what the tip of `main` is right now."

---

## `useTree(ownerId, name, sha)`

```ts
function useTree(
  ownerId: number | string,
  name: string,
  sha: string | undefined,
): UseQueryResult<Tree>;
```

- Disabled when `sha` is missing or `isEmptySha(sha)`.
- Key: `["git", "tree", String(ownerId), name, sha]`.
- `staleTime: 5 minutes` — tree contents are immutable for a given SHA, so
  we can cache them aggressively.

---

## `useBlob(ownerId, name, sha)`

```ts
function useBlob(
  ownerId: number | string,
  name: string,
  sha: string | undefined,
): UseQueryResult<Blob>;
```

- Same caching profile as `useTree` (5-minute stale time, SHA-keyed).
- A `Blob` returned by the API has `content: string` with
  `encoding: "utf-8" | "base64"`. Decode `base64` blobs only if you mean to
  render them (and you usually do not — they are images, binaries, etc.).

---

## `isEmptySha(sha)`

Helper exported from `use-git.ts` (lives there because it's tightly coupled
to the placeholder behavior of the API):

```ts
function isEmptySha(sha: string | undefined): boolean;
```

True if `sha` is undefined, all zeros, or any all-zero string. Use it to
guard against fetching a tree/blob for a brand-new branch.

---

## `useTheme()`

`src/hooks/use-theme.ts`

```ts
function useTheme(): {
  theme: "light" | "dark";
  setTheme: (mode: "light" | "dark") => void;
  toggle: () => void;
};
```

- Reads the initial theme on first mount: `localStorage.gent-theme` → falls
  back to `prefers-color-scheme`.
- `setTheme` applies the new mode by toggling `dark` class on `<html>` and
  writing `localStorage`. Wraps the swap in a `.theme-transition` class
  that fades the colors for 400ms.
- Works in tandem with the no-flash bootstrap script in `app/layout.tsx`.

Usage:

```tsx
const { theme, toggle } = useTheme();
<button onClick={toggle}>{theme === "dark" ? "Light mode" : "Dark mode"}</button>
```

---

## Adding a new hook

1. Decide the key and put it in the corresponding `*Keys` object (or create one).
2. Wrap the service call in `useQuery` or `useMutation`. Inherit defaults
   where possible; override only `refetchInterval`, `staleTime`,
   `enabled` when you have a reason.
3. For mutations, write `onSuccess` / `onError` / (optionally) `onMutate`
   handlers and toast appropriately.
4. Export from the file and add it to this reference.
