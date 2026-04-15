# Gent CLI — Architecture & Backend Specification

> Complete technical documentation for the Gent version control system.  
> Version 2.0.0 | April 2026

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
- **Line-level LCS diff** with unified diff output
- **Three-way smart merge** with aggressive auto-resolution
- **Branching, tagging, stashing** — full local workflow
- **Push/Pull/Clone** — cloud sync with JWT authentication

### Architecture Diagram

```
┌─────────────────────────────────────────────────────┐
│                   User Commands                      │
│  init │ add │ commit │ diff │ merge │ push │ pull   │
└──────────────┬──────────────────────────────────────┘
               │
┌──────────────▼──────────────────────────────────────┐
│                  Engine Layer                         │
│  hash-engine.js  │  diff-engine.js  │ merge-engine.js│
└──────────────┬──────────────────────────────────────┘
               │
┌──────────────▼──────────────────────────────────────┐
│              Local Storage (.gent/)                   │
│  objects/  │  commits.json  │  staging.json  │ HEAD  │
└──────────────┬──────────────────────────────────────┘
               │ (push/pull via REST)
┌──────────────▼──────────────────────────────────────┐
│              Backend API Server                       │
│  /api/auth/*  │  /api/repos/:id/*                    │
│  Blob Store   │  Commit DB  │  Branch Refs           │
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
│   ├── merge.js             # 3-way smart merge
│   ├── stash.js             # Stash working changes
│   ├── remote.js            # Configure remotes
│   ├── push.js              # Upload to remote
│   ├── pull.js              # Download + merge from remote
│   ├── register.js          # User registration
│   ├── login.js             # JWT authentication
│   ├── logout.js            # Clear auth tokens
│   └── whoami.js            # Current user info
├── utils/
│   ├── hash-engine.js       # SHA-256 blob/tree store + FNV-1a line hash
│   ├── diff-engine.js       # LCS line diff + hunk generation
│   ├── merge-engine.js      # 3-way merge + tree merge + merge base
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

**Hunk Generation:**
- Group changes within `2*contextLines+1` of each other into hunks
- Default 3 context lines (same as `git diff`)
- Output format: `@@ -oldStart,oldCount +newStart,newCount @@`

### 4.3 Three-Way Merge

**Location:** `src/utils/merge-engine.js`

**Algorithm:**

```
Inputs: BASE (common ancestor), OURS (current), THEIRS (incoming)

1. diffOurs  = LCS_diff(BASE, OURS)
2. diffTheirs = LCS_diff(BASE, THEIRS)

3. Extract "change regions": contiguous modified areas anchored to BASE line indices
   Region = { baseStart, oldLines[], newLines[] }

4. Map regions by baseStart for O(1) lookup

5. Walk BASE line-by-line:
   For each base index:
     a) Check if OURS has a region starting here
     b) Check if THEIRS has a region starting here
     c) Apply resolution rules (see table below)
     d) Advance past consumed base lines
```

**Resolution Rules:**

| Ours Region? | Theirs Region? | Action |
|---|---|---|
| Yes | No | Take OURS new lines |
| No | Yes | Take THEIRS new lines |
| Yes (identical) | Yes (identical) | Take either |
| Yes (same length) | Yes (same length) | Sub-merge line-by-line |
| Yes (different) | Yes (different) | **CONFLICT** — insert markers |

**Sub-merge (fine-grained):**
When both sides modify a region to the same length:
- Compare line-by-line
- If line matches base → other side changed it → take that
- If both changed same line differently → CONFLICT
- Whitespace-only diff → take OURS

**Merge Base Finder:**
```
1. Walk OURS parent chain → collect all ancestors in Set
2. Walk THEIRS parent chain → first hash found in Set = merge base
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
| `gent commit [-m <msg>] [-a]` | Create commit with tree object |
| `gent log [-n <N>] [--oneline] [--stat]` | Commit history |
| `gent show [ref] [--no-patch]` | Commit details + diff |
| `gent tag [name] [-m <msg>] [-d <name>]` | Tag management |

