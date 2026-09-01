export const AUTH_PATH = {
  LOGIN: "/auth/login",
  SIGNIN: "/auth/signup",
} as const;

export const DASHBOARD_PATH = {
  ROOT: "/dashboard",
  SETTINGS: "/dashboard/settings",
  REPOSITORY: (ownerId: number, repoName: string) => `/dashboard/repository/${ownerId}/${repoName}`,
  REPOSITORY_SETTINGS: (ownerId: number, repoName: string) => `/dashboard/repository/${ownerId}/${repoName}/settings`,
} as const;
