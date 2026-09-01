import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "@/lib/axios";
import { Tag } from "@/types/repository";

// Get all tags for a repository
export const useTags = (ownerId: number, repoName: string) => {
  return useQuery<Tag[]>({
    queryKey: ['tags', ownerId, repoName],
    queryFn: async () => {
      const response = await axios.get(`/repos/${ownerId}/${repoName}/tags/`);
      return response.data;
    },
    enabled: !!ownerId && !!repoName
  });
};

interface CreateTagData {
  name: string;
  commit_sha: string;
  message: string;
  annotated: boolean;
  tagger_name: string;
  tagger_email: string;
}

// Create new tag
export const useCreateTag = () => {
  const queryClient = useQueryClient();
  
  return useMutation<Tag, Error, { ownerId: number; repoName: string; data: CreateTagData }>({
    mutationFn: async ({ ownerId, repoName, data }) => {
      const response = await axios.post(`/repos/${ownerId}/${repoName}/tags/create/`, data);
      return response.data;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['tags', variables.ownerId, variables.repoName] });
    }
  });
};

// Delete tag
export const useDeleteTag = () => {
  const queryClient = useQueryClient();
  
  return useMutation<void, Error, { ownerId: number; repoName: string; tagName: string }>({
    mutationFn: async ({ ownerId, repoName, tagName }) => {
      await axios.delete(`/repos/${ownerId}/${repoName}/tags/${tagName}/`);
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['tags', variables.ownerId, variables.repoName] });
    }
  });
};