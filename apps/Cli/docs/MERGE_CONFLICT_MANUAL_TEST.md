# Gent checkout, merge, remote, and website manual test report

## Result recorded on September 6, 2026

The repaired CLI passed the complete automated suite and a live deployed-server
test. The live test repository is:

```text
/api/repos/1/exam_merge_e2e_20260905222351
```

Verified live operations: repository creation, initialization, add, commit,
branch creation, checkout with file restoration, branch push, divergent clean
merge, two-parent merge history, non-empty merge diff, repeated ancestor merge
as a no-op, clone, pull, and server API branch/commit/diff reads.

The important rule is: `gent merge SOURCE` merges `SOURCE` into the branch that
is currently checked out. After merging while on `master`, push `master`; pushing
`main` does not publish the new `master` commit.

## Why the reported `merge-test2` result was empty

The shown history had `main` at `110ce36`, then `master` added commit `cb64da3`
on top of that same commit. Therefore `main` was already an ancestor of
`master`. `gent merge main` should have printed `Already up to date`, but the old
implementation created redundant commit `c32cb61` whose tree was identical to
its first parent. The website correctly calculated that redundant commit as
zero changed files. This regression is now covered by the test suite.

## Manual test A: reproduce the original checkout case

Use a disposable directory and the source under test so an older globally
installed CLI cannot affect the result:

```sh
GENT_CLI=/Users/abdo_ka/Documents/node_js_project/gent/apps/Cli/src/index.js
CHECKOUT_TEST_DIR="$(mktemp -d /tmp/gent-checkout-manual.XXXXXX)"
cd "$CHECKOUT_TEST_DIR"

gent() {
  node "$GENT_CLI" "$@"
}

gent init -y
printf '{"version":"base"}\n' > test.json
gent add test.json
gent commit -m "base"

gent checkout -b master
printf '{"version":"master"}\n' > test.json
gent add test.json
gent commit -m "second commit"

gent checkout main
cat test.json
gent checkout master
cat test.json
gent merge main
gent log --oneline
```

Required results:

- On `main`, `cat test.json` prints `{"version":"base"}`.
- On `master`, it prints `{"version":"master"}`.
- `gent merge main` prints `Already up to date`.
- The log still contains only two commits; no empty merge commit is created.

Also verify overwrite protection:

```sh
printf 'uncommitted work\n' > test.json
gent checkout main
printf 'exit: %s\n' "$?"
cat test.json
```

Required: checkout exits nonzero, reports that local changes would be
overwritten, remains on `master`, and preserves `uncommitted work` exactly.

Restore the test repository before continuing:

```sh
printf '{"version":"master"}\n' > test.json
```

## Manual test B: create a real merge with a visible website diff

This topology deliberately changes one file on `feature` and adds another on
`main`, so the branches diverge and the merge must be visible.

```sh
gent checkout main
gent checkout -b feature
printf '{"version":"feature"}\n' > test.json
gent add test.json
gent commit -m "feature changes test json"

gent checkout main
cat test.json
printf 'main branch only\n' > main.txt
gent add main.txt
gent commit -m "main adds separate file"

gent merge feature
cat test.json
cat main.txt
gent log --graph --oneline
```

Required results:

- Returning to `main` restores the base version of `test.json`.
- The merge succeeds without conflict.
- The merged tree contains the feature version of `test.json` and `main.txt`.
- The merge commit has two parents in the graph.
- Running `gent merge feature` again prints `Already up to date` and creates no
  extra commit.

## Manual test C: push and verify the website

Create a unique public test repository in the website first, then copy its
numeric clone URL. From the disposable local repository:

```sh
gent remote add origin /api/repos/OWNER_ID/REPOSITORY_NAME
gent push origin feature
gent push origin main
```

Open:

```text
https://gent-nu2e.onrender.com/dashboard/repository/OWNER_ID/REPOSITORY_NAME
```

Verify all of these in the website:

