import { useQuery } from "@tanstack/react-query";
import axios from "@/lib/axios";
import type { Commit, Repository } from "@/types/repository";

export interface ActivityRepository {
  id: number;
  name: string;
  owner?: string;
}

export interface ActivityActor {
  id?: number;
  name: string;
  email?: string;
}

export interface Activity {
  id: string;
  type: string;
  title: string;
  message: string;
  repository?: ActivityRepository;
  actor?: ActivityActor;
  created_at: string;
  createdAt?: string;
  url?: string;
}

const normalizeActivity = (activity: Partial<Activity>): Activity => ({
  id: String(activity.id ?? `${activity.type}-${activity.created_at}`),
  type: String(activity.type ?? "commit"),
  title: String(activity.title ?? "Activity"),
  message: String(activity.message ?? ""),
  repository: activity.repository,
  actor: activity.actor,
  created_at: String(activity.created_at ?? activity.createdAt ?? ""),
  url: typeof activity.url === "string" ? activity.url : undefined,
});

export const useActivities = () => {
  return useQuery<Activity[]>({
    queryKey: ["activities"],
    queryFn: async () => {
      const { data: repositoriesData } = await axios.get<Repository[]>(
        "/repos/",
      );
      const repositories = Array.isArray(repositoriesData)
        ? repositoriesData
        : [];

      const commitLists = await Promise.all(
        repositories.slice(0, 10).map(async (repo) => {
          try {
            const { data } = await axios.get<Commit[]>(
              `/repos/${repo.owner_id}/${repo.name}/commits/`,
            );
            return Array.isArray(data)
              ? data.map((commit) => ({ commit, repo }))
              : [];
          } catch {
            return [];
          }
        }),
      );

      const commitActivities = commitLists
        .flat()
        .map(({ commit, repo }) =>
          normalizeActivity({
            id: commit.sha,
            type: "push",
            title: commit.message || "Commit pushed",
            message: commit.sha.slice(0, 12),
            repository: {
              id: repo.id,
              name: repo.name,
              owner: repo.owner_email?.split("@")[0],
            },
            actor: {
              name:
                commit.author_name ||
                commit.author_email ||
                repo.owner_email?.split("@")[0] ||
                "User",
              email: commit.author_email,
            },
            created_at: commit.committed_at || commit.created_at,
            url: `/dashboard/repository/${repo.owner_id}/${repo.name}`,
          }),
        );

      const repositoryActivities = repositories.map((repo) =>
        normalizeActivity({
          id: `repo-${repo.id}`,
          type: "repository_created",
          title: "Created repository",
          message: repo.description || repo.default_branch || repo.name,
          repository: {
            id: repo.id,
            name: repo.name,
            owner: repo.owner_email?.split("@")[0],
          },
          actor: {
            name: repo.owner_email?.split("@")[0] || "User",
            email: repo.owner_email,
          },
          created_at: repo.created_at,
          url: `/dashboard/repository/${repo.owner_id}/${repo.name}`,
        }),
      );

      return [...commitActivities, ...repositoryActivities]
        .filter((activity) => activity.created_at)
        .sort(
          (a, b) =>
            new Date(b.created_at).getTime() -
            new Date(a.created_at).getTime(),
        )
        .slice(0, 20);
    },
    staleTime: 30_000,
  });
};
