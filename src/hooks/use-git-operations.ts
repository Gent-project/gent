import { useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "@/lib/axios";

// Git pack structure for push operations
export interface GitPack {
  commits: Array<{
    hash: string;
    message: string;
    author: {
      name: string;
      email: string;
    };
    timestamp: string;
    parent: string | null; // Can be null for initial commit
    mergeParent?: string | null;
    treeHash: string;
    tree: Array<{
      mode: string;
      name: string;
      path: string;
      hash: string;
      sha: string;
      type: "blob" | "tree";
    }>;
    files: Array<{
      path: string;
      hash: string;
    }>;
    stats: Record<string, any>;
  }>;
  objects: Array<{
    hash: string;
    size?: number;
    type: "blob" | "tree" | "commit";
    data: string;
  }>;
  branch_updates: Array<{
    name: string;
    commit_sha: string;
  }>;
  tags: Record<string, string>;
  branch: string;
  force: boolean;
}

// Push pack to repository
export const usePushPack = () => {
  const queryClient = useQueryClient();

  return useMutation<
    any,
    Error,
    { ownerId: number; repoName: string; pack: GitPack }
  >({
    mutationFn: async ({ ownerId, repoName, pack }) => {
      const response = await axios.post(
        `/repos/${ownerId}/${repoName}/push/`,
        pack,
      );

      return response.data;
    },
    onSuccess: (data, variables) => {
      // Invalidate all related queries after push
      queryClient.invalidateQueries({
        queryKey: ["branches", variables.ownerId, variables.repoName],
      });
      queryClient.invalidateQueries({
        queryKey: ["commits", variables.ownerId, variables.repoName],
      });
      queryClient.invalidateQueries({
        queryKey: ["tags", variables.ownerId, variables.repoName],
      });
      queryClient.invalidateQueries({
        queryKey: ["tree", variables.ownerId, variables.repoName],
      });
    },
  });
};

// Pull commits and objects from repository
export const usePullRepository = () => {
  return useMutation<any, Error, { ownerId: number; repoName: string }>({
    mutationFn: async ({ ownerId, repoName }) => {
      const response = await axios.get(`/repos/${ownerId}/${repoName}/pull/`);
      return response.data;
    },
  });
};

// Get repository clone URL
export const getCloneUrl = (
  ownerId: number | string,
  repoName: string,
  protocol: "https" | "ssh" = "https",
) => {
  if (protocol === "ssh") {
    return `/api/repos/${ownerId}/${repoName}`;
  }

  return `https://gent-api.onrender.com/api/repos/${ownerId}/${repoName}`;
};
