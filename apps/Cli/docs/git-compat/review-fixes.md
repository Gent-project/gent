# Local engine review fixes

This is an opt-in local-engine preview inside v12, not a v13 release or a
claim that all Phase 0–5 acceptance gates are complete. Migration and canonical
remote transport remain unimplemented. Existing v12 repositories retain their
legacy handlers and storage.

## Entry point and behavior changes

Create a separate new repository with:

```sh
gent init --object-format=sha256 -y
gent config set user.name "Your Name"
gent config set user.email you@example.com
```

Normal local commands then use Gent's canonical engine. Existing canonical
repositories, including conventional `.git` directories, are detected directly.
No canonical operation falls back to a legacy JSON writer. Reinitialization
refuses to reinterpret legacy or unsupported metadata.

Connected commands: add, rm, status, commit, branch, checkout, reset, diff,
log, show, tag, merge, resolve guidance, stash, summary, undo and redo.
Canonical config writes currently support user.name and user.email.

Behavior changes apply to canonical repositories only:

- Non-forced branch checkout refuses staged changes, conservatively even when
  Git might carry them across. Forced checkout and hard reset restore bytes
  even when the index already matches the target.
- Stash apply merges against the stash's original HEAD, preserving later
  committed files. Default apply leaves the index alone; `--restore-index`
  restores staged changes. Conflicting applications refuse before mutation
  and retain the stash. Applying over local changes is also refused.
- Undo/redo checkpoints commit, checkout, reset and merge operations. They
  restore the recorded index, refs and working files, including staged versus
  unstaged differences. Intervening changes cause refusal. Private
  `refs/gent/journal/...` roots retain objects across Git pruning; these refs
  may appear in external tools showing all refs. There is no automatic journal
  pruning in this preview.
- Interrupted worktree updates keep a recovery record through index and HEAD
  publication. `gent checkout --abort` restores recorded files/index only if
  their contents and HEAD still match recognized states. It refuses newer
  changes instead of overwriting them. There is no `--continue` command.
- Worktree replacement of directories/submodules refuses. Recovery is not a
  filesystem-wide atomic transaction and does not promise recovery after
  arbitrary manual metadata changes.

Canonical push/pull/remote and legacy-only AI adapters refuse explicitly.
Graph/stat formatting for canonical log remains unsupported. No smart HTTP
service, migration command, or universal tool-support claim is shipped here.
These remaining items must be tracked before calling Phase 5 complete or
releasing v13.

## Corrections to the implementation

- Index publication compares the originally read bytes under `index.lock` and
  rejects stale writers. New intended index bytes are added to any checkout
  recovery record before publication.
- Worktree plans preflight paths, object reads and content conversion before
  deletions; snapshot exact bytes for rollback; retain recovery metadata until
  their caller completes index/ref updates.
- HEAD writes now use `HEAD.lock`; checkout checks the original HEAD before
  replacing it.
- Stash apply uses three-way content merging, separates index restoration, and
  preflights untracked restoration with the rest of the operation.
- Ordinary commit recognizes merge parents from MERGE_HEAD.
- Init canonicalizes the repository root and checks existing metadata before
  creating or replacing format files.
- The feature manifest marks smart HTTP unsupported; no nonexistent server
  integration is claimed.

## Executable checks

Run in `apps/Cli`:

```sh
npm test
npm run test:independence
npm run test:interop
```

`npm test` retains the original 65 unit tests and four offline scenarios, and
adds the canonical engine/CLI regression suite. The independence runner uses
an empty PATH, proves Git cannot be found, audits the canonical engine modules
for subprocess delegation, and runs the actual engine/CLI regressions with
Node addressed by its absolute executable path.

The interoperability suite uses a real SHA-256-capable Git only as a test
oracle. It tests binary object identity, divergent merge topology, annotated
tags, packed objects/refs, index v4, stashes in both directions, and journal
retention through pruning. It records a skip if Git/SHA-256 is unavailable;
a skipped run is not interoperability evidence. It does not certify every
index extension, platform, pack variant or third-party GUI.
