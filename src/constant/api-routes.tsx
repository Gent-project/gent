/** Backend API paths — ready for dashboard integration */
const API_ROUTES = {
  AUTH: {
    LOGIN: "auth/login/",
    LOGOUT: "auth/logout/",
    REGISTER: "auth/register/",
    PROFILE: "auth/profile/",
    TOKEN_REFRESH: "auth/token/refresh/",
    REFRESH_TOKEN: "auth/token/refresh/",
    PASSWORD_CHANGE: "auth/password/change/",
    PASSWORD_RESET: "auth/password/reset/",
    PASSWORD_RESET_CONFIRM: "auth/password/reset/confirm/",
  },
  REPOS: {
    LIST: "repos/",
    CREATE: "repos/create/",
    DETAIL: (ownerId: string, repoName: string) =>
      `repos/${ownerId}/${repoName}/`,
    DELETE: (ownerId: string, repoName: string) =>
      `repos/${ownerId}/${repoName}/delete/`,
    BRANCHES: (ownerId: string, repoName: string) =>
      `repos/${ownerId}/${repoName}/branches/`,
    COMMITS: (ownerId: string, repoName: string) =>
      `repos/${ownerId}/${repoName}/commits/`,
    PUSH: (ownerId: string, repoName: string) =>
      `repos/${ownerId}/${repoName}/push/`,
    PULL: (ownerId: string, repoName: string) =>
      `repos/${ownerId}/${repoName}/pull/`,
  },
} as const;

export default API_ROUTES;
