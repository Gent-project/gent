# Gent with Git Graph 1.30.0

Gent integrates with the unmodified `mhutchie.git-graph` extension through the
`gent-git-graph` executable. The adapter presents the narrow Git command
contract used by Git Graph while Gent remains responsible for canonical
SHA-256 storage, mutations, authentication, and remote traffic.

This integration does not create a shadow Git repository or translate object
IDs. The `.git` file in the demonstrated working tree points at `.gent`, so the
CLI, adapter, Git Graph, server, and frontend all observe the same objects,
index, refs, and commit IDs.

## Pinned evidence

| Item | Pinned value |
|---|---|
| Extension | `mhutchie.git-graph` 1.30.0 |
| Release source commit | `881a9e613045bacbbadf8940f6b6c5b8bd699335` |
| Official installable VSIX SHA-256 | `b0779a30caf9866434900159c71322464e9fd267e3920d9732703819ff831f00` |
| Contract fixture | [`git-graph-1.30.0-contract.json`](../../tests/git-graph/fixtures/git-graph-1.30.0-contract.json) |
| Source files inspected | `src/dataSource.ts`, `src/repoManager.ts`, `src/config.ts`, `src/utils.ts`, `src/diffDocProvider.ts`, `src/repoFileWatcher.ts` |

The fixture records argv elements, not a shell command string. Options after a
remote, branch, ref, or selector are intentionally kept in the same position as
Git Graph 1.30.0. `<...>` denotes a single dynamic argv value, `[...]` an
optional value at that location, and `...` repetition as separate argv values.

## Setup on macOS

Install the pinned Git Graph extension and make sure a real Git executable is
available. From the canonical Gent repository, configure Gent with that
executable:

```bash
gent graph setup --git-path /usr/bin/git
gent graph doctor
```

Setup writes `.vscode/settings.json` with `git.path` pointing to the absolute
`gent-git-graph` executable. Reload the VS Code window before opening Git Graph.
When setup runs outside a canonical repository, it prints the setting for a
dedicated VS Code profile instead. The checked-in
[`demo-profile-settings.json`](demo-profile-settings.json) supplies the safe
Git Graph defaults; replace its adapter-path placeholder with the path printed
by setup. Do not point Gent's saved real-Git path back at the adapter.

The adapter accepts `--version` without a repository because Git Graph uses
that probe to validate `git.path`. `gent graph doctor` checks executable
resolution, Node availability outside an interactive shell, SHA-256 support,
repository classification, remote configuration, workspace `git.path`, and
saved login availability without printing credentials.

Only macOS is an acceptance target for v1. The implementation may be portable,
but Windows and Linux are not claimed until tested.

## Demo workflow

Use a fresh canonical clone with a normal working tree and a `.git` file that
points to `.gent`. Legacy Gent repositories, bare repositories, linked
worktrees, malformed metadata, and an ordinary Git SHA-256 repository are not
canonical Gent demo repositories.

1. Open the clone in the dedicated VS Code profile and run **Git Graph: View Git Graph**.
2. Confirm the graph shows 64-character commit IDs, merge parents, local and
   remote branches, tags, stashes, commit details, comparisons, and file
   contents.
3. Make a Gent CLI change, then refresh Git Graph and confirm the exact new
   commit ID and ref are visible.
4. Exercise supported actions from Git Graph: create/check out/rename/delete a
   branch; merge; tag; reset; stash; fetch; push; pull; edit remotes; and edit
   local identity.
5. For a merge conflict, resolve it through the Gent CLI, complete or abort the
   merge there, and refresh Git Graph.
6. Confirm an ordinary Git repository still passes through to the configured
   real Git executable.

For the remote acceptance path, use two fresh clones of the same canonical
remote. Push a commit from clone A through Git Graph and verify its 64-character
ID and files in the Gent frontend. Commit and push a different change from
clone B with Gent, then fetch and pull it into clone A through Git Graph. Create
divergence, produce a merge conflict, resolve it through Gent, refresh the
graph, and verify the completed merge has the two expected parents. Restart VS
Code and repeat discovery plus an authenticated fetch to prove saved-login
reuse.

