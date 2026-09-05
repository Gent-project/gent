export interface Repository {
  id: number;
  owner_id: number;
  owner_email: string;
  name: string;
  description: string;
  is_private: boolean;
  default_branch: string;
  object_format?: "legacy" | "sha256";
  created_at: string;
  updated_at: string;
}

export interface CreateRepositoryRequest {
  name: string;
  description: string;
  is_private: boolean;
  default_branch: string;
  object_format?: "legacy" | "sha256";
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
  parent_shas: string[];
  author_timestamp?: number;
  author_timezone?: string;
  committer_name?: string;
  committer_email?: string;
  committer_timestamp?: number;
  committer_timezone?: string;
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
  target_oid?: string;
  target_type?: "commit" | "tree" | "blob" | "tag";
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