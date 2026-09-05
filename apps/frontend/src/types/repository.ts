export interface Repository {
  id: number;
  owner_id: number;
  /** Absent on public discovery responses, which never expose emails. */
  owner_email?: string;
  owner_username: string;
  owner_name?: string;
  /** 'owner' | 'write' | 'read', or null for anonymous callers. */
  role?: "owner" | "write" | "read" | null;
  name: string;
  description: string;
  is_private: boolean;
  default_branch: string;
  created_at: string;
  updated_at: string;
}

export interface CreateRepositoryRequest {
  name: string;
  description: string;
  is_private: boolean;
  default_branch: string;
}

export interface Branch {
  id: number;
  repository_name: string;
  name: string;
  commit_sha: string;
  created_at: string;
  updated_at: string;
}

export interface Commit {
  id: number;
  repository_name: string;
  sha: string;
  author_email_user: string;
  author_name: string;
  author_email: string;
  message: string;
  tree_sha: string;
  parent_shas: string;
  committed_at: string;
  created_at: string;
}

export interface Tag {
  id: number;
  repository: number;
  repository_name: string;
  name: string;
  commit_sha: string;
  message: string;
  annotated: boolean;
  tagger_name: string;
  tagger_email: string;
  created_at: string;
}

export interface Blob {
  id: number;
  sha: string;
  size: number;
  content: string;
  encoding: string;
  created_at: string;
}
export interface PublicUser {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
  display_name: string;
  date_joined: string;
  public_repo_count: number;
}

export interface PublicProfile {
  user: PublicUser;
  repositories: Repository[];
}

export interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}