1. The header says `main` and shows the commit currently pointed to by `main`.
2. Branches shows both `main` and `feature`, with different tip hashes.
3. Commits contains `Merge branch 'feature' into main`.
4. Opening that merge commit shows `test.json` with `+1 -1`, not zero files.
5. Code on `main` contains `test.json` and `main.txt`.
6. Switching the code branch to `feature` hides `main.txt` and shows the feature
   version of `test.json`.

If you merge while checked out on `master`, publish it with:

```sh
gent push origin master
```

Do not expect `gent push origin main` to publish a commit created on `master`.

## Manual test D: clone and pull proof

```sh
REMOTE=/api/repos/OWNER_ID/REPOSITORY_NAME
CLONE_DIR="$(mktemp -d /tmp/gent-clone-manual.XXXXXX)"
gent clone "$REMOTE" "$CLONE_DIR"
cd "$CLONE_DIR"
cat test.json
cat main.txt
```

Back in the source repository, add and push one more commit:

```sh
printf 'remote pull proof\n' > pulled.txt
gent add pulled.txt
gent commit -m "pull verification"
gent push origin main
```

Then in the clone:

```sh
gent pull origin main
cat pulled.txt
gent status
```

Required: pull reports a fast-forward, `pulled.txt` contains `remote pull proof`,
and status is clean.

## Manual test E: same-file conflict and resolution

The following canonical interoperability procedure is the strictest conflict
test. It also lets Git independently validate Gent's objects and merge state.

## Purpose

This procedure verifies the complete local merge-conflict lifecycle in Gent's
canonical SHA-256 repository format:

1. Create a common base commit.
2. Edit the same file differently on `main` and `feature`.
3. Merge `feature` into `main` and confirm that Gent reports a conflict.
4. Confirm that both Gent and Git recognize the same unresolved state.
5. Abort the merge and confirm that the original `main` state is restored.
6. Repeat the merge, resolve the file, and finish with a two-parent commit.
7. Ask Git to validate the resulting object database and index.

This tests the local canonical engine. It does not create a GitHub/Gent pull or
merge request and does not test a remote server.

## Prerequisites

- Node.js 18 or newer.
- Project dependencies installed in `apps/Cli`.
- Git with SHA-256 repository support for the interoperability checks.
- A Bash or Zsh terminal.

Run these checks from the Gent repository:

```sh
cd /Users/abdo_ka/Documents/node_js_project/gent/apps/Cli
node --version
git --version
node src/index.js --version
```

The Node version must be at least 18. The Git version is recorded as part of
the evidence because older Git installations may not support SHA-256.

## 1. Create an isolated test repository

Use the CLI source being tested instead of a possibly stale global `gent`
installation:

```sh
GENT_CLI=/Users/abdo_ka/Documents/node_js_project/gent/apps/Cli/src/index.js
MERGE_TEST_DIR="$(mktemp -d /tmp/gent-merge-manual.XXXXXX)"
cd "$MERGE_TEST_DIR"

gent() {
  node "$GENT_CLI" "$@"
}

gent init --object-format=sha256 -y
gent config set user.name "Manual Merge Tester"
gent config set user.email "merge-test@example.com"
```

Expected initialization result:

```text
Initialized SHA-256 repository: .../.gent
```

Confirm that Gent created a canonical repository Git can discover:

```sh
git rev-parse --show-toplevel
git rev-parse --show-object-format
gent status
```

Expected:

- `git rev-parse --show-toplevel` prints the disposable test directory.
- `git rev-parse --show-object-format` prints `sha256`.
- `gent status` reports branch `main` and a clean working tree.

If Git rejects `--show-object-format` or the repository, record the Git version
and treat the interoperability part as unsupported rather than passed.

## 2. Create the common base

```sh
printf 'shared base\n' > shared.txt
gent add shared.txt
gent commit -m "base commit"
gent branch feature
gent branch
```

Expected:

- The commit succeeds on `main`.
- `gent branch` lists `main` as current and also lists `feature`.
- Both branches initially point to the same base commit.

Optional proof:

```sh
git rev-parse main
git rev-parse feature
```

The two hashes must be identical at this point.

## 3. Make the `main` edit

