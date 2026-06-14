# 08 — API Integration

The frontend consumes the Gent REST API at:

```
https://gent-api.onrender.com/api/
```

Override the base URL via `NEXT_PUBLIC_GENT_API_URL` in `.env.local`.

Every call goes through `src/lib/api-client.ts` (one axios instance) →
`src/services/*.service.ts` (typed wrappers) → `src/hooks/use-*.ts` (cache).

---

## Endpoint reference

### Auth

| Method | Path                          | Service call               | Hook                |
|--------|-------------------------------|----------------------------|---------------------|
| POST   | `/auth/login/`                | `authService.login`        | `useAuth().login`   |
| POST   | `/auth/register/`             | `authService.register`     | `useAuth().register`|
| GET    | `/auth/profile/`              | `authService.profile`      | `useAuth()` (background) |
| POST   | `/auth/logout/`               | `authService.logout`       | `useAuth().logout`  |
| POST   | `/auth/token/refresh/`        | (axios interceptor only)   | — implicit          |

### Repositories

| Method | Path                                    | Service call             | Hook              |
|--------|-----------------------------------------|--------------------------|-------------------|
| GET    | `/repos/`                               | `reposService.list`      | `useReposList`    |
| POST   | `/repos/create/`                        | `reposService.create`    | `useCreateRepo`   |
| GET    | `/repos/{owner}/{name}/`                | `reposService.detail`    | `useRepoDetail`   |
| DELETE | `/repos/{owner}/{name}/delete/`         | `reposService.remove`    | `useDeleteRepo`   |

### Git-shaped

| Method | Path                                                | Service call              | Hook                |
|--------|-----------------------------------------------------|---------------------------|---------------------|
| GET    | `/repos/{owner}/{name}/branches/`                   | `gitService.branches`     | `useBranches` (poll)|
| GET    | `/repos/{owner}/{name}/branches/{branchName}/`      | `gitService.branchDetail` | `useBranchCommit`   |
| GET    | `/repos/{owner}/{name}/commits/`                    | `gitService.commits`      | `useCommits` (poll) |
| GET    | `/repos/{owner}/{name}/commits/{sha}/`              | `gitService.commitDetail` | `useBranchCommit`   |
| GET    | `/repos/{owner}/{name}/tags/`                       | `gitService.tags`         | `useTags` (poll)    |
| GET    | `/repos/{owner}/{name}/tree/{sha}/`                 | `gitService.tree`         | `useTree`           |
| GET    | `/repos/{owner}/{name}/blob/{sha}/`                 | `gitService.blob`         | `useBlob`           |

**(poll)** = refetches every 12 seconds.

---

## Request anatomy

Every request goes out as:

```
GET /repos/ HTTP/1.1
Host: gent-api.onrender.com
Accept: application/json
Content-Type: application/json
Authorization: Bearer <access_token>     ← injected by request interceptor
```

The `Authorization` header is only added if `tokenStore.getAccess()` returns
a token. Public endpoints (none currently, but in principle) work without it.

URL parameter encoding: repo names go through `encodeURIComponent` (`src/services/repos.service.ts` and `git.service.ts`) so names like `my repo` survive the trip.

---

## Response shapes

All shapes live in `src/types/api.ts`. The important ones:

```ts
type Repository = {
  id: number;
  owner_id: number;
  owner_email: string;
  name: string;
  description: string;
  is_private: boolean;
  default_branch: string;
  created_at: string;
  updated_at: string;
};

type Branch = {
  id: number;
  repository_name: string;
  name: string;
  commit_sha: string;       // 64-char hex; all zeros means "empty branch"
  created_at: string;
  updated_at: string;
};

type Commit = {
  id: number;
  sha: string;
  message: string;
  author_name: string;
  author_email: string;
  tree_sha: string;
  parent_shas: string[];
  committed_at: string;
};

type Tag = {
  id: number;
  name: string;
  commit_sha: string;
  message: string;
  annotated: boolean;
  created_at: string;
};

type Tree = { id: number; sha: string; entries: TreeEntry[]; created_at: string };
type TreeEntry = { type: "blob" | "tree"; mode: string; name: string; sha: string };

type Blob = {
  id: number;
  sha: string;
  size: number;
  content: string;
  encoding: "utf-8" | "base64";
  created_at: string;
};
```

> A `commit_sha` of all-zeros (`"0".repeat(64)`) is a sentinel value: a brand
> new branch with no commits yet. The helper `isEmptySha(sha)` in
> `src/hooks/use-git.ts` checks for it. The UI shows an "empty branch"
> placeholder instead of trying to fetch the commit.

---

## Errors

The API returns JSON error bodies in several shapes:

```json
{ "error": "Invalid credentials." }
{ "detail": "Authentication credentials were not provided." }
{ "message": "..." }
{ "email": ["This field is required."] }
```

`readApiError(err)` in `src/lib/api-client.ts` walks them in priority order
and returns a clean string. Always use it instead of digging through the
axios error yourself:

```ts
onError: (err) => toast.error(readApiError(err)),
```

HTTP status codes you should expect to handle:

| Status | What it means                                    | Where it's handled                            |
|--------|--------------------------------------------------|-----------------------------------------------|
| 200/201| Success                                          | Component renders the data                    |
| 400    | Validation error                                 | Toast + show error on the form                |
| 401    | Token missing or expired                         | Interceptor refreshes; if that fails, logout  |
| 403    | Authenticated but not allowed                    | Toast; usually means stale UI state           |
| 404    | Repo / branch / commit not found                 | EmptyState with "back to dashboard"           |
| 5xx    | Server crashed                                   | Toast; retry once (TanStack default)          |

---

## Adding a new endpoint

Recipe — follow it strictly:

1. **Type it.** Add request and response types to `src/types/api.ts`.
2. **Service it.** Add a method to the matching `*.service.ts` (or create a
   new one). Keep it small — make the call and return the parsed body.
3. **Hook it.** Add a query or mutation to the matching `use-*.ts`. Add a
   query key constant if there isn't one yet.
4. **Use it.** Call the hook from a page or feature component.
5. **Document it.** Update this file's tables. Skipping this step is how
   docs go stale.

What **not** to do:

- Do not call axios from a component.
- Do not call axios from a service for a different domain (don't reach into
  `git.service.ts` from `auth.service.ts`).
- Do not hardcode the base URL — always use the `api` instance.
- Do not bypass the token interceptor by creating a fresh axios instance.
- Do not let response shapes leak `snake_case` into UI props if you can map
  them at the service boundary — but `Repository`, `Branch`, `Commit`,
  `Commit` are kept in their server shape today (`owner_email`,
  `committed_at`), because the cost of mapping outweighs the benefit. If
  you do introduce mapping, do it once at the service layer.
