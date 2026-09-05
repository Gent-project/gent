import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "@/lib/axios";
import { Commit } from "@/types/repository";
import { RepositoryService } from "@/services/repository.service";
// Get all commits for a repository
export const useCommits = (
  ownerId: number | string,
  repoName: string,
  branch?: string,
) => {
  return useQuery<Commit[]>({
    queryKey: ["commits", ownerId, repoName, branch],
    queryFn: async () => {
      const params = branch ? `?branch=${branch}` : "";
      const response = await axios.get(
        `/repos/${ownerId}/${repoName}/commits/${params}`,
      );
      return response.data;
    },
    enabled: !!ownerId && !!repoName,
  });
};

// Get single commit details
export const useCommit = (ownerId: number | string, repoName: string, sha: string) => {
  return useQuery<Commit>({
    queryKey: ["commit", ownerId, repoName, sha],
    queryFn: async () => {
      const response = await axios.get(
        `/repos/${ownerId}/${repoName}/commits/${sha}/`,
      );
      return response.data;
    },
    enabled: !!ownerId && !!repoName && !!sha,
  });
};

// Get commit diff
export const useCommitDiff = (
  ownerId: number | string,
  repoName: string,
  sha: string,
) => {
  return useQuery<any>({
    queryKey: ["commit-diff", ownerId, repoName, sha],
    queryFn: () => RepositoryService.getCommitDiff(ownerId, repoName, sha),
    enabled: !!ownerId && !!repoName && !!sha,
  });
};
interface CreateCommitData {
  sha?: string;
  message: string;
  tree_sha: string;
  parent_shas?: string[];
  author_name: string;
  author_email: string;
  branch: string;
}

// Create new commit
export const useCreateCommit = () => {
  const queryClient = useQueryClient();

  return useMutation<
    Commit,
    Error,
    { ownerId: number | string; repoName: string; data: CreateCommitData }
  >({
    mutationFn: async ({ ownerId, repoName, data }) => {
      const response = await axios.post(
        `/repos/${ownerId}/${repoName}/commits/create/`,
        data,
      );
      return response.data;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["commits", variables.ownerId, variables.repoName],
      });
      queryClient.invalidateQueries({
        queryKey: ["tree", variables.ownerId, variables.repoName],
      });
      queryClient.invalidateQueries({
        queryKey: ["blob", variables.ownerId, variables.repoName],
      });
    },
  });
};