Remain on `main`, change the shared line, and commit it:

```sh
printf 'main version\n' > shared.txt
gent diff shared.txt
gent commit -am "main edit"
MAIN_TIP="$(git rev-parse HEAD)"
```

Expected:

- `gent diff` shows `shared base` replaced by `main version`.
- The commit succeeds.
- `MAIN_TIP` records the commit that must remain the first parent of the final
  merge commit.

## 4. Make a conflicting `feature` edit

```sh
gent checkout feature
printf 'feature version\n' > shared.txt
gent diff shared.txt
gent commit -am "feature edit"
FEATURE_TIP="$(git rev-parse HEAD)"
gent checkout main
```

Confirm the branch was restored to its own content:

```sh
cat shared.txt
```

Expected:

```text
main version
```

`MAIN_TIP` and `FEATURE_TIP` must now be different.

## 5. Trigger the merge conflict

Run the merge and immediately capture its exit status:

```sh
gent merge feature
MERGE_EXIT=$?
printf 'merge exit: %s\n' "$MERGE_EXIT"
```

Expected exit status: `1`.

Expected output includes:

```text
Auto-merging shared.txt
CONFLICT (content): Merge conflict in shared.txt
Automatic merge failed; fix conflicts and then commit the result.
```

Inspect the file:

```sh
cat shared.txt
```

Expected lines, in order: `<<<<<<< HEAD`, `main version`, `=======`,
`feature version`, and `>>>>>>> feature`.

## 6. Inspect the unresolved state

Check Gent's view:

```sh
gent status
gent resolve
```

Expected: both commands identify `shared.txt` as conflicted.

Check Git's view of the same Gent-written state:

```sh
git status --short
git ls-files --unmerged
```

Expected short status:

```text
UU shared.txt
```

`git ls-files --unmerged` must print three entries for `shared.txt`:

- Stage 1: merge base.
- Stage 2: `main`, or ours.
- Stage 3: `feature`, or theirs.

Inspect the three stored versions:

```sh
git show :1:shared.txt
git show :2:shared.txt
git show :3:shared.txt
```

Expected values, in order:

```text
shared base
main version
feature version
```

Confirm standard merge metadata:

```sh
cat .gent/MERGE_HEAD
cat .gent/MERGE_MSG
cat .gent/ORIG_HEAD
```

Expected:

- `MERGE_HEAD` equals `$FEATURE_TIP`.
- `ORIG_HEAD` equals `$MAIN_TIP`.
- `MERGE_MSG` starts with `Merge branch 'feature'` and lists `shared.txt`.

## 7. Confirm unresolved merges cannot continue

Before editing or staging the file, run:

```sh
gent merge --continue -m "must not succeed"
UNRESOLVED_EXIT=$?
printf 'unresolved continue exit: %s\n' "$UNRESOLVED_EXIT"
```

Expected:

- Exit status is `1`.
- The error identifies `shared.txt` as still conflicted.
- `git status --short` still reports `UU shared.txt`.
- `HEAD` still equals `$MAIN_TIP`.

## 8. Test merge abort

First make an additional edit after the conflict, then abort:

```sh
printf 'edited after conflict\n' > shared.txt
gent merge --abort
cat shared.txt
gent status
git status --short
git rev-parse HEAD
```

Expected:

- `shared.txt` is restored to `main version`.
- Gent reports a clean working tree.
- `git status --short` prints nothing.
- `HEAD` equals `$MAIN_TIP`.
- `.gent/MERGE_HEAD` and `.gent/MERGE_MSG` no longer exist.

Verify the metadata cleanup explicitly:

```sh
test ! -e .gent/MERGE_HEAD
test ! -e .gent/MERGE_MSG
```

Both commands must exit with status `0`.

## 9. Repeat and resolve the conflict

```sh
gent merge feature
printf 'resolved version\n' > shared.txt
gent add shared.txt
gent status
git status --short
```

Expected:

- The second merge again exits with status `1` and recreates the conflict.
- After `gent add`, Gent no longer reports `shared.txt` as conflicted.
- Git no longer reports `UU`; it reports a normal staged modification.
- `MERGE_HEAD` still exists until the merge commit is created.

