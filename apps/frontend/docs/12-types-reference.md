# 12 — Types Reference

`src/types/api.ts` is the single source of truth for every API shape the
frontend touches. Services import from it; hooks re-export those types via
their return values; components consume them as props.

> If a field appears on the wire but not in this file, **add it here first**.
> The compiler is our cheapest contract test.

---

## Authentication

```ts
type User = {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  date_joined: string;        // ISO-8601
  is_active: boolean;
};

type AuthTokens = {
  access: string;             // short-lived JWT
  refresh: string;            // long-lived JWT
};

type LoginPayload = {
  email: string;
  password: string;
};

type LoginResponse = {
  message: string;
  user: User;
  tokens: AuthTokens;
};

type RegisterPayload = {
  email: string;
  password: string;
  password_confirm: string;
  first_name?: string;
  last_name?: string;
};

type RegisterResponse = {
  message?: string;
  user: User;
  tokens?: AuthTokens;        // omitted if email verification is required
};
```

---

## Repositories

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

type CreateRepoPayload = {
  name: string;
  description?: string;
  is_private?: boolean;
  default_branch?: string;
};
```

---

## Git-shaped

### Branch

```ts
type Branch = {
  id: number;
  repository_name: string;
  name: string;
  commit_sha: string;         // 64-char hex; all-zeros means empty branch
  created_at: string;
  updated_at: string;
};
```

### Commit

```ts
type Commit = {
  id: number;
  sha: string;
  message: string;
  author_name: string;
  author_email: string;
  tree_sha: string;
  parent_shas: string[];      // empty for the root commit
  committed_at: string;
};
```

### Tag

```ts
type Tag = {
  id: number;
  name: string;
  commit_sha: string;
  message: string;
  annotated: boolean;         // true → "annotated tag", false → "lightweight"
  created_at: string;
};
```

### Tree / TreeEntry

```ts
type TreeEntryType = "blob" | "tree";

type TreeEntry = {
  type: TreeEntryType;
  mode: string;               // e.g. "100644", "040000"
  name: string;
  sha: string;
};

type Tree = {
  id: number;
  sha: string;
  entries: TreeEntry[];
  created_at: string;
};
```

### Blob

```ts
type Blob = {
  id: number;
  sha: string;
  size: number;               // bytes
  content: string;            // utf-8 text or base64-encoded binary
  encoding: "utf-8" | "base64";
  created_at: string;
};
```

---

## Error envelope

```ts
type ApiErrorBody = {
  error?: string;
  detail?: string;
  message?: string;
  [field: string]: unknown;   // catch-all for field validation errors
};
```

`readApiError(err)` walks this in order: `error` → `detail` → `message` →
first string field. Components should never inspect the body directly.

---

## Conventions

- Field names are kept in **`snake_case`** to mirror the API. The mental
  overhead of mapping to camelCase across every type is worse than living
  with snake_case in TS — and it makes copy-paste from API docs reliable.
- All timestamps are **ISO-8601 strings**. Convert to relative time via
  `timeAgo()` from `src/lib/utils.ts` at the render boundary.
- All identifiers from the API are **numbers** (`id`, `owner_id`). Strings
  appear at call sites because they often arrive from `useParams` — convert
  via `String(ownerId)` when building query keys.

---

## Extending the types

Recipe:

1. Add the new shape here, with JSDoc on any non-obvious field.
2. Use it in the corresponding `*.service.ts` (`api.get<NewShape>(...)`).
3. Use it in the corresponding `use-*.ts`.
4. If the wire shape changes, *change this file*, not the call sites. The
   compiler will sweep through everything that needs updating.
