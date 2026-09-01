import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "@/lib/axios";
import { Branch } from "@/types/repository";

// Get all branches for a repository
export const useBranches = (ownerId: number, repoName: string) => {
  return useQuery<Branch[]>({
    queryKey: ['branches', ownerId, repoName],
    queryFn: async () => {
      const response = await axios.get(`/repos/${ownerId}/${repoName}/branches/`);
      return response.data;
    },
    enabled: !!ownerId && !!repoName
  });
};

// Get single branch details
export const useBranch = (ownerId: number, repoName: string, branchName: string) => {
  return useQuery<Branch>({
    queryKey: ['branch', ownerId, repoName, branchName],
    queryFn: async () => {
      const response = await axios.get(`/repos/${ownerId}/${repoName}/branches/${branchName}/`);
      return response.data;
    },
    enabled: !!ownerId && !!repoName && !!branchName
  });
};

// Create new branch
export const useCreateBranch = () => {
  const queryClient = useQueryClient();
  
  return useMutation<Branch, Error, { ownerId: number; repoName: string; data: { name: string; commit_sha: string } }>({
    mutationFn: async ({ ownerId, repoName, data }) => {
      const response = await axios.post(`/repos/${ownerId}/${repoName}/branches/create/`, data);
      return response.data;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['branches', variables.ownerId, variables.repoName] });
    }
  });
};

// Update branch pointer
export const useUpdateBranch = () => {
  const queryClient = useQueryClient();
  
  return useMutation<Branch, Error, { ownerId: number; repoName: string; branchName: string; data: { commit_sha: string } }>({
    mutationFn: async ({ ownerId, repoName, branchName, data }) => {
      const response = await axios.patch(`/repos/${ownerId}/${repoName}/branches/${branchName}/`, data);
      return response.data;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['branches', variables.ownerId, variables.repoName] });
      queryClient.invalidateQueries({ queryKey: ['branch', variables.ownerId, variables.repoName, variables.branchName] });
    }
  });
};

// Delete branch
export const useDeleteBranch = () => {
  const queryClient = useQueryClient();
  
  return useMutation<void, Error, { ownerId: number; repoName: string; branchName: string }>({
    mutationFn: async ({ ownerId, repoName, branchName }) => {
      await axios.delete(`/repos/${ownerId}/${repoName}/branches/${branchName}/`);
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['branches', variables.ownerId, variables.repoName] });
    }
  });
};