Complete the merge:

```sh
gent merge --continue -m "resolve conflict"
```

`gent commit -m "resolve conflict"` is also supported after staging, but use
`gent merge --continue` in this procedure to test that command directly.

## 10. Validate the final merge commit

```sh
gent status
gent log --oneline
git status --short
git show -s --format='%H%nparents: %P%nsubject: %s' HEAD
git log --graph --oneline --decorate --all
git fsck --full --strict
```

Expected:

- Gent reports a clean working tree.
- `git status --short` prints nothing.
- The subject is `resolve conflict`.
- The `parents:` line contains exactly two hashes.
- The first parent equals `$MAIN_TIP`.
- The second parent equals `$FEATURE_TIP`.
- The graph shows `main` and `feature` converging at the merge commit.
- `git fsck --full --strict` completes without errors.
- Merge metadata files have been removed.

Machine-check the parent order:

```sh
set -- $(git show -s --format='%P' HEAD)
test "$#" -eq 2
test "$1" = "$MAIN_TIP"
test "$2" = "$FEATURE_TIP"
```

All three `test` commands must exit with status `0`.

## 11. Optional additional merge cases

The primary procedure proves the requested same-file conflict. Run these
additional cases in fresh disposable repositories if broader manual coverage
is required.

### Fast-forward merge

Create `feature`, commit only on `feature`, return to `main`, and merge it.
Expected: Gent prints `fast-forward`, both branch tips match, and no merge
commit is created.

### Already up to date

Immediately run `gent merge feature` again after the fast-forward.
Expected: Gent prints `up-to-date` and does not move `HEAD`.

### Clean divergent merge

After a common base, change `main.txt` on `main` and `feature.txt` on
`feature`, then merge. Expected: Gent prints `merged`, creates a two-parent
commit automatically, preserves both files, and leaves a clean tree.

### Dirty working tree rejection

Modify a tracked file without committing, then run `gent merge feature`.
Expected: exit status `1`, an instruction to commit or stash local changes,
and no changes to `HEAD`, the index, or working files.

### Merge a branch into itself

Run `gent merge main` while on `main`.
Expected: no history change. In the canonical engine this is reported as
`up-to-date`.

### Conflict resolved through ordinary commit

Recreate a conflict, edit the file, run `gent add shared.txt`, then run
`gent commit -m "resolve through commit"`. Expected: the commit has two
parents and the merge metadata is cleared.

## Pass/fail checklist

| Check | Required result |
| --- | --- |
| Canonical initialization | Git reports object format `sha256` |
| Divergent same-file edits | `main` and `feature` have different tips |
| Conflicting merge exit | Exit status `1` |
| Conflict markers | `HEAD` and `feature` labels are present |
| Gent unresolved status | `shared.txt` is reported as conflicted |
| Git unresolved status | `UU shared.txt` |
| Index stages | Stages 1, 2, and 3 exist |
| Merge metadata | `MERGE_HEAD`, `MERGE_MSG`, and `ORIG_HEAD` are correct |
| Premature continue | Refused without moving `HEAD` |
| Abort | Original `main` file and tip are restored |
| Resolution | `gent add` clears the unmerged stages |
| Continue | A merge commit is created |
| Parent topology | Parent 1 is `MAIN_TIP`; parent 2 is `FEATURE_TIP` |
| Final status | Gent clean; Git short status empty |
| Object validation | `git fsck --full --strict` reports no errors |

The test passes only when every required row passes. Preserve the command
output, Node/Git versions, test repository path, and final commit hash when the
run is being used as release evidence.

## 12. Optional cleanup

Only remove the directory if it still matches the disposable path created in
step 1:

```sh
cd /tmp
if [[ "$MERGE_TEST_DIR" == /tmp/gent-merge-manual.* ]]; then
  rm -rf -- "$MERGE_TEST_DIR"
fi
```

Keep the directory instead when its logs or object database are needed as test
evidence.
