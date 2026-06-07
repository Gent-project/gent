# Gent CLI — Command Reference

> Complete reference for every `gent` command, including the smart features that
> go beyond plain git. Version 7.0.0.

Commands are grouped by purpose. Flags shown in `[brackets]` are optional.

---

## Table of Contents

1. [Repository setup](#repository-setup)
2. [Staging & working tree](#staging--working-tree)
3. [History & inspection](#history--inspection)
4. [Branching & merging](#branching--merging)
5. [Safety net: undo / redo](#safety-net-undo--redo)
6. [Insight: summary](#insight-summary)
7. [Remote & sync](#remote--sync)
8. [Authentication](#authentication)
9. [Optional AI features](#optional-ai-features)

---

## Repository setup

| Command | Description |
|---|---|
| `gent init [-y] [--remote [name]]` | Initialize a `.gent/` repository. `-y` skips prompts; `--remote` also creates the repo on the backend. |
| `gent clone <url> [dir]` | Download a full repository from the backend. |

---

## Staging & working tree

| Command | Description |
|---|---|
| `gent status [-s]` | Show staged / modified / untracked / deleted files. `-s` = short format. |
| `gent add <files...> [-A]` | Snapshot files into the object store and stage them. `-A` / `.` stages everything. |
| `gent rm <files...> [--cached]` | Stop tracking files. `--cached` keeps the file on disk. |
| `gent reset [files...]` | Unstage files. |
| `gent reset --soft <hash>` | Move the branch pointer, keep staging & working tree. **Undoable.** |
| `gent reset --hard <hash>` | Move the branch pointer and restore the working tree. **Undoable** (working files are restored on undo). |
| `gent diff [files...] [--staged] [--stat]` | Line-level unified diff. `--staged` vs HEAD; `--stat` = summary only. |

---

## History & inspection

| Command | Description |
|---|---|
| `gent commit [-m <msg>] [-a] [--ai]` | Record staged changes. `--ai` suggests a message (see [AI features](#optional-ai-features)). **Undoable.** |
| `gent log [-n <N>] [--oneline] [--graph] [--stat]` | Show history. `--graph` draws an ASCII commit graph with branches and merges. |
| `gent show [ref] [--no-patch]` | Show a commit's details and diff. |
| `gent tag [name] [-m <msg>] [-d <name>]` | Create (lightweight or `-m` annotated), list, or delete (`-d`) tags. |
| `gent explain [ref] [--staged]` | Plain-language summary of a commit or staged changes. Uses AI when enabled; otherwise prints the diff. |

### `gent log --graph`

Draws a newest-first graph of all commits reachable from `HEAD` via both the
`parent` and `mergeParent` edges, with `(HEAD)` and branch labels and a
`|\ merge: …` annotation on merge commits:

```
* d4c5f47 (HEAD) (main) Merge branch 'feature' into main (2 minutes ago)
|\  merge: aaf7f1b + 8b21047
|
* aaf7f1b main: edit gamma (3 minutes ago)
|
* 8b21047 (feature) feature: insert line (3 minutes ago)
|
* 642e59e first commit (4 minutes ago)
```

---

## Branching & merging

| Command | Description |
|---|---|
| `gent branch [name] [-d <name>] [-a]` | List, create, or delete (`-d`) branches. **Delete is undoable.** |
| `gent checkout <branch> [-b]` | Switch branches; `-b` creates first. **Undoable.** |
| `gent merge <branch> [-m <msg>]` | 3-way smart merge into the current branch. Auto-commits when clean; on conflict it writes markers and records merge state for `gent resolve`. **Undoable.** |
| `gent resolve` | Interactively resolve the conflicts left by `gent merge`. |
| `gent stash [pop\|list\|drop\|apply] [-m <msg>]` | Stash working-tree changes. |

### `gent resolve`

After a conflicting merge, walk each conflict hunk and choose how to resolve it:

```
$ gent resolve

Resolving merge of 'feature' — 1 file(s)

f.txt
  Conflict 1/1:
    <<< ours
      BETA-MAIN
    >>> theirs
      BETA-FEATURE
? Resolve conflict 1 (Use arrow keys)
❯ Keep ours
  Keep theirs
  Keep both (ours then theirs)
  Ask AI (claude-opus-4-8)      ← shown only when ANTHROPIC_API_KEY is set
  Edit manually
  Skip the rest of this file
```

When every conflict is resolved it offers to create the merge commit
(`parent` = current branch, `mergeParent` = merged branch) automatically.

---

## Safety net: undo / redo

A friendlier alternative to `git reflog`. Every history-changing operation
(commit, merge, reset, checkout, branch delete) is journaled in
`.gent/journal.json`.

| Command | Description |
|---|---|
| `gent undo` | Reverse the last history-changing operation. |
| `gent undo --list` | Show the operation history, most recent first. |
| `gent redo` | Re-apply the last undone operation. |

**Undo is non-destructive:** branch pointers are restored, and your working
files are **never deleted**. For operations that discard content (`reset --hard`,
fast-forward `merge`, `pull`) undo also restores those files from the object
store. A new history-changing operation clears the redo stack.

```
$ gent undo --list

Operation history (most recent first):

● merge          merge 'feature' into main (1 minute ago)
○ commit         main: edit gamma [main] (1 minute ago)
○ checkout       switch to branch 'main' (1 minute ago)
○ commit         first commit [main] (2 minutes ago)

"gent undo" reverses the most recent (●).
```

---

## Insight: summary

| Command | Description |
|---|---|
| `gent summary [--ai]` | Repository health dashboard. `--ai` adds a short written assessment. |

Reports: branch & commit counts, tags, tracked files and approximate lines of
code, object-store size, top contributors, most-changed files, how far ahead of
the remote you are, and last activity.

---

## Remote & sync

| Command | Description |
|---|---|
| `gent remote [add\|remove\|set-url] [-v]` | Manage remotes. `-v` shows URLs. |
| `gent repos [--create <name>] [--description <text>] [--private]` | List or create backend repositories. |
| `gent push [remote] [branch] [-f]` | Upload commits and objects. `-f` force-pushes. |
| `gent pull [remote] [branch]` | Download and merge remote commits. **Undoable.** |

Remote paths are stored as `/api/repos/<owner_id>/<repo_name>` and combined with
the fixed API base `https://gent-api.onrender.com`.

---

## Authentication

| Command | Description |
|---|---|
| `gent register [-e <email>] [-p <pass>] [--password-confirm <pass>] [--first-name <n>] [--last-name <n>]` | Create an account. |
| `gent login [-e <email>] [-p <pass>]` | Log in (JWT). |
| `gent logout` | Clear stored tokens. |
| `gent whoami` | Show the current user. |

Tokens are stored encrypted in `~/.gent/auth.json`.

---

## Optional AI features

AI features are **off by default** and fully optional — every one has a reliable
non-AI path. Enable them by setting an API key:

```bash
export ANTHROPIC_API_KEY=sk-ant-...
# optional: pick a cheaper/faster model (default: claude-opus-4-8)
export GENT_AI_MODEL=claude-haiku-4-5
```

| Where | What it does without a key | What `--ai` / AI adds |
|---|---|---|
| `gent commit --ai` | Prompts for a message | Suggests a message from the staged diff (editable) |
| `gent explain` | Prints the diff + a hint | Writes a plain-language summary |
| `gent resolve` | Ours/theirs/both/edit | Adds an "Ask AI" option that proposes a merged hunk |
| `gent summary --ai` | Prints the dashboard | Adds a short health narrative |

If a key is absent or a request fails, the command falls back to its algorithmic
behaviour and never errors out.
