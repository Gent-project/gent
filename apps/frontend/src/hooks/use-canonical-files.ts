import { useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "@/lib/axios";
import { useRepository } from "@/hooks/use-repositories";
import type { Commit } from "@/types/repository";

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 8192) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  }
  return btoa(binary);
}

export function useCanonicalFiles(ownerId: number | string, repoName: string) {
  const repository = useRepository(ownerId, repoName);
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: async (changes: {
      branch: string;
      expected_head: string | null;
      message: string;
      files: Array<{ path: string; data?: string; delete?: boolean }>;
    }) => {
      const response = await axios.post<{ commit: Commit }>(
        `/repos/${ownerId}/${repoName}/files/commit/`, changes,
      );
      return response.data.commit;
    },
    onSuccess: async () => {
      await Promise.all(["commits", "branches", "tree", "blob"].map(key =>
        queryClient.invalidateQueries({ queryKey: [key, ownerId, repoName] }),
      ));
    },
  });
  return { ...mutation, ready: !!repository.data, canonical: repository.data?.object_format === "sha256" };
}