### Branching & Merging

| Command | Description |
|---|---|
| `gent branch [name] [-d <name>] [-a]` | Branch management |
| `gent checkout <branch> [-b]` | Switch branches |
| `gent merge <branch> [-m <msg>]` | 3-way smart merge |
| `gent stash [pop\|list\|drop\|apply] [-m <msg>]` | Stash changes |

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
  │  ◄── { success, ref, hash }  ───────┤
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
  │  ◄── { commits, objects, head } ────┤
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
  │  ◄── { name, commits, objects,  ────┤
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

### Backend Database Schema (recommended)

```sql
-- Users (handled by auth framework)
CREATE TABLE users (
    id          UUID PRIMARY KEY,
    email       VARCHAR(255) UNIQUE NOT NULL,
    password    VARCHAR(255) NOT NULL,
    first_name  VARCHAR(100),
    last_name   VARCHAR(100),
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Repositories
CREATE TABLE repositories (
    id          UUID PRIMARY KEY,
    name        VARCHAR(255) NOT NULL,
    description TEXT,
    owner_id    UUID REFERENCES users(id),
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(owner_id, name)
);

-- Branch refs
CREATE TABLE branches (
    id          UUID PRIMARY KEY,
    repo_id     UUID REFERENCES repositories(id),
    name        VARCHAR(255) NOT NULL,
    head_hash   VARCHAR(64),
    UNIQUE(repo_id, name)
);

-- Commits
CREATE TABLE commits (
    id          UUID PRIMARY KEY,
    repo_id     UUID REFERENCES repositories(id) ON DELETE CASCADE,
    hash        VARCHAR(64) NOT NULL,
    message     TEXT NOT NULL,
    author_name VARCHAR(255),
    author_email VARCHAR(255),
    timestamp   TIMESTAMPTZ,
    parent_hash VARCHAR(64),
    merge_parent_hash VARCHAR(64),
    tree_hash   VARCHAR(64),
    tree_data   JSONB,
    stats       JSONB,
    UNIQUE(repo_id, hash)
);

-- Blob objects
CREATE TABLE objects (
    id          UUID PRIMARY KEY,
    repo_id     UUID REFERENCES repositories(id) ON DELETE CASCADE,
    hash        VARCHAR(64) NOT NULL,
    type        VARCHAR(10) DEFAULT 'blob',
    data        BYTEA NOT NULL,
    size        INTEGER,
    UNIQUE(repo_id, hash)
);

-- Tags
CREATE TABLE tags (
    id          UUID PRIMARY KEY,
    repo_id     UUID REFERENCES repositories(id) ON DELETE CASCADE,
    name        VARCHAR(255) NOT NULL,
    commit_hash VARCHAR(64) NOT NULL,
    message     TEXT,
    annotated   BOOLEAN DEFAULT FALSE,
    tagger_name VARCHAR(255),
    tagger_email VARCHAR(255),
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(repo_id, name)
);

-- Collaborators
CREATE TABLE collaborators (
    id          UUID PRIMARY KEY,
    repo_id     UUID REFERENCES repositories(id) ON DELETE CASCADE,
    user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
    role        VARCHAR(20) DEFAULT 'collaborator',
    UNIQUE(repo_id, user_id)
);
```

### Backend Implementation Notes

1. **Push endpoint** should:
   - Validate JSON payload size limits (recommend 50MB max)
   - Process commits in order (oldest first)
   - Use database transaction for atomicity
   - Return 409 if non-fast-forward and force=false
   
2. **Pull endpoint** should:
   - Walk commit parent chain server-side
   - Only return blobs referenced by new commits (delta transfer)
   - Support pagination for large histories
   
3. **Clone endpoint** should:
   - Stream large repositories (consider chunked transfer)
   - Compress response body (gzip content-encoding)
   - Include all branches, not just current

4. **Object deduplication** on backend:
   - Check hash existence before storing blob
   - Across repos: consider content-addressable global store
   - Use PostgreSQL `ON CONFLICT DO NOTHING` for atomic dedup
