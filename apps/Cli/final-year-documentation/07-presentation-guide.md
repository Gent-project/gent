# 07 — Presentation Guide

## One-Minute Project Explanation

Gent CLI is a Git-like version control system built with Node.js. It allows users to initialize repositories, stage files, create commits, inspect changes, manage branches, merge branches, undo mistakes, and synchronize with a remote backend. The project demonstrates key software engineering concepts such as content-addressable storage, SHA-256 hashing, LCS diff, diff3 merge, DAG traversal, JWT authentication, REST API integration, and modular command-line design.

## Recommended Presentation Structure

| Slide | Topic | What to Explain |
|---|---|---|
| 1 | Title | Project name, student name, goal. |
| 2 | Problem | Developers need version tracking, collaboration, and safe recovery. |
| 3 | Proposed Solution | Gent CLI as a simplified Git-like system. |
| 4 | Features | Init, add, commit, diff, branch, merge, push, pull, auth, AI. |
| 5 | Architecture | Command layer, engine layer, storage layer, API layer. |
| 6 | Local Storage | `.gent/`, objects, commits, staging, config, journal. |
| 7 | Hash Algorithm | SHA-256 content addressing and deduplication. |
| 8 | Diff Algorithm | LCS and unified diff output. |
| 9 | Merge Algorithm | Three-way diff3 merge and conflict markers. |
| 10 | Remote Sync | Push/pull pack flow with backend API. |
| 11 | Authentication | Register/login, JWT access token, refresh token. |
| 12 | Testing | Unit tests and offline end-to-end tests. |
| 13 | Limitations | Honest technical limitations and future work. |
| 14 | Demo | Run core commands live. |
| 15 | Conclusion | What was learned and why the design is valuable. |

## Demo Plan

Use a clean temporary folder.

```bash
mkdir gent-demo
cd gent-demo
gent init -y
echo "Hello Gent" > app.txt
gent status
gent add app.txt
gent diff --staged
gent commit -m "Initial commit"
gent log
```

Then show branching:

```bash
gent branch feature
gent checkout feature
echo "Feature work" >> app.txt
gent add app.txt
gent commit -m "Add feature work"
gent checkout main
echo "Main work" >> app.txt
gent add app.txt
gent commit -m "Add main work"
gent merge feature
gent log --graph
```

Then show recovery:

```bash
gent undo
gent redo
```

If remote/backend access is ready:

```bash
gent login
gent repos --create gent-demo --description "Demo repository"
gent remote add origin /api/repos/<owner_id>/gent-demo
gent push
```

## Important Points to Say Clearly

### About `.gent/`

`.gent/` is the local database of the version control system. It stores commit history, branch pointers, staged changes, compressed file objects, and undo/redo history.

### About Hashing

Gent stores files by content hash. If file content is identical, it produces the same SHA-256 hash and does not need to be stored again.

### About Diff

Gent uses the Longest Common Subsequence algorithm to identify which lines are unchanged, inserted, or deleted. It then formats this as a unified diff.

### About Merge

Gent uses a three-way merge because it compares two changed versions against a common ancestor. This is more accurate than comparing only the two final versions.

### About AI

AI is optional. The core system works without AI. AI is used only for productivity features such as explanations, reviews, generated docs, and commit message suggestions.

## Expected Questions and Good Answers

### Q1: Is this just a wrapper around Git?

No. The project implements its own local repository format, object store, diff algorithm, merge algorithm, journal, and push/pull pack logic. It is Git-like, but it does not call Git for its core version-control behavior.

### Q2: Why use SHA-256?

SHA-256 gives deterministic content identity and strong collision resistance. It also enables deduplication because identical content always maps to the same hash.

### Q3: Why use LCS for diff?

LCS is a standard algorithm for finding the longest sequence of unchanged lines between two files. From that sequence, we can derive inserted and deleted lines.

### Q4: What is the complexity of the diff algorithm?

The core LCS algorithm is `O(m*n)` time and space, where `m` and `n` are the line counts of the compared regions. Gent optimizes this by trimming common prefixes and suffixes before building the matrix.

### Q5: Why is three-way merge better than two-way merge?

Three-way merge uses the common ancestor. This lets the system know which side changed a region. If only one side changed, it can safely take that side. A two-way merge cannot know that context.

### Q6: How does Gent handle conflicts?

If both branches changed the same region differently and Gent cannot safely auto-resolve, it writes conflict markers:

```text
<<<<<<< ours
...
=======
...
>>>>>>> theirs
```

The user can then run `gent resolve`.

### Q7: How does undo work?

Before a history-changing command mutates branch pointers, Gent records the previous branch map and current branch in `.gent/journal.json`. `gent undo` restores that previous state.

### Q8: What happens if the access token expires?

The API client catches HTTP 401 responses, uses the refresh token to request new tokens, saves the rotated tokens, and retries the original request.

### Q9: What are the main limitations?

The diff algorithm can be expensive for very large changed regions, local secret storage should use an OS keychain in production, and the merge engine is mostly text-based except for JSON/import handling.

### Q10: What would you improve next?

I would implement Myers diff, deterministic commit hashes based on full commit content, OS keychain secret storage, rename detection, and more language-aware merge strategies.

## Key Technical Terms to Know

| Term | Meaning |
|---|---|
| Blob | Stored file content object. |
| Tree | Snapshot mapping file paths to blob hashes. |
| Commit | Version record containing metadata, parent, tree hash, and stats. |
| Branch | Name pointing to a commit hash. |
| Merge base | Common ancestor commit used for three-way merge. |
| Content-addressable storage | Storage where content hash is the object address. |
| LCS | Longest Common Subsequence, used for diff. |
| diff3 | Three-way merge algorithm using base, ours, and theirs. |
| JWT | Token format used for authenticated API requests. |
| Pack | Push payload containing commits, trees, and blobs. |

## Final Closing Statement

Gent CLI demonstrates that version control can be built from clear algorithms and data structures: hashes identify content, commits form a graph, diffs compare line sequences, merges use a common ancestor, and remote sync transfers missing objects. The project is modular, testable, and suitable for explaining both practical software engineering and algorithmic design.

