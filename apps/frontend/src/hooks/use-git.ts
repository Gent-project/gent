"use client";

/**
 * Git-shaped data hooks for branches, commits, tags inside one repo.
 *
 * Each hook polls every 12s so a `gent push` from the terminal is reflected on
 * the web within a couple of seconds without manual refresh.
 */
import { useQuery } from "@tanstack/react-query";

import { gitService } from "@/services/git.service";
import {
  blobToText,
  diffText,
  diffTrees,
  isEmptyTreeSha,
  type CommitDiffResult,
  type FileDiff,
} from "@/lib/diff";
import type { Blob, Commit, Tree, TreeEntry } from "@/types/api";

export const gitKeys = {
  branches: (o: number | string, n: string) => ["git", "branches", String(o), n] as const,
  branchDetail: (o: number | string, n: string, b: string) =>
    ["git", "branch", String(o), n, b] as const,
  commits: (o: number | string, n: string) => ["git", "commits", String(o), n] as const,
  commit: (o: number | string, n: string, sha: string) =>
    ["git", "commit", String(o), n, sha] as const,
  commitDiff: (o: number | string, n: string, sha: string) =>
    ["git", "commit-diff", String(o), n, sha] as const,
  tags: (o: number | string, n: string) => ["git", "tags", String(o), n] as const,
  tree: (o: number | string, n: string, sha: string) =>
    ["git", "tree", String(o), n, sha] as const,
  blob: (o: number | string, n: string, sha: string) =>
    ["git", "blob", String(o), n, sha] as const,
  dirCommits: (o: number | string, n: string, head: string, path: string) =>
    ["git", "dir-commits", String(o), n, head, path] as const,
};

const LIVE_INTERVAL_MS = 12_000;

export function useBranches(ownerId: number | string, name: string) {
  return useQuery({
    queryKey: gitKeys.branches(ownerId, name),
    queryFn: () => gitService.branches(ownerId, name),
    refetchInterval: LIVE_INTERVAL_MS,
    refetchOnWindowFocus: true,
    enabled: !!ownerId && !!name,
  });
}

export function useCommits(ownerId: number | string, name: string) {
  return useQuery({
    queryKey: gitKeys.commits(ownerId, name),
    queryFn: () => gitService.commits(ownerId, name),
    refetchInterval: LIVE_INTERVAL_MS,
    refetchOnWindowFocus: true,
    enabled: !!ownerId && !!name,
  });
}

export function useTags(ownerId: number | string, name: string) {
  return useQuery({
    queryKey: gitKeys.tags(ownerId, name),
    queryFn: () => gitService.tags(ownerId, name),
    refetchInterval: LIVE_INTERVAL_MS,
    refetchOnWindowFocus: true,
    enabled: !!ownerId && !!name,
  });
}

const ZERO_SHA = "0".repeat(64);
/** True for the placeholder head sha given to brand-new empty branches. */
export function isEmptySha(sha: string | undefined): boolean {
  return !sha || sha === ZERO_SHA || /^0+$/.test(sha);
}

/** Latest commit object for a branch (resolves branch.commit_sha → /commits/{sha}/). */
export function useBranchCommit(
  ownerId: number | string,
  name: string,
  branchName: string,
) {
  return useQuery({
    queryKey: gitKeys.branchDetail(ownerId, name, branchName),
    queryFn: async () => {
      const branch = await gitService.branchDetail(ownerId, name, branchName);
      if (isEmptySha(branch.commit_sha)) return { branch, commit: null };
      const commit = await gitService.commitDetail(ownerId, name, branch.commit_sha);
      return { branch, commit };
    },
    enabled: !!ownerId && !!name && !!branchName,
    refetchInterval: LIVE_INTERVAL_MS,
    refetchOnWindowFocus: true,
  });
}

export function useTree(
  ownerId: number | string,
  name: string,
  sha: string | undefined,
) {
  return useQuery({
    queryKey: gitKeys.tree(ownerId, name, sha ?? ""),
    queryFn: () => gitService.tree(ownerId, name, sha as string),
    enabled: !!ownerId && !!name && !!sha && !isEmptySha(sha),
    staleTime: 5 * 60_000,
  });
}

export function useBlob(
  ownerId: number | string,
  name: string,
  sha: string | undefined,
) {
  return useQuery({
    queryKey: gitKeys.blob(ownerId, name, sha ?? ""),
    queryFn: () => gitService.blob(ownerId, name, sha as string),
    enabled: !!ownerId && !!name && !!sha && !isEmptySha(sha),
    staleTime: 5 * 60_000,
  });
}

/* ----------- Commit diff ("what changed in this commit") ----------- */

/**
 * Resolve the full diff of a commit against its first parent.
 *
 * There's no diff endpoint, so we do it client-side (see `lib/diff.ts`):
 * compare the commit tree to the parent tree, then line-diff each changed
 * text blob. Commits are immutable, so the result never goes stale.
 */
