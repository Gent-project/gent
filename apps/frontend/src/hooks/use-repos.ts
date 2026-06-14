"use client";

/**
 * Repository hooks: list, create, single-repo detail.
 *
 * Caches under `["repos"]` so a successful create can patch the list cache and
 * the dashboard updates instantly without an extra round-trip.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { reposService } from "@/services/repos.service";
import { readApiError } from "@/lib/api-client";
import type { CreateRepoPayload, Repository } from "@/types/api";

export const reposKeys = {
  all: ["repos"] as const,
  list: () => [...reposKeys.all, "list"] as const,
  detail: (owner: number | string, name: string) =>
    [...reposKeys.all, "detail", String(owner), name] as const,
};

export function useReposList() {
  return useQuery({
    queryKey: reposKeys.list(),
    queryFn: reposService.list,
    staleTime: 30_000,
    // Refetch on focus so coming back from the CLI shows new pushes quickly.
    refetchOnWindowFocus: true,
  });
}

export function useRepoDetail(ownerId: number | string, name: string) {
  return useQuery({
    queryKey: reposKeys.detail(ownerId, name),
    queryFn: () => reposService.detail(ownerId, name),
    enabled: !!ownerId && !!name,
  });
}

export function useCreateRepo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateRepoPayload) => reposService.create(payload),
    onSuccess: (created) => {
      // Optimistically prepend to the cached list so the dashboard reflects
      // the new project without waiting for a refetch.
      qc.setQueryData<Repository[]>(reposKeys.list(), (old) =>
        old ? [created, ...old] : [created],
      );
      toast.success(`Project "${created.name}" created.`);
    },
    onError: (err) => toast.error(readApiError(err)),
  });
}

export function useDeleteRepo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ ownerId, name }: { ownerId: number; name: string }) =>
      reposService.remove(ownerId, name),
    onSuccess: (_, { name }) => {
      qc.invalidateQueries({ queryKey: reposKeys.list() });
      toast.success(`Project "${name}" deleted.`);
    },
    onError: (err) => toast.error(readApiError(err)),
  });
}
