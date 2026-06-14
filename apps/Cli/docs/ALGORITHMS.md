# Gent CLI — Algorithms Deep Dive

> The data-structures and algorithms behind Gent's "smart" version control.
> Pairs with [ARCHITECTURE.md](ARCHITECTURE.md). Version 7.0.0.

Every algorithm here is implemented in `src/utils/` and covered by tests in
`tests/` (`node --test`).

---

## 1. Content-addressable storage (SHA-256)

**Location:** [`src/utils/hash-engine.js`](../src/utils/hash-engine.js)
**Tests:** `tests/hash.test.js`

Files (blobs) and directory snapshots (trees) are stored by the SHA-256 hash of
their content:

```
key   = SHA-256( "<type> <byteLength>\0" + content )      type ∈ {blob, tree}
path  = .gent/objects/<key[0:2]>/<key[2:]>
bytes = zlib.deflate( "<type> <byteLength>\0" + content )
```

- **Deduplication** is automatic: identical content → identical key → the write
  is skipped if the object already exists. Renaming a file costs zero storage.
- **Integrity**: re-hashing a decompressed object detects tampering or corruption.
- **Trees** are serialized as a JSON array of entries **sorted by name**, so the
  same directory state always hashes identically (`tests/hash.test.js` asserts
  order-independence).