Git Graph 1.30.0 watches `.git/**`, selected `.git` files, and working-tree
files. It does not watch `.gent/**`. Automatic refresh for a `.git` pointer to
`.gent` remains an observation gate; explicit **Git Graph: Refresh** is the v1
fallback for Gent-only metadata changes. Do not claim automatic refresh until
the packaged macOS demo proves it.

## Capability table

| Area | Git Graph 1.30.0 through Gent | Boundary |
|---|---|---|
| Discovery and reads | Supported | Exact fixture patterns only; reads use the real Git executable with optional locks and external diff/text conversion disabled. |
| Branches | Create at HEAD/selected commit, checkout local/commit/remote branch, rename, safe/forced delete | Cannot delete the checked-out branch. Branch force-creation/replacement is rejected. |
| Merge | Ordinary merge and `--no-ff` | Squash and `--no-commit` are rejected. Resolve/abort conflicts with Gent CLI. |
| Tags | Lightweight/annotated create, local/remote delete, push | Force replacement and signing are rejected. |
| Reset | Soft, mixed, hard to a commit | File-level reset is rejected. |
| Stash | Push with optional message/untracked files; apply/pop/drop selector; optional `--index` | Stash branch and ignored/all-files mode are rejected. |
| Fetch | Named remote or `--all`; optional branch pruning | Tag pruning and fetching directly into a local branch are rejected. |
| Push | Named branch/tag and `--set-upstream` | Force, force-with-lease, and custom refspecs are rejected. |
| Pull | Named remote branch, ordinary or `--no-ff` | Squash is rejected. |
| Remotes | List/read, add, set fetch URL, remove | Rename, multiple URLs, separate push URLs, and custom refspecs are rejected. |
| Identity | Read config; set/unset local `user.name` and `user.email` | Arbitrary and global config mutations are rejected. |
| History editing | Not supported | Rebase, cherry-pick, revert, drop commit, and Git Graph commit creation are rejected. |
| Other Git actions | Not supported | Clean, archive, external diff tools, arbitrary commands, and file-level checkout are rejected. |
| VS Code built-in Git staging/commit | Not supported | Use Gent CLI so mutations stay inside Gent's operation boundary. |

Unsupported context-menu actions should be hidden with Git Graph's
`git-graph.contextMenuActionsVisibility` settings. Options that cannot be hidden
must fail with an actionable adapter error; no option is silently ignored.

## Acceptance status

The checked-in fixture is the implementation contract extracted from the
pinned source. Passing fixture and adapter tests proves argv dispatch, but does
not prove the extension UI, Finder-launched Node resolution, filesystem refresh,
credentials, or live remote behavior. Record those separately during the
packaged macOS demo. At minimum, retain the Git version, VS Code version, macOS
version, extension VSIX checksum, clone path, selected actions, observed refresh
behavior, and the 64-character commit IDs used in screenshots/logs.

### Current macOS evidence (2026-09-07)

- macOS 26.5.2 (25F84), Apple Git 2.50.1 (Apple Git-155), Node 22.16.0,
  Visual Studio Code 1.127.0 arm64, and Git Graph 1.30.0 were used.
- The installable Marketplace VSIX matched the checksum above and installed in
  an isolated user-data/extensions directory.
- A fresh canonical repository passed `git fsck --full --strict`; its initial
  64-character commit was
  `b7671569ce79096eed181d9c81bf9e89090bfbb13092eef0cb3c7ebb12a92147`.
- Git Graph started with `gent-git-graph`, reported the real Git version, ran
  `rev-parse --show-toplevel`, and added the canonical repository. A second
  launch through macOS `open` used the generated `~/.gent/bin/gent-git-graph`
  launcher, whose absolute Node shebang also passed a minimal Finder-like
  `PATH=/usr/bin:/bin` version probe.
- Graph rendering, automatic refresh, context-menu mutations, restart, and the
  live two-clone server/frontend workflow remain unverified. The isolated VS
  Code process could not be targeted by the available UI automation while the
  user's existing VS Code process was active; startup/discovery logs are not a
  substitute for the remaining visual and end-to-end gates.
