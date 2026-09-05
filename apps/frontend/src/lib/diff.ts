/**
 * Client-side git diff engine.
 *
 * The Gent API exposes trees and blobs but *no* diff endpoint, so the web app
 * computes "what changed in a commit" itself by comparing the commit's tree
 * against its parent's tree:
 *
 *   1. `diffTrees` walks both trees in lock-step, descending only into subtrees
 *      whose sha differs (identical subtrees are pruned — exactly how git skips
 *      unchanged directories), and emits one {added|removed|modified} record per
 *      changed file.
 *   2. For each changed *text* file we fetch the old/new blob and run `diffText`,
 *      an LCS line diff that produces unified-style hunks with line numbers.
 *
 * Everything here is pure (no network) except via the injected `getTree`
 * accessor, which keeps it easy to cache and test.
 */
import type { Blob, Commit, Tree, TreeEntry } from "@/types/api";

const ZERO_SHA = "0".repeat(64);

/** True for the placeholder sha git/Gent give empty trees & branches. */
export function isEmptyTreeSha(sha: string | null | undefined): boolean {
  return !sha || sha === ZERO_SHA || /^0+$/.test(sha);
}

/* ------------------------------------------------------------------ */
/* Tree-level diff                                                     */
/* ------------------------------------------------------------------ */

export type ChangeStatus = "added" | "removed" | "modified";

export interface RawFileChange {
  path: string;
  status: ChangeStatus;
  oldSha?: string;
  newSha?: string;
}

/** Async tree accessor — typically wraps `gitService.tree` with a cache. */
export type GetTree = (sha: string) => Promise<Tree>;

/** Recursively collect every blob beneath a tree as `path → sha`. */
async function collectBlobs(
  getTree: GetTree,
  sha: string,
  prefix: string,
  out: { path: string; sha: string }[],
): Promise<void> {
  if (isEmptyTreeSha(sha)) return;
  const tree = await getTree(sha);
  for (const e of tree.entries) {
    const p = prefix ? `${prefix}/${e.name}` : e.name;
    if (e.type === "tree") await collectBlobs(getTree, e.sha, p, out);
    else out.push({ path: p, sha: e.sha });
  }
}

/** Emit every blob under one side of a changed entry as added/removed. */
function sideChange(
  path: string,
  status: "added" | "removed",
  sha: string,
): RawFileChange {
  return status === "added"
    ? { path, status, newSha: sha }
    : { path, status, oldSha: sha };
}

async function emitSide(
  getTree: GetTree,
  entry: TreeEntry,
  path: string,
  status: "added" | "removed",
  changes: RawFileChange[],
): Promise<void> {
  if (entry.type === "blob") {
    changes.push(sideChange(path, status, entry.sha));
    return;
  }
  const blobs: { path: string; sha: string }[] = [];
  await collectBlobs(getTree, entry.sha, path, blobs);
  for (const b of blobs) changes.push(sideChange(b.path, status, b.sha));
}

/**
 * Diff two trees into a flat list of file changes. `null` on either side means
 * "this side has no tree" (e.g. the very first commit has no parent), in which
 * case every file on the present side is added/removed.
 */
export async function diffTrees(
  getTree: GetTree,
  oldSha: string | null,
  newSha: string | null,
  prefix = "",
): Promise<RawFileChange[]> {
  if (oldSha && newSha && oldSha === newSha) return [];

  const oldEntries =
    oldSha && !isEmptyTreeSha(oldSha) ? (await getTree(oldSha)).entries : [];
  const newEntries =
    newSha && !isEmptyTreeSha(newSha) ? (await getTree(newSha)).entries : [];

  const oldByName = new Map(oldEntries.map((e) => [e.name, e]));
  const newByName = new Map(newEntries.map((e) => [e.name, e]));
  const names = new Set([...oldByName.keys(), ...newByName.keys()]);

  const changes: RawFileChange[] = [];
  for (const name of names) {
    const o = oldByName.get(name);
    const n = newByName.get(name);
    const p = prefix ? `${prefix}/${name}` : name;

    if (o && n) {
      if (o.sha === n.sha) continue; // identical subtree/blob — prune
      if (o.type === "tree" && n.type === "tree") {
        changes.push(...(await diffTrees(getTree, o.sha, n.sha, p)));
      } else if (o.type === "blob" && n.type === "blob") {
        changes.push({ path: p, status: "modified", oldSha: o.sha, newSha: n.sha });
      } else {
        // file ⇄ directory swap — model as a removal plus an addition
        await emitSide(getTree, o, p, "removed", changes);
        await emitSide(getTree, n, p, "added", changes);
      }
    } else if (n) {
      await emitSide(getTree, n, p, "added", changes);
    } else if (o) {
      await emitSide(getTree, o, p, "removed", changes);
    }
  }
  return changes;
}

/* ------------------------------------------------------------------ */
/* Line-level (text) diff                                              */
/* ------------------------------------------------------------------ */

