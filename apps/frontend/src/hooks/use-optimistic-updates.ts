import { useQueryClient } from "@tanstack/react-query";
import { Repository, Branch, Tag, Commit } from "@/types/repository";
import { addToast } from "@/components/ui/Toast";

export const useOptimisticUpdates = () => {
  const queryClient = useQueryClient();

  const optimisticCreateRepository = (newRepo: Partial<Repository>) => {
    queryClient.setQueryData(['repositories'], (old: Repository[] = []) => [
      { 
        ...newRepo, 
        id: Date.now(), // Temporary ID
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as Repository,
      ...old
    ]);

    addToast({
      type: 'success',
      title: 'Repository Created',
      message: `Repository "${newRepo.name}" has been created successfully.`,
    });
  };

  const optimisticDeleteRepository = (repoId: number) => {
    queryClient.setQueryData(['repositories'], (old: Repository[] = []) =>
      old.filter(repo => repo.id !== repoId)
    );

    addToast({
      type: 'info',
      title: 'Repository Deleted',
      message: 'Repository has been removed from your account.',
    });
  };

  const optimisticCreateBranch = (ownerId: number, repoName: string, newBranch: Partial<Branch>) => {
    queryClient.setQueryData(['branches', ownerId, repoName], (old: Branch[] = []) => [
      {
        ...newBranch,
        id: Date.now(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as Branch,
      ...old
    ]);

    addToast({
      type: 'success',
      title: 'Branch Created',
      message: `Branch "${newBranch.name}" has been created successfully.`,
    });
  };

  const optimisticDeleteBranch = (ownerId: number, repoName: string, branchName: string) => {
    queryClient.setQueryData(['branches', ownerId, repoName], (old: Branch[] = []) =>
      old.filter(branch => branch.name !== branchName)
    );

    addToast({
      type: 'info',
      title: 'Branch Deleted',
      message: `Branch "${branchName}" has been deleted.`,
    });
  };

  const optimisticCreateTag = (ownerId: number, repoName: string, newTag: Partial<Tag>) => {
    queryClient.setQueryData(['tags', ownerId, repoName], (old: Tag[] = []) => [
      {
        ...newTag,
        id: Date.now(),
        created_at: new Date().toISOString(),
      } as Tag,
      ...old
    ]);

    addToast({
      type: 'success',
      title: 'Tag Created',
      message: `Tag "${newTag.name}" has been created successfully.`,
    });
  };

  const optimisticDeleteTag = (ownerId: number, repoName: string, tagName: string) => {
    queryClient.setQueryData(['tags', ownerId, repoName], (old: Tag[] = []) =>
      old.filter(tag => tag.name !== tagName)
    );

    addToast({
      type: 'info',
      title: 'Tag Deleted',
      message: `Tag "${tagName}" has been deleted.`,
    });
  };

  return {
    optimisticCreateRepository,
    optimisticDeleteRepository,
    optimisticCreateBranch,
    optimisticDeleteBranch,
    optimisticCreateTag,
    optimisticDeleteTag,
  };
};