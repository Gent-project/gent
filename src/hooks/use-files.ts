import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "@/lib/axios";
import { Blob } from "@/types/repository";

export interface TreeEntry {
  mode: string;
  name: string;
  path: string;
  hash: string;
  sha: string;
  type: "blob" | "tree";
}

export interface Tree {
  sha: string;
  entries: TreeEntry[];
}

// Get tree (directory listing)
export const useTree = (
  ownerId: number,
  repoName: string,
  sha: string,
  options?: { enabled?: boolean },
) => {
  return useQuery<Tree>({
    queryKey: ["tree", ownerId, repoName, sha],
    queryFn: async () => {
      const response = await axios.get(
        `/repos/${ownerId}/${repoName}/tree/${sha}/`,
      );
      return response.data;
    },
    enabled:
      options?.enabled !== undefined
        ? options.enabled
        : !!ownerId && !!repoName && !!sha,
  });
};

// Get blob (file content)
export const useBlob = (ownerId: number, repoName: string, sha: string) => {
  return useQuery<Blob>({
    queryKey: ["blob", ownerId, repoName, sha],
    queryFn: async () => {
      const response = await axios.get(
        `/repos/${ownerId}/${repoName}/blob/${sha}/`,
      );
      return response.data;
    },
    enabled: !!ownerId && !!repoName && !!sha,
  });
};

interface CreateBlobData {
  content: string;
  encoding: string;
}

export interface CreateBlobResponse {
  message?: string;
  blob: Blob;
}

// Create new blob (file)
export const useCreateBlob = () => {
  const queryClient = useQueryClient();

  return useMutation<
    Blob,
    Error,
    { ownerId: number; repoName: string; data: CreateBlobData }
  >({
    mutationFn: async ({ ownerId, repoName, data }) => {
      const response = await axios.post(
        `/repos/${ownerId}/${repoName}/blob/create/`,
        data,
      );
      return response.data?.blob ?? response.data;
    },
    onSuccess: (data, variables) => {
      // Invalidate related queries
      queryClient.invalidateQueries({
        queryKey: ["tree", variables.ownerId, variables.repoName],
      });
    },
  });
};

interface CreateTreeData {
  entries: Array<{
    mode: string;
    name: string;
    sha: string;
    type: "blob" | "tree";
  }>;
}

export interface CreateTreeResponse {
  message?: string;
  tree: Tree;
}

// Create new tree (directory)
export const useCreateTree = () => {
  const queryClient = useQueryClient();

  return useMutation<
    Tree,
    Error,
    { ownerId: number; repoName: string; data: CreateTreeData }
  >({
    mutationFn: async ({ ownerId, repoName, data }) => {
      const response = await axios.post(
        `/repos/${ownerId}/${repoName}/tree/create/`,
        data,
      );
      return response.data?.tree ?? response.data;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["tree", variables.ownerId, variables.repoName],
      });
    },
  });
};
