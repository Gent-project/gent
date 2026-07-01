# Gent CLI — Architecture & Backend Specification

> Complete technical documentation for the Gent version control system.  
> Version 7.0.0
>
> See also: [ALGORITHMS.md](ALGORITHMS.md) (diff/merge/hash deep dive) and
> [COMMANDS.md](COMMANDS.md) (full command reference).

---

## Table of Contents

1. [Overview](#1-overview)
2. [Directory Structure](#2-directory-structure)
3. [.gent/ Repository Layout](#3-gent-repository-layout)
4. [Algorithms](#4-algorithms)
5. [Command Reference](#5-command-reference)
6. [Data Models](#6-data-models)
7. [Backend API Specification](#7-backend-api-specification)
8. [Push/Pull Protocol](#8-pushpull-protocol)
9. [Security](#9-security)
10. [Extending Gent](#10-extending-gent)

---

## 1. Overview

Gent is a Git-like version control CLI that stores data locally in `.gent/` and syncs to a cloud backend via REST API. It provides:

- **Content-addressable object store** (SHA-256 + zlib compression)
- **Line-level LCS diff** with prefix/suffix trimming and unified diff output
- **Three-way smart merge (diff3)** with language-aware auto-resolution (JSON, imports)
- **Operation journal** with one-command `undo` / `redo` (friendlier than reflog)
- **Interactive conflict resolver** (`gent resolve`)
- **Repository dashboard** (`gent summary`) and ASCII commit graph (`log --graph`)
- **Optional AI layer** (key-gated): commit messages, diff explanations, conflict help
- **Branching, tagging, stashing** — full local workflow
- **Push/Pull/Clone** — cloud sync with JWT authentication

### Architecture Diagram

```
┌─────────────────────────────────────────────────────┐
│                   User Commands                     │
│  init │ add │ commit │ diff │ merge │ push │ pull   │
└──────────────┬──────────────────────────────────────┘
               │
┌──────────────▼──────────────────────────────────────┐
│                  Engine Layer                       │
│ hash-engine.js  │  diff-engine.js  │ merge-engine.js│
└──────────────┬──────────────────────────────────────┘
               │
┌──────────────▼──────────────────────────────────────┐
│              Local Storage (.gent/)                 │
│  objects/  │  commits.json  │  staging.json  │ HEAD │
└──────────────┬──────────────────────────────────────┘
               │ (push/pull via REST)
┌──────────────▼──────────────────────────────────────┐
│              Backend API Server                     │
│  /api/auth/*  │  /api/repos/:id/*                   │
│  Blob Store   │  Commit DB  │  Branch Refs          │
└─────────────────────────────────────────────────────┘
```

---

## 2. Directory Structure

```
src/
├── index.js                 # CLI entry point (commander.js)
├── commands/
│   ├── init.js              # Initialize repository
│   ├── clone.js             # Clone remote repository
│   ├── add.js               # Stage files (snapshot blobs + diff stats)
│   ├── rm.js                # Remove files from tracking
│   ├── reset.js             # Unstage or reset HEAD
│   ├── status.js            # Working tree status
│   ├── diff.js              # Show file diffs
│   ├── commit.js            # Create commits with tree objects
│   ├── log.js               # Commit history
│   ├── show.js              # Commit details + diff
│   ├── tag.js               # Tag management
│   ├── branch.js            # Branch management
│   ├── checkout.js          # Switch branches
│   ├── merge.js             # 3-way smart merge (diff3)
│   ├── resolve.js           # Interactive conflict resolver
│   ├── stash.js             # Stash working changes
│   ├── undo.js              # undo/redo over the operation journal
│   ├── summary.js           # Repository health dashboard
│   ├── explain.js           # Plain-language commit/diff explanation
│   ├── remote.js            # Configure remotes
│   ├── push.js              # Upload to remote
│   ├── pull.js              # Download + merge from remote
│   ├── register.js          # User registration
│   ├── login.js             # JWT authentication
│   ├── logout.js            # Clear auth tokens
│   └── whoami.js            # Current user info
├── utils/
│   ├── hash-engine.js       # SHA-256 blob/tree store + FNV-1a line hash
│   ├── diff-engine.js       # LCS line diff (prefix/suffix trimmed) + hunks
│   ├── merge-engine.js      # diff3 merge + JSON/import-aware + tree merge + DAG merge base
│   ├── journal.js           # Operation journal (undo/redo)
│   ├── ai-service.js        # Optional, key-gated Claude integration
│   ├── fileSystem.js        # File I/O helpers
│   ├── helpers.js           # General utilities
│   ├── constants.js         # Config values + API endpoints
│   ├── api-client.js        # Axios HTTP client with JWT refresh
│   └── auth-storage.js      # Encrypted token storage (AES)
└── services/
    └── auth-service.js      # Auth API operations
```

---

## 3. .gent/ Repository Layout

```
.gent/
├── config.json              # Repo config + user + remotes
├── commits.json             # Full commit history + branches + tags
├── staging.json             # Current staging area (entries + merge state)
├── stash.json               # Stash stack (created on first stash)
├── journal.json             # Operation journal for undo/redo (created on first op)
├── HEAD                     # Current branch ref
├── objects/                 # Content-addressable blob/tree store
│   ├── ab/                  # 2-char prefix directory
│   │   └── cdef1234...      # zlib-compressed object file
│   └── ...
└── refs/
    ├── heads/               # Branch refs (reserved for future)
    └── tags/                # Tag refs (reserved for future)
```

### config.json

```json
{
  "user": { "name": "...", "email": "..." },
  "repository": { "name": "my-project", "description": "..." },
  "remotes": {
    "origin": { "url": "https://gent-api.onrender.com/api/repos/123/" }
  },
  "remoteRefs": {
    "origin/main": "<last-pushed-commit-hash>"
  }
}
```

### commits.json

```json
{
  "commits": [
    {
      "hash": "sha256...",
      "message": "Initial commit",
      "author": { "name": "...", "email": "..." },
      "timestamp": "2026-04-15T10:00:00.000Z",
      "parent": null,
      "mergeParent": null,
      "treeHash": "sha256...",
      "tree": [
        { "mode": "100644", "name": "src/index.js", "hash": "sha256...", "type": "blob" }
      ],
      "files": [{ "path": "src/index.js", "hash": "sha256..." }],
      "stats": { "filesChanged": 1, "insertions": 50, "deletions": 0 }
    }
  ],
  "branches": { "main": "<hash>", "feature": "<hash>" },
  "currentBranch": "main",
  "tags": {
    "v1.0.0": { "hash": "<commit-hash>", "message": "Release", "annotated": true }
  }
}
```

### staging.json

```json
{
  "entries": [
    {
      "path": "src/app.js",
      "hash": "sha256...",
      "status": "modified",
      "binary": false,
      "stats": { "insertions": 5, "deletions": 2 }
    }
  ],
  "files": ["src/app.js"],
  "mergeState": null
}
```

---

## 4. Algorithms

### 4.1 Hashing — SHA-256 Content Addressing

**Location:** `src/utils/hash-engine.js`

```
Input:  "<type> <byte-length>\0<raw-content>"
Hash:   SHA-256 → 64-char hex string
Store:  zlib.deflate(input) → .gent/objects/<first-2-chars>/<rest>
```

**Why SHA-256 over SHA-1:**
- SHA-1 has known collision attacks (SHAttered, 2017)
- SHA-256 provides 128-bit collision resistance
- Node.js `crypto` module supports both equally fast

**Deduplication:** Before writing, check if `objects/<prefix>/<rest>` exists. Same content → same hash → skip write. This means renaming a file costs zero storage.

**Line-level hashing (FNV-1a 32-bit):**
- Used internally by diff engine for fast line comparison
- Non-cryptographic, 32-bit → fast but NOT for security
- Produces 8-char hex string per line

### 4.2 Diff — Longest Common Subsequence (LCS)

**Location:** `src/utils/diff-engine.js`

**Algorithm:**

```
Given: oldLines[0..M-1], newLines[0..N-1]

1. Build DP matrix dp[M+1][N+1]:
   dp[0][*] = 0, dp[*][0] = 0
   if old[i-1] == new[j-1]: dp[i][j] = dp[i-1][j-1] + 1
   else:                     dp[i][j] = max(dp[i-1][j], dp[i][j-1])

2. Backtrack from dp[M][N]:
   - old[i-1] == new[j-1] → EQUAL, move diagonal
   - dp[i][j-1] >= dp[i-1][j] → INSERT (new line added), move left
   - else → DELETE (old line removed), move up

3. Reverse operations → chronological order
```

**Complexity:** Time O(M×N), Space O(M×N) using `Uint32Array`.

**Prefix/suffix trimming:** identical leading and trailing lines are stripped
before the matrix is built; LCS runs only on the differing middle, and the
trimmed lines are re-attached as `equal` ops at their original positions. Output
is byte-identical, but a localized edit in a large file costs a matrix sized to
the change, not the whole file. See [ALGORITHMS.md §2.2](ALGORITHMS.md#22-prefixsuffix-trimming-the-optimization).

**Hunk Generation:**
- Group changes within `2*contextLines+1` of each other into hunks
- Default 3 context lines (same as `git diff`)
- Output format: `@@ -oldStart,oldCount +newStart,newCount @@`

### 4.3 Three-Way Merge

**Location:** `src/utils/merge-engine.js`

**Algorithm (diff3):**

```
Inputs: BASE (common ancestor), OURS (current), THEIRS (incoming)

1. Diff BASE→OURS and BASE→THEIRS (LCS, §4.2).
2. A base line is a STABLE ANCHOR when it survives unchanged in BOTH sides;
   at an anchor all three files are synchronized. (LCS matches are monotonic,
   so the shared anchor set is monotonic in all three index spaces.)
3. Walk anchors in order. Between two consecutive anchors lies one UNSTABLE
   region: baseSeg / oursSeg / theirsSeg (each possibly empty).
4. Classify and resolve each region (table below), then emit the anchor line.
```

This replaced an earlier region-walk that **looped forever on one-sided pure
insertions** (a region consuming zero base lines never advanced) and could
**drop overlapping edits**. Both are now regression-tested. Full write-up:
[ALGORITHMS.md §3](ALGORITHMS.md#3-three-way-merge--diff3).

**Resolution Rules (per unstable region):**

| Region situation | Action |
|---|---|
| Neither side changed it | Keep BASE |
| Only OURS changed | Take OURS |
| Only THEIRS changed | Take THEIRS |
| Both changed identically | Take either |
| Both changed, same length, disjoint lines | Sub-merge line-by-line |
| Whitespace-only difference | Take OURS |
| Both added import/require lines (empty base) | Union them |
| Otherwise (true overlap) | **CONFLICT** — insert markers |

**Language-aware file merge:** `mergeFileContent` dispatches by file type before
the line merge and always falls back to conflict markers when unsure — JSON
files get a key-level 3-way merge (e.g. disjoint `package.json` dependency
additions auto-resolve); additive import/require blocks are unioned.

**Merge Base Finder (DAG-aware):**
```
Traverse BOTH `parent` and `mergeParent` edges (correct once merges exist):
1. Collect all ancestors of OURS into a Set (both edges).
2. BFS from THEIRS (nearest-first) → first node in the Set = merge base.
```

### 4.4 Tree-Level Merge

For each file path across all three trees:

| Base | Ours | Theirs | Result |
|---|---|---|---|
| — | A | A | Keep A (identical add) |
| — | A | B | Content merge (add/add) |
| A | A | A | No change |
| A | B | A | Take B (only ours changed) |
| A | A | B | Take B (only theirs changed) |
| A | B | B | Take B (identical change) |
| A | B | C | Content merge (both changed) |
| A | — | A | Delete (ours deleted) |
| A | A | — | Delete (theirs deleted) |
| A | B | — | **CONFLICT** (modify/delete) → keep B |
| A | — | B | **CONFLICT** (modify/delete) → keep B |

### 4.5 Operation Journal (undo / redo)

**Location:** `src/utils/journal.js`

Before any history-changing command (commit, merge, reset, checkout, branch
delete) writes `commits.json`, `recordOp` snapshots the `branches` map and
`currentBranch` into `.gent/journal.json` (`{ entries, redo }`, capped at 100).
`gent undo` restores the last snapshot (and, for content-discarding ops flagged
`restoreTree`, rewrites working files from the object store — it never deletes
them); `gent redo` is the mirror. One generic mechanism reverses every command.
See [ALGORITHMS.md §4](ALGORITHMS.md#4-operation-journal-undo--redo).

### 4.6 Optional AI Layer

**Location:** `src/utils/ai-service.js`

A key-gated client over the Anthropic Messages API (via the existing `axios`
dependency) powering optional enhancements only: commit-message suggestions
(`commit --ai`), diff explanations (`explain`), AI-assisted conflict resolution
(`resolve`), and a health narrative (`summary --ai`). Enabled by
`ANTHROPIC_API_KEY`; model via `GENT_AI_MODEL` (default `claude-opus-4-8`).
Absent key or failed request → graceful fallback to the algorithmic path.

---

## 5. Command Reference

### Repository Setup

| Command | Description |
|---|---|
| `gent init [-y]` | Initialize `.gent/` directory |
| `gent clone <url> [dir]` | Download full repo from remote |

### Staging & Working Tree

| Command | Description |
|---|---|
| `gent add <files...> [-A]` | Snapshot files → blob store + diff stats |
| `gent rm <files...> [--cached]` | Remove files from tracking |
| `gent reset [files...] [--hard\|--soft <hash>]` | Unstage or reset HEAD |
| `gent status [-s]` | Show staged/modified/untracked/deleted |
| `gent diff [files...] [--staged] [--stat]` | Line-level unified diff |

### History

| Command | Description |
|---|---|
| `gent commit [-m <msg>] [-a] [--ai]` | Create commit; `--ai` suggests a message |
| `gent log [-n <N>] [--oneline] [--graph] [--stat]` | Commit history; `--graph` = ASCII DAG |
| `gent show [ref] [--no-patch]` | Commit details + diff |
| `gent tag [name] [-m <msg>] [-d <name>]` | Tag management |
| `gent explain [ref] [--staged]` | Plain-language summary of a commit/diff |

### Branching & Merging

| Command | Description |
|---|---|
| `gent branch [name] [-d <name>] [-a]` | Branch management |
| `gent checkout <branch> [-b]` | Switch branches |
| `gent merge <branch> [-m <msg>]` | 3-way smart merge (diff3) |
| `gent resolve` | Interactively resolve merge conflicts |
| `gent stash [pop\|list\|drop\|apply] [-m <msg>]` | Stash changes |

### Safety & Insight

| Command | Description |
|---|---|
| `gent undo [--list]` | Reverse the last history-changing op; `--list` shows history |
| `gent redo` | Re-apply the last undone op |
| `gent summary [--ai]` | Repository health & statistics dashboard |

### Remote & Sync

| Command | Description |
|---|---|
| `gent remote [add\|remove\|set-url] [-v]` | Configure remotes |
| `gent push [remote] [branch] [-f]` | Upload commits + objects |
| `gent pull [remote] [branch]` | Download + merge remote |

### Authentication

| Command | Description |
|---|---|
| `gent register` | Create user account |
| `gent login [-e <email>] [-p <pass>]` | JWT login |
| `gent logout` | Clear tokens |
| `gent whoami` | Current user info |

---

## 6. Data Models

### Blob Object
```
Type: "blob"
Storage: .gent/objects/<prefix>/<rest>
Content: zlib( "blob <byteLength>\0<rawFileContent>" )
Hash: SHA-256 of uncompressed content with header
```

### Tree Object
```
Type: "tree"
Storage: .gent/objects/<prefix>/<rest>
Content: zlib( "tree <byteLength>\0<JSON array of entries>" )
Entry: { mode: "100644", name: "path/file.js", hash: "<blobHash>", type: "blob" }
Entries sorted alphabetically by name for deterministic hashing.
```

### Commit Object
```json
{
  "hash": "<SHA-256 of timestamp+random>",
  "message": "commit message",
  "author": { "name": "...", "email": "..." },
  "timestamp": "ISO-8601",
  "parent": "<parentCommitHash | null>",
  "mergeParent": "<secondParentHash | null>",
  "treeHash": "<treeObjectHash>",
  "tree": [/* tree entries */],
  "files": [{ "path": "...", "hash": "..." }],
  "stats": { "filesChanged": N, "insertions": N, "deletions": N }
}
```

### Staging Entry
```json
{
  "path": "relative/path",
  "hash": "<blobHash | null for deleted>",
  "status": "added | modified | deleted",
  "binary": false,
  "stats": { "insertions": N, "deletions": N }
}
```

---

## 7. Backend API Specification

The backend must implement these endpoints for full push/pull/clone support.

### 7.1 Authentication

| Method | Endpoint | Body | Response |
|---|---|---|---|
| POST | `/api/auth/register/` | `{ email, password, password_confirm, first_name, last_name }` | `{ tokens: { access, refresh }, user }` |
| POST | `/api/auth/login/` | `{ email, password }` | `{ tokens: { access, refresh }, user }` |
| POST | `/api/auth/logout/` | `{ refresh }` | `{ message }` |
| POST | `/api/auth/token/refresh/` | `{ refresh }` | `{ access }` |
| GET | `/api/auth/profile/` | — | `{ id, email, first_name, last_name }` |

All repo endpoints require `Authorization: Bearer <accessToken>`.

### 7.2 Repository Management

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/repos/` | Create repository `{ name, description }` → `{ id, name, ... }` |
| GET | `/api/repos/` | List user's repositories |
| GET | `/api/repos/:id/` | Get repository metadata |
| DELETE | `/api/repos/:id/` | Delete repository |

### 7.3 Push (Client → Server)

```
POST /api/repos/:id/push/
Authorization: Bearer <token>
Content-Type: application/json

{
  "branch": "main",
  "force": false,
  "commits": [
    {
      "hash": "abc123...",
      "message": "Add feature",
      "author": { "name": "...", "email": "..." },
      "timestamp": "2026-04-15T10:00:00Z",
      "parent": "<hash | null>",
      "mergeParent": "<hash | null>",
      "treeHash": "def456...",
      "tree": [ { "mode": "100644", "name": "file.js", "hash": "...", "type": "blob" } ],
      "files": [ { "path": "file.js", "hash": "..." } ],
      "stats": { "filesChanged": 1, "insertions": 10, "deletions": 0 }
    }
  ],
  "objects": [
    {
      "hash": "sha256...",
      "type": "blob",
      "data": "<base64-encoded raw file content>"
    }
  ],
  "tags": {
    "v1.0.0": { "hash": "abc123...", "message": "Release 1.0" }
  }
}
```

**Backend Processing:**
1. Verify JWT token → get user → check repo permissions
2. If `force=false`: verify client's commits are fast-forward from server's branch HEAD
3. If not fast-forward and not force: return `409 Conflict`
4. Store each blob object (skip if hash already exists — dedup)
5. Append commits to branch history
6. Update branch ref to latest commit hash
7. Store/update tags
8. Return `{ success: true, ref: "refs/heads/main", hash: "<newHead>" }`

### 7.4 Pull (Server → Client)

```
GET /api/repos/:id/pull/?branch=main&since=<lastKnownHash>
Authorization: Bearer <token>

Response:
{
  "branch": "main",
  "head": "<currentRemoteHead>",
  "commits": [ /* commits since <lastKnownHash> */ ],
  "objects": [
    {
      "hash": "sha256...",
      "type": "blob",
      "data": "<base64>"
    }
  ]
}
```

**Backend Processing:**
1. Walk commit chain from branch HEAD back to `since` hash
2. Collect all commits in that range
3. Collect all unique blob hashes referenced by those commits
4. Base64-encode blob data
5. Return commits + objects

### 7.5 Clone (Full Download)

```
GET /api/repos/:id/clone/
Authorization: Bearer <token>

Response:
{
  "name": "my-project",
  "description": "...",
  "commits": [ /* ALL commits */ ],
  "objects": [ /* ALL blob objects as base64 */ ],
  "branches": { "main": "<hash>", "feature": "<hash>" },
  "currentBranch": "main",
  "tags": { "v1.0": { "hash": "...", "message": "..." } }
}
```

### 7.6 Refs

```
GET /api/repos/:id/refs/
Response:
{
  "branches": { "main": "<hash>", "feature": "<hash>" },
  "tags": { "v1.0": "<hash>" }
}
```

### 7.7 Tags

| Method | Endpoint | Body | Description |
|---|---|---|---|
| GET | `/api/repos/:id/tags/` | — | List all tags |
| POST | `/api/repos/:id/tags/` | `{ name, hash, message?, annotated? }` | Create tag |
| DELETE | `/api/repos/:id/tags/:name/` | — | Delete tag |

### 7.8 Commits

```
GET /api/repos/:id/commits/?branch=main&limit=10
Response: { commits: [...] }

GET /api/repos/:id/commits/:hash/
Response: { commit object with tree }
```

---

## 8. Push/Pull Protocol

### Push Flow

```
Client                                 Server
  │                                      │
  ├─ Read local commits since last push  │
  ├─ Collect blob objects from those     │
  │  commits                             │
  ├─ Base64 encode blobs                 │
  ├─ POST /push/ {commits, objects}  ──► │
  │                                      ├─ Verify JWT
  │                                      ├─ Check fast-forward
  │                                      ├─ Store blobs (dedup)
  │                                      ├─ Append commits
  │                                      ├─ Update branch ref
  │  ◄── { success, ref, hash }  ────────┤
  ├─ Update local remoteRefs             │
  │                                      │
```

### Pull Flow

```
Client                                 Server
  │                                      │
  ├─ GET /pull/?since=<lastRef>  ──────► │
  │                                      ├─ Walk commit chain
  │                                      ├─ Collect new commits
  │                                      ├─ Collect blob objects
  │  ◄── { commits, objects, head } ─────┤
  ├─ Store received blobs locally        │
  ├─ Append new commits                  │
  ├─ Check fast-forward?                 │
  │   YES → advance pointer              │
  │   NO  → 3-way merge                  │
  ├─ Update remoteRefs                   │
  │                                      │
```

### Clone Flow

```
Client                                 Server
  │                                      │
  ├─ GET /clone/  ─────────────────────► │
  │                                      ├─ Collect ALL data
  │  ◄── { name, commits, objects,  ─────┤
  │       branches, tags }               │
  ├─ Create .gent/ structure             │
  ├─ Store all blobs                     │
  ├─ Write commits.json                  │
  ├─ Configure origin remote             │
  ├─ Checkout HEAD (restore files)       │
  │                                      │
```

---

## 9. Security

### Authentication
- JWT Bearer tokens with automatic refresh
- Access token: short-lived (e.g., 15 min)
- Refresh token: longer-lived (e.g., 7 days)
- Tokens stored locally with AES encryption in `~/.gent/auth.json`
- Backend should blacklist refresh tokens on logout

### Transport
- All API calls over HTTPS
- Blob data transferred as base64 (safe for JSON transport)
- Backend should validate blob hash matches content on receive

### Authorization
- Backend must verify user has write access to repo on push
- Backend must verify user has read access on pull/clone
- Per-repository permissions: owner, collaborator, reader

### Data Integrity
- Every blob hash is verified on read (decompress → check hash)
- Commit hashes provide tamper detection
- Tree hashes ensure directory snapshot integrity

---

## 10. Extending Gent

### Adding a New Command

1. Create `src/commands/<name>.js` with documented header
2. Export a single async function
3. Register in `src/index.js` using commander
4. Add to this documentation
