import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import axios from "@/lib/axios";
import API_ROUTES from "@/constant/api-routes";
import {
  Paginated,
  PublicProfile,
  PublicUser,
  Repository,
} from "@/types/repository";

export type RepoSort = "best" | "updated" | "newest" | "name";

/** Debounce a fast-changing value so typing doesn't fire a request per keystroke. */
export function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}

export const useRepositorySearch = (
  query: string,
  { sort = "best", page = 1 }: { sort?: RepoSort; page?: number } = {},
) => {
  const trimmed = query.trim();

  return useQuery<Paginated<Repository>>({
    queryKey: ["search", "repos", trimmed, sort, page],
    queryFn: async () => {
      const response = await axios.get(API_ROUTES.SEARCH.REPOS, {
        params: { q: trimmed, sort, page },
      });
      return response.data;
    },
    placeholderData: (previous) => previous,
  });
};

export const useUserSearch = (query: string, { page = 1 } = {}) => {
  const trimmed = query.trim();

  return useQuery<Paginated<PublicUser>>({
    queryKey: ["search", "users", trimmed, page],
    queryFn: async () => {
      const response = await axios.get(API_ROUTES.SEARCH.USERS, {
        params: { q: trimmed, page },
      });
      return response.data;
    },
    enabled: trimmed.length > 0,
    placeholderData: (previous) => previous,
  });
};

export const usePublicProfile = (username: string) => {
  return useQuery<PublicProfile>({
    queryKey: ["profile", username],
    queryFn: async () => {
      const response = await axios.get(API_ROUTES.USERS.DETAIL(username));
      return response.data;
    },
    enabled: !!username,
    retry: false,
  });
};