- **SHA-256 over SHA-1** (git's original): SHA-1 has practical collision attacks
  (SHAttered, 2017); SHA-256 gives 128-bit collision resistance at the same speed
  in Node's `crypto`.

A separate fast, non-cryptographic **FNV-1a 32-bit** hash (`fnv1a32`) is used
only for quick line fingerprinting — never for storage or security.

---

## 2. Diff — Longest Common Subsequence with prefix/suffix trimming

**Location:** [`src/utils/diff-engine.js`](../src/utils/diff-engine.js)
**Tests:** `tests/diff.test.js`

### 2.1 Core LCS

Given `old[0..M)` and `new[0..N)`, build a DP table where
`dp[i][j]` = length of the LCS of the first `i` old lines and first `j` new lines:

```
dp[i][j] = dp[i-1][j-1] + 1                  if old[i-1] == new[j-1]
         = max(dp[i-1][j], dp[i][j-1])       otherwise
```

Backtracking from `dp[M][N]` yields a sequence of `equal` / `insert` / `delete`
operations. Time and space are `O(M·N)`; the matrix uses `Uint32Array` rows for
compactness.

### 2.2 Prefix/suffix trimming (the optimization)

Real edits are usually local: a few changed lines in an otherwise identical
file. `buildLineOperations` first strips the common leading and trailing lines,
runs LCS only on the differing **middle**, then re-attaches the trimmed lines as
`equal` operations with their original 1-based positions:

```
old = [P… , a, b ,  …S]
new = [P… , a, x, y , …S]
            └ run LCS only here ┘
```

This turns an `O(M·N)` matrix into one proportional to the size of the change —
a large memory and time win — while producing byte-identical output. The test
`prefix/suffix trimming is equivalent to untrimmed LCS` asserts the edit
distance and reconstruction are identical to running LCS on the full arrays.

### 2.3 Hunks & unified diff

Adjacent changes within `2·context + 1` lines (default `context = 3`) are grouped
into hunks and rendered in unified-diff format
(`@@ -oldStart,oldCount +newStart,newCount @@`), matching `git diff`.

---

## 3. Three-way merge — diff3

**Location:** [`src/utils/merge-engine.js`](../src/utils/merge-engine.js)
**Tests:** `tests/merge.test.js`

Inputs: `BASE` (common ancestor), `OURS` (current branch), `THEIRS` (incoming).

### 3.1 The algorithm

1. Diff `BASE→OURS` and `BASE→THEIRS` (§2). A base line is a **stable anchor**
   when it survives unchanged in **both** sides — at an anchor all three files
   are synchronized. Because LCS matches are individually monotonic, the shared
   set of anchors is simultaneously monotonic in base/ours/theirs indices.
2. Walk anchors in order. Between two consecutive anchors lies one **unstable
   region** — `baseSeg`, `oursSeg`, `theirsSeg` (each possibly empty).
3. Classify each region, then emit the anchor line.

| Region situation | Result |
|---|---|
| Neither side changed it | keep base |
| Only OURS changed | take OURS |
| Only THEIRS changed | take THEIRS |
| Both changed identically | take either |
| Both changed, same length, disjoint lines | line-by-line sub-merge |
| Whitespace-only difference | take OURS |
| Both added import/require lines (empty base) | union them (§3.3) |
| Otherwise (true overlap) | conflict markers |

### 3.2 Why diff3 (and what it fixed)

The previous implementation walked base indices and applied per-side "change
regions." It had two defects, both now covered by regression tests:

- **One-sided pure insertion → infinite loop.** A region that consumed *zero*
  base lines never advanced the cursor, so the merged array grew without bound
  until Node threw `RangeError: Invalid array length`. This crashed the headline
  feature on a very common case (one branch inserts a line, the other edits
  elsewhere). The diff3 region model handles empty `baseSeg` naturally.
- **Overlapping edits silently dropped.** When ours and theirs regions started
  at different base offsets, one side's change could be skipped. Anchoring whole
  regions between synchronized lines removes the gap.

### 3.3 Language-aware resolution

`mergeFileContent(base, ours, theirs, fileName)` dispatches on the file before
falling back to the line merge — and **always** falls back to conflict markers
when it cannot resolve safely:

- **JSON** (`*.json`): parse all three sides and 3-way merge key-by-key
  (recursing into nested objects). Disjoint key changes auto-resolve (e.g. two
  branches adding different `package.json` dependencies). If any key conflicts,
  or the roots aren't objects, it returns `null` and the line merge runs so a
  human sees markers.
- **Import/require union**: when both sides only *add* distinct import-style
  lines at the same spot (empty base segment), union them instead of
  conflicting — the classic "both branches added an import" false conflict.

### 3.4 Tree-level merge

`mergeTreeEntries` compares blob hashes across the three trees per file and
decides add / delete / modify / conflict independently. Only files that differ
on **both** sides trigger a content merge (§3.1–3.3). Modify/delete conflicts
keep the modified version as a smart default and report the conflict.

### 3.5 Merge base (DAG-aware)

`findMergeBase` finds the lowest common ancestor by traversing **both** the
`parent` and `mergeParent` edges (so it stays correct once merge commits exist).
It collects all ancestors of one tip, then does a nearest-first BFS from the
other and returns the first shared commit. `tests/merge-base.test.js` covers
linear, branched, and merge-commit (DAG) histories.

---

## 4. Operation journal (undo / redo)

**Location:** [`src/utils/journal.js`](../src/utils/journal.js)
**Driven by:** commit, merge, reset, checkout, branch-delete commands.

Before a command mutates `commits.json`, `recordOp` snapshots the parts that
change — the `branches` map and `currentBranch` — plus a label, description, and
timestamp, into `.gent/journal.json` (`{ entries, redo }`, capped at 100).

- **Undo** pops the last entry, pushes the current state onto the redo stack, and
  restores the snapshot. Working files are never deleted; entries flagged
  `restoreTree` (hard reset, fast-forward merge, pull) also rewrite their files
  from the object store.
- **Redo** is the mirror operation.
- Any new history-changing operation clears the redo stack.

This generic "snapshot the refs" model means one mechanism reverses every
history-changing command, instead of bespoke inverse logic per command.

---

## 5. Optional AI layer

**Location:** [`src/utils/ai-service.js`](../src/utils/ai-service.js)

A thin, key-gated client over the Anthropic Messages API (called via the
existing `axios` dependency). It powers optional enhancements only — commit
message suggestions, diff explanations, and conflict-resolution suggestions —
and degrades gracefully to the algorithmic path when `ANTHROPIC_API_KEY` is
unset or a request fails. Model defaults to `claude-opus-4-8`, overridable with
`GENT_AI_MODEL`. See [COMMANDS.md](COMMANDS.md#optional-ai-features).

---

## Complexity summary

| Operation | Time | Space |
|---|---|---|
| Blob/tree hash + store | `O(n)` in content size | `O(n)` |
| LCS diff (after trimming) | `O(m·n)` over the *changed* region | `O(m·n)` |
| Three-way merge | `O(diff(base,ours) + diff(base,theirs))` | linear in file size |
| Merge base | `O(V + E)` over the commit DAG | `O(V)` |
| Undo / redo | `O(tree size)` to restore files | `O(branches)` |
