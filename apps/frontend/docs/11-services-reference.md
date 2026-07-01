# 11 — Services Reference

Services are the **HTTP boundary**. Each one is a `const` object that wraps a
group of related endpoints. They never touch React; they take parameters,
call axios via the shared `api` instance, and return parsed bodies.

> Source files: `auth.service.ts`, `repos.service.ts`, `git.service.ts`.

---

## `authService`

`src/services/auth.service.ts`

```ts
export const authService = {
  login(payload: LoginPayload): Promise<LoginResponse>;
  register(payload: RegisterPayload): Promise<RegisterResponse>;
  logout(): Promise<void>;
  profile(): Promise<User>;
};
```

### `login`

- `POST /auth/login/`
- On success, **writes** the tokens + user to `tokenStore` as a side-effect.
  This is one of the only services that has a side-effect, and it is
  deliberate — the alternative would be to write them inside `useAuth()`,
  but then a non-hook caller (e.g. a test bootstrap) would have no clean
  path to log in.

### `register`

- `POST /auth/register/`
- If the response includes `tokens`, stores them. Otherwise returns the user
  only — the UI should prompt the user to sign in.

### `logout`

- `POST /auth/logout/` with `{ refresh: <token> }`.
- Wrapped in `try/catch`: even if the API call fails (commonly because the
  refresh token has expired), the client clears the local state.

### `profile`

- `GET /auth/profile/`
- Returns the up-to-date `User`. Used by `useAuth` as a background
  revalidator so changes made elsewhere (e.g. CLI updating the user's name)
  appear on the web.

---

## `reposService`

`src/services/repos.service.ts`

```ts
export const reposService = {
  list(): Promise<Repository[]>;
  create(payload: CreateRepoPayload): Promise<Repository>;
  detail(ownerId: number | string, name: string): Promise<Repository>;
  remove(ownerId: number | string, name: string): Promise<void>;
};
```

### `list`

- `GET /repos/`
- Returns every repo the current user can see (owner or collaborator,
  depending on backend rules).

### `create`

- `POST /repos/create/` with `{ name, description?, is_private?, default_branch? }`.
- The API responds `{ message, repository }`; the service returns just the
  `repository`.

### `detail`

- `GET /repos/{ownerId}/{name}/`
- `name` is URL-encoded so spaces and other special characters survive.

### `remove`

- `DELETE /repos/{ownerId}/{name}/delete/`
- Returns nothing. The caller (the hook) is responsible for cleaning up
  caches.

---

## `gitService`

`src/services/git.service.ts`

```ts
export const gitService = {
  branches(ownerId, name): Promise<Branch[]>;
  branchDetail(ownerId, name, branchName): Promise<Branch>;
  commits(ownerId, name): Promise<Commit[]>;
  commitDetail(ownerId, name, sha): Promise<Commit>;
  tags(ownerId, name): Promise<Tag[]>;
  tree(ownerId, name, sha): Promise<Tree>;
  blob(ownerId, name, sha): Promise<Blob>;
};
```

URL helper at the top of the file:

```ts
const repoBase = (ownerId, name) =>
  `/repos/${ownerId}/${encodeURIComponent(name)}`;
```

Each method composes this base + the resource path. URL building never
happens at call sites.

### `branches` / `branchDetail`

- `GET /repos/{owner}/{name}/branches/`
- `GET /repos/{owner}/{name}/branches/{branchName}/` — `branchName` is also
  URL-encoded.

### `commits` / `commitDetail`

- `GET /repos/{owner}/{name}/commits/`
- `GET /repos/{owner}/{name}/commits/{sha}/`

### `tags`

- `GET /repos/{owner}/{name}/tags/`

### `tree`

- `GET /repos/{owner}/{name}/tree/{sha}/`
- The response contains `entries` (`type: "blob" | "tree"`). Render folders
  vs files using `entry.type`.

### `blob`

- `GET /repos/{owner}/{name}/blob/{sha}/`
- Returns `content` + `encoding`. The caller is responsible for handling
  `"base64"` blobs appropriately (or refusing to render them).

---

## Patterns

- **One axios call per method.** If a feature requires several, compose them in
  the hook, not the service (see `useBranchCommit`, or `useCommitDiff` which
  replays `commitDetail` + `tree` + `blob` to build a diff with no diff
  endpoint).
- **Return parsed data, not the AxiosResponse.** Use `const { data } = ...`
  and return `data`. The hook layer doesn't care about HTTP semantics.
- **Type the response.** `api.get<Branch[]>(...)` gives the rest of the
  pipeline strong types for free.
- **Encode URL segments.** Always `encodeURIComponent(name)` for any
  user-controlled path component.
- **Do not catch errors.** Let them bubble — the hook (or the api-client
  interceptor) is the right place to deal with them. The exception is
  `authService.logout`, which intentionally swallows errors so the client
  always reaches `tokenStore.clear()`.
