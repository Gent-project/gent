import { useQuery } from "@tanstack/react-query";

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
  id: String(activity.id ?? `${Date.now()}-${Math.random()}`),
  type: String(activity.type ?? "commit"),
  title: String(activity.title ?? "Activity"),
  message: String(activity.message ?? ""),
  repository: activity.repository,
  actor: activity.actor,
  created_at: String(
    activity.created_at ?? activity.createdAt ?? new Date().toISOString(),
  ),
  url: typeof activity.url === "string" ? activity.url : undefined,
});

export const useActivities = () => {
  return useQuery<Activity[]>({
    queryKey: ["activities"],
    queryFn: async () => {
      const response = await fetch("/api/activities", { cache: "no-store" });

      if (!response.ok) {
        throw new Error("Failed to load activities");
      }

      const data = await response.json();
      const activities = Array.isArray(data) ? data : (data.activities ?? []);

      return activities.map(normalizeActivity);
    },
    staleTime: 30_000,
  });
};
