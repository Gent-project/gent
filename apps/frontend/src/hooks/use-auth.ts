"use client";

/**
 * Auth hooks.
 *
 * `useAuth()` exposes the cached current user + helpers (login, register,
 * logout). It bridges Redux (which our existing store already wires up) with
 * TanStack Query for network state.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useDispatch, useSelector } from "react-redux";

import { authService } from "@/services/auth.service";
import { tokenStore, readApiError } from "@/lib/api-client";
import { PATHS } from "@/lib/paths";
import { setAuth, logout as logoutAction } from "@/store/slices/auth-slice";
import type { RootState } from "@/store";
import type { LoginPayload, RegisterPayload, User } from "@/types/api";

const PROFILE_KEY = ["auth", "profile"] as const;

/**
 * Returns the current session: { user, isAuthenticated, helpers }.
 * Reads from cache instantly and revalidates from /auth/profile/ in the background.
 */
export function useAuth() {
  const router = useRouter();
  const dispatch = useDispatch();
  const queryClient = useQueryClient();
  const tokenInStore = useSelector((s: RootState) => s.auth.token);
  const hasToken = Boolean(tokenInStore ?? tokenStore.getAccess());

  const profileQuery = useQuery({
    queryKey: PROFILE_KEY,
    queryFn: authService.profile,
    enabled: hasToken,
    initialData: () => tokenStore.getUser() ?? undefined,
    staleTime: 60_000,
    retry: 1,
  });

  const loginMutation = useMutation({
    mutationFn: (payload: LoginPayload) => authService.login(payload),
    onSuccess: (data) => {
      dispatch(
        setAuth({
          token: data.tokens.access,
          refreshToken: data.tokens.refresh,
          user: {
            id: String(data.user.id),
            email: data.user.email,
            name:
              [data.user.first_name, data.user.last_name].filter(Boolean).join(" ") ||
              data.user.email,
          },
        }),
      );
      queryClient.setQueryData(PROFILE_KEY, data.user);
      toast.success(`Welcome back, ${data.user.first_name || data.user.email}.`);
      router.push(PATHS.app.dashboard);
    },
    onError: (err) => toast.error(readApiError(err)),
  });

  const registerMutation = useMutation({
    mutationFn: (payload: RegisterPayload) => authService.register(payload),
    onSuccess: (data) => {
      if (data.tokens) {
        dispatch(
          setAuth({
            token: data.tokens.access,
            refreshToken: data.tokens.refresh,
            user: {
              id: String(data.user.id),
              email: data.user.email,
              name:
                [data.user.first_name, data.user.last_name].filter(Boolean).join(" ") ||
                data.user.email,
            },
          }),
        );
        queryClient.setQueryData(PROFILE_KEY, data.user);
        toast.success("Account created. Welcome to Gent.");
        router.push(PATHS.app.dashboard);
      } else {
        toast.success("Account created — please sign in.");
        router.push(PATHS.auth.login);
      }
    },
    onError: (err) => toast.error(readApiError(err)),
  });

  const logoutMutation = useMutation({
    mutationFn: () => authService.logout(),
    onSettled: () => {
      dispatch(logoutAction());
      queryClient.clear();
      router.push(PATHS.auth.login);
    },
  });

  const user: User | null = profileQuery.data ?? null;

  return {
    user,
    isAuthenticated: hasToken && !!user,
    isCheckingSession: profileQuery.isLoading,
    login: loginMutation.mutate,
    register: registerMutation.mutate,
    logout: logoutMutation.mutate,
    isLoggingIn: loginMutation.isPending,
    isRegistering: registerMutation.isPending,
  };
}
