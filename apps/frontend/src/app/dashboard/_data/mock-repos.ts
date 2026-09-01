export type MockRepository = {
  id: string;
  name: string;
  owner: string;
  description: string;
  isPrivate: boolean;
  stars: number;
  forks: number;
  language: string;
  languageColor: string;
  updatedAt: string;
  defaultBranch: string;
};

export const MOCK_USER = {
  username: "dev-user",
  displayName: "Alex Developer",
  email: "alex@gent.dev",
  avatarInitials: "AD",
};

export const MOCK_REPOSITORIES: MockRepository[] = [
  {
    id: "1",
    name: "gent-platform",
    owner: "dev-user",
    description:
      "Lightweight version control platform with Git-like workflows and a modern web UI.",
    isPrivate: false,
    stars: 128,
    forks: 34,
    language: "TypeScript",
    languageColor: "#3178c6",
    updatedAt: "2 hours ago",
    defaultBranch: "main",
  },
  {
    id: "2",
    name: "api-core",
    owner: "dev-user",
    description:
      "REST API for repository management, commits, branches, and authentication.",
    isPrivate: true,
    stars: 12,
    forks: 4,
    language: "Python",
    languageColor: "#3572A5",
    updatedAt: "Yesterday",
    defaultBranch: "develop",
  },
  {
    id: "3",
    name: "cli-tools",
    owner: "dev-user",
    description: "Command-line utilities for push, pull, and local repo operations.",
    isPrivate: false,
    stars: 56,
    forks: 11,
    language: "Go",
    languageColor: "#00ADD8",
    updatedAt: "3 days ago",
    defaultBranch: "main",
  },
  {
    id: "4",
    name: "docs-site",
    owner: "dev-user",
    description: "Documentation and onboarding guides for Gent contributors.",
    isPrivate: false,
    stars: 8,
    forks: 2,
    language: "MDX",
    languageColor: "#f9ac00",
    updatedAt: "1 week ago",
    defaultBranch: "main",
  },
  {
    id: "5",
    name: "design-system",
    owner: "dev-user",
    description: "Shared UI tokens, components, and accessibility patterns.",
    isPrivate: true,
    stars: 24,
    forks: 6,
    language: "CSS",
    languageColor: "#563d7c",
    updatedAt: "2 weeks ago",
    defaultBranch: "main",
  },
];
