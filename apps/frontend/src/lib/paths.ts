/**
 * Centralized client-side route paths.
 *
 * Everything that renders an `<Link>` or calls `router.push()` should pull from
 * here so renames stay in one place. Functions handle the parameterized routes
 * so we never concatenate strings inline at call sites.
 */
export const PATHS = {
  /** Public marketing pages */
  home: "/",
  cli: "/cli",
  privacy: "/privacy",
  terms: "/terms",
  faq: "/faq",

  /** Auth flow */
  auth: {
    login: "/auth/login",
    signup: "/auth/signup",
  },

  /** Authenticated app — everything under /app/* requires a token */
  app: {
    root: "/app",
    dashboard: "/app",
    newProject: "/app/new",
    settings: "/app/settings",
    project: (ownerId: number | string, name: string) =>
      `/app/${ownerId}/${name}`,
    projectFiles: (ownerId: number | string, name: string) =>
      `/app/${ownerId}/${name}/files`,
    projectCli: (ownerId: number | string, name: string) =>
      `/app/${ownerId}/${name}/cli`,
  },
} as const;
