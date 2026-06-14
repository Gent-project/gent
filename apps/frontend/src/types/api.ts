/**
 * Typed contracts for the Gent REST API at https://gent-api.onrender.com/api/.
 *
 * These types are derived from the OpenAPI schema and verified against live
 * responses during development. Keep this file as the single source of truth —
 * services and hooks only import from here.
 */

/* ---------- Authentication ---------- */

export interface User {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  date_joined: string;
  is_active: boolean;
}

export interface AuthTokens {
  access: string;
  refresh: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface LoginResponse {
  message: string;
  user: User;
  tokens: AuthTokens;
}

export interface RegisterPayload {
  email: string;
  password: string;
  password_confirm: string;
  first_name?: string;
  last_name?: string;
}

export interface RegisterResponse {
  message?: string;
  user: User;
  tokens?: AuthTokens;
}

/* ---------- Repositories ---------- */

export interface Repository {
  id: number;
  owner_id: number;
  owner_email: string;
  name: string;
  description: string;
  is_private: boolean;
  default_branch: string;
  created_at: string;
  updated_at: string;
}

export interface CreateRepoPayload {
  name: string;
  description?: string;
  is_private?: boolean;
  default_branch?: string;
}

/* ---------- Branches ---------- */

export interface Branch {
  id: number;
  repository_name: string;
  name: string;
  commit_sha: string;
  created_at: string;
  updated_at: string;
}

/* ---------- Commits ---------- */

export interface Commit {
  id: number;
  sha: string;
  message: string;
  author_name: string;
  author_email: string;
  tree_sha: string;
  parent_shas: string[];
  committed_at: string;
}

/* ---------- Tags ---------- */

export interface Tag {
  id: number;
  name: string;
  commit_sha: string;
  message: string;
  annotated: boolean;
  created_at: string;
}

/* ---------- Tree / Blob ---------- */

export type TreeEntryType = "blob" | "tree";

export interface TreeEntry {
  type: TreeEntryType;
  mode: string;
  name: string;
  sha: string;
}

export interface Tree {
  id: number;
  sha: string;
  entries: TreeEntry[];
  created_at: string;
}

export interface Blob {
  id: number;
  sha: string;
  size: number;
  content: string;
  /** "utf-8" → text · "base64" → binary, must be decoded before display */
  encoding: "utf-8" | "base64";
  created_at: string;
}

/* ---------- Error envelope ---------- */

export interface ApiErrorBody {
  error?: string;
  detail?: string;
  message?: string;
  [field: string]: unknown;
}
