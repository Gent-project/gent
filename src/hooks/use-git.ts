"use client";

/**
 * Git-shaped data hooks for branches, commits, tags inside one repo.
 *
 * Each hook polls every 12s so a `gent push` from the terminal is reflected on
 * the web within a couple of seconds without manual refresh.
 */
import { useQuery } from "@tanstack/react-query";

import { gitService } from "@/services/git.service";

export const gitKeys = {
  branches: (o: number | string, n: string) => ["git", "branches", String(o), n] as const,
  branchDetail: (o: number | string, n: string, b: string) =>
    ["git", "branch", String(o), n, b] as const,
  commits: (o: number | string, n: string) => ["git", "commits", String(o), n] as const,
  commit: (o: number | string, n: string, sha: string) =>
    ["git", "commit", String(o), n, sha] as const,
  tags: (o: number | string, n: string) => ["git", "tags", String(o), n] as const,
  tree: (o: number | string, n: string, sha: string) =>
    ["git", "tree", String(o), n, sha] as const,
  blob: (o: number | string, n: string, sha: string) =>
    ["git", "blob", String(o), n, sha] as const,
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
