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

export const PUBLIC_PATH = {
  EXPLORE: "/explore",
  SEARCH: (query: string, type: "repos" | "users" = "repos") =>
    `/explore?q=${encodeURIComponent(query)}${type === "users" ? "&type=users" : ""}`,
  PROFILE: (username: string) => `/${encodeURIComponent(username)}`,
  REPOSITORY: (username: string, repoName: string) =>
    `/${encodeURIComponent(username)}/${encodeURIComponent(repoName)}`,
} as const;