export type DiffLineKind = "context" | "add" | "del" | "hunk";

export interface DiffLine {
  kind: DiffLineKind;
  text: string;
  oldNumber?: number;
  newNumber?: number;
}

export interface TextDiff {
  lines: DiffLine[];
  additions: number;
  deletions: number;
  /** Set when both sides are large enough that an O(n·m) diff is skipped. */
  tooLarge: boolean;
}

/** ~1.5M DP cells (e.g. 1200×1200) — above this we skip the inline diff. */
const MAX_DIFF_CELLS = 1_500_000;
/** How many unchanged lines to keep around each change. */
const CONTEXT = 3;

function splitLines(text: string): string[] {
  if (text === "") return [];
  return text.replace(/\r\n/g, "\n").replace(/\n$/, "").split("\n");
}

/** Classic LCS backtrack → a full op list (every line tagged). */
function lcsOps(a: string[], b: string[]): DiffLine[] {
  const n = a.length;
  const m = b.length;
  // dp[i][j] = LCS length of a[i:] and b[j:]
  const dp: Uint32Array[] = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    const row = dp[i];
    const next = dp[i + 1];
    for (let j = m - 1; j >= 0; j--) {
      row[j] = a[i] === b[j] ? next[j + 1] + 1 : Math.max(next[j], row[j + 1]);
    }
  }

  const ops: DiffLine[] = [];
  let i = 0;
  let j = 0;
  let oldNo = 1;
  let newNo = 1;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      ops.push({ kind: "context", text: a[i], oldNumber: oldNo++, newNumber: newNo++ });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      ops.push({ kind: "del", text: a[i], oldNumber: oldNo++ });
      i++;
    } else {
      ops.push({ kind: "add", text: b[j], newNumber: newNo++ });
      j++;
    }
  }
  while (i < n) ops.push({ kind: "del", text: a[i++], oldNumber: oldNo++ });
  while (j < m) ops.push({ kind: "add", text: b[j++], newNumber: newNo++ });
  return ops;
}

/** Collapse runs of unchanged context into hunks with `@@ … @@` headers. */
function toHunks(ops: DiffLine[]): DiffLine[] {
  const changed = ops
    .map((o, i) => (o.kind !== "context" ? i : -1))
    .filter((i) => i >= 0);
  if (changed.length === 0) return [];

  const windows: [number, number][] = [];
  for (const idx of changed) {
    const start = Math.max(0, idx - CONTEXT);
    const end = Math.min(ops.length - 1, idx + CONTEXT);
    const last = windows[windows.length - 1];
    if (last && start <= last[1] + 1) last[1] = Math.max(last[1], end);
    else windows.push([start, end]);
  }

  const out: DiffLine[] = [];
  for (const [s, e] of windows) {
    const slice = ops.slice(s, e + 1);
    const firstOld = slice.find((o) => o.oldNumber != null)?.oldNumber ?? 0;
    const firstNew = slice.find((o) => o.newNumber != null)?.newNumber ?? 0;
    const oldCount = slice.filter((o) => o.oldNumber != null).length;
    const newCount = slice.filter((o) => o.newNumber != null).length;
    out.push({
      kind: "hunk",
      text: `@@ -${firstOld},${oldCount} +${firstNew},${newCount} @@`,
    });
    out.push(...slice);
  }
  return out;
}

/** Unified line diff between two text blobs. */
export function diffText(oldText: string, newText: string): TextDiff {
  const a = splitLines(oldText);
  const b = splitLines(newText);

  // Pure add / pure remove are cheap (one side empty) and never hit the cap.
  if (a.length > 0 && b.length > 0 && a.length * b.length > MAX_DIFF_CELLS) {
    return { lines: [], additions: 0, deletions: 0, tooLarge: true };
  }

  const ops = lcsOps(a, b);
  const additions = ops.reduce((s, o) => s + (o.kind === "add" ? 1 : 0), 0);
  const deletions = ops.reduce((s, o) => s + (o.kind === "del" ? 1 : 0), 0);
  return { lines: toHunks(ops), additions, deletions, tooLarge: false };
}

/* ------------------------------------------------------------------ */
/* Blob decoding + assembled per-commit diff types                     */
/* ------------------------------------------------------------------ */

/** Decode a blob for diffing. base64 blobs are treated as binary (not shown). */
export function blobToText(blob: Blob | undefined): {
  text: string | null;
  binary: boolean;
} {
  if (!blob) return { text: null, binary: false };
  if (blob.encoding === "utf-8") return { text: blob.content ?? "", binary: false };
  return { text: null, binary: true };
}

export interface FileDiff extends RawFileChange {
  binary: boolean;
  tooLarge: boolean;
  additions: number;
  deletions: number;
  lines: DiffLine[];
}

export interface CommitDiffResult {
  commit: Commit;
  parentSha: string | null;
  files: FileDiff[];
  additions: number;
  deletions: number;
}