export function useCommitDiff(
  ownerId: number | string,
  name: string,
  sha: string | undefined,
) {
  return useQuery({
    queryKey: gitKeys.commitDiff(ownerId, name, sha ?? ""),
    enabled: !!ownerId && !!name && !!sha && !isEmptySha(sha),
    staleTime: Infinity,
    queryFn: async (): Promise<CommitDiffResult> => {
      // Per-call caches so a tree/blob shared by both sides is fetched once.
      const trees = new Map<string, Promise<Tree>>();
      const getTree = (s: string) => {
        let p = trees.get(s);
        if (!p) {
          p = gitService.tree(ownerId, name, s);
          trees.set(s, p);
        }
        return p;
      };
      const blobs = new Map<string, Promise<Blob>>();
      const getBlob = (s: string) => {
        let p = blobs.get(s);
        if (!p) {
          p = gitService.blob(ownerId, name, s);
          blobs.set(s, p);
        }
        return p;
      };

      const commit = await gitService.commitDetail(ownerId, name, sha as string);
      const parentSha = commit.parent_shas?.[0] ?? null;
      const parentCommit = parentSha
        ? await gitService.commitDetail(ownerId, name, parentSha)
        : null;
      const oldTreeSha = parentCommit?.tree_sha ?? null;

      const changes = await diffTrees(getTree, oldTreeSha, commit.tree_sha);
      changes.sort((a, b) => a.path.localeCompare(b.path));

      const files: FileDiff[] = await Promise.all(
        changes.map(async (c): Promise<FileDiff> => {
          const [oldBlob, newBlob] = await Promise.all([
            c.oldSha ? getBlob(c.oldSha) : Promise.resolve(undefined),
            c.newSha ? getBlob(c.newSha) : Promise.resolve(undefined),
          ]);
          const oldText = blobToText(oldBlob);
          const newText = blobToText(newBlob);
          if (oldText.binary || newText.binary) {
            return { ...c, binary: true, tooLarge: false, additions: 0, deletions: 0, lines: [] };
          }
          const d = diffText(oldText.text ?? "", newText.text ?? "");
          return {
            ...c,
            binary: false,
            tooLarge: d.tooLarge,
            additions: d.additions,
            deletions: d.deletions,
            lines: d.lines,
          };
        }),
      );

      const additions = files.reduce((s, f) => s + f.additions, 0);
      const deletions = files.reduce((s, f) => s + f.deletions, 0);
      return { commit, parentSha, files, additions, deletions };
    },
  });
}

/* ----------- Per-file "last commit" (directory blame) ----------- */

/**
 * For the directory currently shown in the file browser, find the most recent
 * commit that touched each entry — the data behind GitHub's "last commit per
 * file" columns. Computed by walking the branch's first-parent history from
 * HEAD and stopping as soon as every visible entry is attributed.
 *
 * Returns a map of `entryName → Commit | null` (null = not resolved within the
 * walk budget, so the UI falls back to the entry sha).
 */
export function useDirLastCommits(
  ownerId: number | string,
  name: string,
  headSha: string | undefined,
  pathNames: string[],
  entries: TreeEntry[] | undefined,
  commits: Commit[] | undefined,
) {
  const pathKey = pathNames.join("/");
  const entryNames = (entries ?? []).map((e) => e.name);

  return useQuery({
    queryKey: [
      ...gitKeys.dirCommits(ownerId, name, headSha ?? "", pathKey),
      entryNames.length,
    ],
    enabled:
      !!ownerId &&
      !!name &&
      !!headSha &&
      !isEmptySha(headSha) &&
      entryNames.length > 0,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<Record<string, Commit | null>> => {
      const trees = new Map<string, Promise<Tree>>();
      const getTree = (s: string) => {
        let p = trees.get(s);
        if (!p) {
          p = gitService.tree(ownerId, name, s);
          trees.set(s, p);
        }
        return p;
      };
      const commitCache = new Map<string, Commit>();
      (commits ?? []).forEach((c) => commitCache.set(c.sha, c));
      const getCommit = async (s: string): Promise<Commit> => {
        let c = commitCache.get(s);
        if (!c) {
          c = await gitService.commitDetail(ownerId, name, s);
          commitCache.set(s, c);
        }
        return c;
      };

      // Resolve the tree sha for the current path inside a given root tree.
      const resolveDirSha = async (rootTreeSha: string | null): Promise<string | null> => {
        if (!rootTreeSha || isEmptyTreeSha(rootTreeSha)) return null;
        let cur = rootTreeSha;
        for (const seg of pathNames) {
          const t = await getTree(cur);
          const child = t.entries.find((e) => e.type === "tree" && e.name === seg);
          if (!child) return null;
          cur = child.sha;
        }
        return cur;
      };
      const childShas = async (dirSha: string | null): Promise<Map<string, string>> => {
        const m = new Map<string, string>();
        if (!dirSha) return m;
        const t = await getTree(dirSha);
        for (const e of t.entries) m.set(e.name, e.sha);
        return m;
      };

      const result: Record<string, Commit | null> = {};
      const unresolved = new Set(entryNames);

      let cur: Commit | null = await getCommit(headSha as string);
      let curDirSha = await resolveDirSha(cur.tree_sha);
      let curChildren = await childShas(curDirSha);
      let guard = 0;

      while (cur && unresolved.size > 0 && guard++ < 400) {
        const parentSha: string | null = cur.parent_shas?.[0] ?? null;
        const parent: Commit | null = parentSha ? await getCommit(parentSha) : null;
        const parentDirSha = parent ? await resolveDirSha(parent.tree_sha) : null;

        // If the directory sha is unchanged, this commit touched nothing here.
        if (parentDirSha !== curDirSha) {
          const parentChildren = await childShas(parentDirSha);
          for (const entryName of Array.from(unresolved)) {
            const here = curChildren.get(entryName);
            const before = parentChildren.get(entryName);
            if (here !== undefined && here !== before) {
              result[entryName] = cur;
              unresolved.delete(entryName);
            }
          }
          curChildren = parentChildren;
        }
        cur = parent;
        curDirSha = parentDirSha;
      }

      for (const entryName of unresolved) result[entryName] = null;
      return result;
    },
  });
}
