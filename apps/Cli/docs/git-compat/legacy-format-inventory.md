# Legacy persistent-format inventory (pre-v13)

Every persistent read/write in the v12 CLI, with the owner that replaces it.
"Owner" is the module that becomes the single authority after the phase lands.
Nothing outside the owner may read or write that state once the phase closes.

## Repository state files under `.gent/`

| Legacy file | Shape | Written by | Read by | Replaced by | Phase |
| --- | --- | --- | --- | --- | --- |
| `commits.json` | `{ commits: [{hash, message, author{name,email}, timestamp(ISO), parent, mergeParent?, treeHash, tree[], files[], stats{}}], branches: {name: hash\|null}, currentBranch }` | `commit`, `merge`, `resolve`, `reset`, `branch`, `checkout`, `clone`, `pull`, `tag`, `stash`, `journal` | 27 modules (see below) | commit objects in the object store + `refs/heads/*` + `HEAD` (`refs.js`) | 1, 2, 5 |
| `staging.json` | `{ files: [path], entries: [{path, hash, status, stats}], mergeState: {...}\|null }` | `add`, `rm`, `commit`, `reset`, `stash`, `merge`, `resolve`, `clone`, `init` | `status`, `diff`, `explain`, `review` | binary `index` (`git-index.js`) + `MERGE_HEAD`/`MERGE_MSG` | 3, 5 |
| `config.json` | `{ user{name,email}, repository{name,description,created}, remotes{origin{url}}, ai{...}, ... }` | `init`, `config`, `remote`, `push`, `clone` | 21 modules | `config` in Git config syntax (`git-config.js`); non-Git Gent keys move to `gent/config.json` under the gitdir | 2, 5 |
| `journal.json` | `{ entries: [{id, label, description, at, before{branches,currentBranch}, after{...}, restoreTree?}], redo: [] }` | `journal.recordOp` | `undo`, `redo` | `gent/journal.json` + object roots pinned under `refs/gent/journal/*` | 5 |
| `stash.json` | `{ stack: [{message, at, entries[], files[]}] }` | `stash` | `stash` | real stash commits + `refs/stash` reflog | 5 |
| `HEAD` | `ref: refs/heads/<name>\n` — written at init, **never updated**; `currentBranch` in `commits.json` was the real HEAD | `init` | nothing | authoritative `HEAD` (symbolic / detached), `refs.js` | 2 |
| `refs/heads/`, `refs/tags/` | created empty at init, **never populated** | `init` | nothing | loose refs + `packed-refs`, `refs.js` | 2 |
| `objects/<2>/<62>` | zlib(`"<type> <size>\0" + payload`); `blob` payload is raw bytes (**already canonical**), `tree` payload is JSON `[{mode,name,hash,type}]` sorted by `localeCompare` (**not canonical**) | `hash-engine.storeBlob/storeTree` | same | canonical loose objects, `object-store.js` | 1 |
| `objects/<hash>.blob` | uncompressed raw bytes — dead code path in `utils/object-store.js`; **zero consumers** (verified by grep) | — | — | deleted; the name is reused by the canonical store | 1 |

### `commits.json` reader modules

`utils/fileSystem.getTrackedFiles`, `utils/journal`, `utils/interactive`, and
commands `commit, reset, show, ask, pull, branch, review, log, status, stash,
merge, init, clone, add, summary, tag, share, push, explain, changelog, diff,
resolve, checkout`.

## Identity and hashing facts that change

- `helpers.generateCommitHash()` returns `sha256(Date.now() + Math.random())`.
  Commit IDs are **random**, not content-derived. They cannot survive
  migration; Phase 8 records an old→new mapping instead.
- `hash-engine.hashBlob` already computes `sha256("blob <len>\0" + bytes)`.
  Blob IDs are therefore **canonical today** — Phase 8 verifies each stored
  blob rather than assuming it.
- `hash-engine.hashTree` frames as `tree` but serializes JSON with
  slash-separated flat paths, `localeCompare` ordering and a `type` field.
  Tree IDs are **not** canonical and all change.
- Modes are hardcoded `100644`. Executable bits and symlinks are lost.
- Commit `timestamp` is an ISO-8601 string in local time with no timezone
  offset preserved and no separate committer identity.

## Ignore behaviour that changes (breaking)

`constants.DEFAULT_IGNORE_PATTERNS` silently excludes `.gent`, `node_modules`,
`.git`, `.gitignore`, `.gentignore`, `.DS_Store`, `*.log`, `.env`,
`.env.local`, `dist`, `build`, `coverage`, `.vscode`, `.idea` — regardless of
any `.gitignore`. Notably **`.gitignore` itself is unversionable today**.

Under v13 only `/.gent/` is implicit (via `info/exclude`). Every other entry
above becomes an ordinary ignore rule that the user's own files must declare.
`gent migrate` materialises the intended subset into `.gitignore` and prints a
diff of files that become visible.

## Remote / API state

`config.remotes.origin.url` holds `/api/repos/<owner_id>/<repo_name>`, parsed
by `constants.parseRemoteUrl`. Credentials live in `~/.gent/` via
`utils/auth-storage.js` and stay there — Phase 7 adds smart-HTTP URLs
alongside, and never writes credentials into the repository.
