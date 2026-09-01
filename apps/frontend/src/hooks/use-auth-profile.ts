import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useDispatch } from "react-redux";
import { useRouter } from "next/navigation";
import axios from "@/lib/axios";
import API_ROUTES from "@/constant/api-routes";
import { logout, setUser } from "@/store/slices/auth-slice";
import { AUTH_PATH } from "@/routes/path";
import { getStoredToken } from "@/lib/auth-session";
import type { UpdateProfilePayload, UserProfile } from "@/types/user";

export const PROFILE_QUERY_KEY = ["auth", "profile"] as const;

function normalizeProfile(data: Record<string, unknown>): UserProfile {
  const raw =
    typeof data.user === "object" && data.user !== null
      ? (data.user as Record<string, unknown>)
      : typeof data.profile === "object" && data.profile !== null
        ? (data.profile as Record<string, unknown>)
        : data;

  return {
    id: raw.id as UserProfile["id"],
    email: (raw.email as string) ?? undefined,
    username: (raw.username as string) ?? undefined,
    first_name: (raw.first_name as string) ?? undefined,
    last_name: (raw.last_name as string) ?? undefined,
    name: (raw.name as string) ?? undefined,
  };
}

function hasAuthToken(): boolean {
  return !!getStoredToken();
}

export function useProfile(enabled = true) {
  const dispatch = useDispatch();

  return useQuery({
    queryKey: PROFILE_QUERY_KEY,
    queryFn: async () => {
      const { data } = await axios.get(API_ROUTES.AUTH.PROFILE);
      const profile = normalizeProfile(
        typeof data === "object" && data !== null ? data : {}
      );
      dispatch(setUser(profile));
      return profile;
    },
    enabled: enabled && hasAuthToken(),
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
}

export function useUpdateProfile() {
  const dispatch = useDispatch();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: UpdateProfilePayload) => {
      const { data } = await axios.patch<UserProfile>(
        API_ROUTES.AUTH.PROFILE,
        payload
      );
      return normalizeProfile(
        typeof data === "object" && data !== null
          ? (data as Record<string, unknown>)
          : {}
      );
    },
    onSuccess: (profile) => {
      dispatch(setUser(profile));
      queryClient.setQueryData(PROFILE_QUERY_KEY, profile);
    },
  });
}

export function useLogout() {
  const dispatch = useDispatch();
  const router = useRouter();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      try {
        await axios.post(API_ROUTES.AUTH.LOGOUT);
      } catch {
        // Clear local session even if the server request fails
      }
    },
    onSettled: () => {
      dispatch(logout());
      queryClient.removeQueries({ queryKey: PROFILE_QUERY_KEY });
      router.push(AUTH_PATH.LOGIN);
    },
  });
}
