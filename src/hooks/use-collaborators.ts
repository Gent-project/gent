import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "@/lib/axios";

export interface Collaborator {
  user_id: number;
  email: string;
  role: "write" | string;
  created_at: string;
}

interface AddCollaboratorData {
  ownerId: number;
  repoName: string;
  email: string;
  role?: "write";
}

interface RemoveCollaboratorData {
  ownerId: number;
  repoName: string;
  userId: number;
}

export const collaboratorsKeys = {
  all: ["collaborators"] as const,
  list: (ownerId: number, repoName: string) =>
    [...collaboratorsKeys.all, ownerId, repoName] as const,
};

export function useCollaborators(ownerId: number, repoName: string) {
  return useQuery<Collaborator[]>({
    queryKey: collaboratorsKeys.list(ownerId, repoName),
    queryFn: async () => {
      const response = await axios.get(
        `/repos/${ownerId}/${repoName}/members/`,
      );

      return response.data ?? [];
    },
    enabled: Boolean(ownerId && repoName),
  });
}

export function useAddCollaborator() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      ownerId,
      repoName,
      email,
      role = "write",
    }: AddCollaboratorData) => {
      const response = await axios.post(
        `/repos/${ownerId}/${repoName}/members/`,
        {
          email,
          role,
        },
      );

      return response.data as Collaborator;
    },

    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: collaboratorsKeys.list(variables.ownerId, variables.repoName),
      });
    },
  });
}

export function useRemoveCollaborator() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      ownerId,
      repoName,
      userId,
    }: RemoveCollaboratorData) => {
      await axios.delete(`/repos/${ownerId}/${repoName}/members/${userId}/`);
    },

    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: collaboratorsKeys.list(variables.ownerId, variables.repoName),
      });
    },
  });
}
