import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "@/lib/axios";

// Clone repository - Get all commits, blobs, branches, and tags
export interface CloneResponse {
  commits: any[];
  blobs: any[];
  branches: any[];
  tags: any[];
}

export const useCloneRepository = (
  ownerId: number,
  repoName: string,
  enabled: boolean = false,
) => {
  return useQuery<CloneResponse>({
    queryKey: ["clone", ownerId, repoName],
    queryFn: async () => {
      const response = await axios.get(`/repos/${ownerId}/${repoName}/clone/`);
      return response.data;
    },
    enabled: enabled && !!ownerId && !!repoName,
  });
};

// Repository Members
export interface RepositoryMember {
  id: number;
  user_id: number;
  username: string;
  email: string;
  role: string;
  added_at: string;
}

// Get repository members
export const useRepositoryMembers = (ownerId: number, repoName: string) => {
  return useQuery<RepositoryMember[]>({
    queryKey: ["repository-members", ownerId, repoName],
    queryFn: async () => {
      const response = await axios.get(
        `/repos/${ownerId}/${repoName}/members/`,
      );
      return response.data;
    },
    enabled: !!ownerId && !!repoName,
  });
};

// Add repository member
export const useAddRepositoryMember = () => {
  const queryClient = useQueryClient();

  return useMutation<
    RepositoryMember,
    Error,
    {
      ownerId: number;
      repoName: string;
      data: { user_id: number; role?: string };
    }
  >({
    mutationFn: async ({ ownerId, repoName, data }) => {
      const response = await axios.post(
        `/repos/${ownerId}/${repoName}/members/`,
        data,
      );
      return response.data;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["repository-members", variables.ownerId, variables.repoName],
      });
    },
  });
};

// Remove repository member
export const useRemoveRepositoryMember = () => {
  const queryClient = useQueryClient();

  return useMutation<
    void,
    Error,
    { ownerId: number; repoName: string; userId: number }
  >({
    mutationFn: async ({ ownerId, repoName, userId }) => {
      await axios.delete(`/repos/${ownerId}/${repoName}/members/${userId}/`);
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["repository-members", variables.ownerId, variables.repoName],
      });
    },
  });
};
