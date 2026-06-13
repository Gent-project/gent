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
  commits: (o: number | string, n: string) => ["git", "commits", String(o), n] as const,
  tags: (o: number | string, n: string) => ["git", "tags", String(o), n] as const,
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
