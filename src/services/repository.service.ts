import axios from "@/lib/axios";
import {
  Repository,
  CreateRepositoryRequest,
  Branch,
  Commit,
  Tag,
  Blob,
} from "@/types/repository";

// Define missing types based on API structure
export interface UpdateRepositoryPayload {
  name?: string;
  description?: string;
  is_private?: boolean;
  default_branch?: string;
}

export interface CreateBranchPayload {
  name: string;
  commit_sha: string;
}

export interface UpdateBranchPayload {
  commit_sha: string;
}

export interface CreateCommitPayload {
  sha?: string;
  message: string;
  tree_sha: string;
  parent_shas?: string[];
  author_name: string;
  author_email: string;
  branch: string;
}

export interface CreateTagPayload {
  name: string;
  commit_sha: string;
  message: string;
  annotated: boolean;
  tagger_name: string;
  tagger_email: string;
}

export interface Tree {
  sha: string;
  entries: TreeEntry[];
}

export interface TreeEntry {
  mode: string;
  name: string;
  path: string;
  hash: string;
  sha: string;
  type: "blob" | "tree";
}

export interface CreateTreePayload {
  entries: Array<{
    mode: string;
    name: string;
    sha: string;
    type: "blob" | "tree";
  }>;
}

export interface PushPayload {
  pack: string;
  branch: string;
}

export class RepositoryService {
  // Repository Management
  static async getRepositories(): Promise<Repository[]> {
    const response = await axios.get("/api/repos/");
    return response.data;
  }

  static async createRepository(
    payload: CreateRepositoryRequest,
  ): Promise<Repository> {
    const response = await axios.post("/api/repos/create/", payload);
    return response.data;
  }

  static async getRepository(
    ownerId: number,
    repoName: string,
  ): Promise<Repository> {
    const response = await axios.get(`/api/repos/${ownerId}/${repoName}/`);
    return response.data;
  }

  static async updateRepository(
    ownerId: number,
    repoName: string,
    payload: UpdateRepositoryPayload,
  ): Promise<Repository> {
    const response = await axios.patch(
      `/api/repos/${ownerId}/${repoName}/`,
      payload,
    );
    return response.data;
  }

  static async deleteRepository(
    ownerId: number,
    repoName: string,
  ): Promise<void> {
    await axios.delete(`/api/repos/${ownerId}/${repoName}/delete/`);
  }

  // Blob Management
  static async getBlob(
    ownerId: number,
    repoName: string,
    sha: string,
  ): Promise<Blob> {
    const response = await axios.get(
      `/api/repos/${ownerId}/${repoName}/blob/${sha}/`,
    );
    return response.data;
  }

  static async createBlob(
    ownerId: number,
    repoName: string,
    payload: Blob,
  ): Promise<{ sha: string }> {
    const response = await axios.post(
      `/api/repos/${ownerId}/${repoName}/blob/create/`,
      payload,
    );
    return response.data;
  }

  // Branch Management
  static async getBranches(
    ownerId: number,
    repoName: string,
  ): Promise<Branch[]> {
    const response = await axios.get(
      `/api/repos/${ownerId}/${repoName}/branches/`,
    );
    return response.data;
  }

  static async getBranch(
    ownerId: number,
    repoName: string,
    branchName: string,
  ): Promise<Branch> {
    const response = await axios.get(
      `/api/repos/${ownerId}/${repoName}/branches/${branchName}/`,
    );
    return response.data;
  }

  static async createBranch(
    ownerId: number,
    repoName: string,
    payload: CreateBranchPayload,
  ): Promise<Branch> {
    const response = await axios.post(
      `/api/repos/${ownerId}/${repoName}/branches/create/`,
      payload,
    );
    return response.data;
  }

  static async updateBranch(
    ownerId: number,
    repoName: string,
    branchName: string,
    payload: UpdateBranchPayload,
  ): Promise<Branch> {
    const response = await axios.patch(
      `/api/repos/${ownerId}/${repoName}/branches/${branchName}/`,
      payload,
    );
    return response.data;
  }

  static async deleteBranch(
    ownerId: number,
    repoName: string,
    branchName: string,
  ): Promise<void> {
    await axios.delete(
      `/api/repos/${ownerId}/${repoName}/branches/${branchName}/`,
    );
  }

  // Commit Management
  static async getCommits(
    ownerId: number,
    repoName: string,
  ): Promise<Commit[]> {
    const response = await axios.get(
      `/api/repos/${ownerId}/${repoName}/commits/`,
    );
    return response.data;
  }

  static async getCommit(
    ownerId: number,
    repoName: string,
    sha: string,
  ): Promise<Commit> {
    const response = await axios.get(
      `/api/repos/${ownerId}/${repoName}/commits/${sha}/`,
    );
    return response.data;
  }

  static async createCommit(
    ownerId: number,
    repoName: string,
    payload: CreateCommitPayload,
  ): Promise<Commit> {
    const response = await axios.post(
      `/api/repos/${ownerId}/${repoName}/commits/create/`,
      payload,
    );
    return response.data;
  }

  // Tag Management
  static async getTags(ownerId: number, repoName: string): Promise<Tag[]> {
    const response = await axios.get(`/api/repos/${ownerId}/${repoName}/tags/`);
    return response.data;
  }

  static async createTag(
    ownerId: number,
    repoName: string,
    payload: CreateTagPayload,
  ): Promise<Tag> {
    const response = await axios.post(
      `/api/repos/${ownerId}/${repoName}/tags/create/`,
      payload,
    );
    return response.data;
  }

  static async deleteTag(
    ownerId: number,
    repoName: string,
    tagName: string,
  ): Promise<void> {
    await axios.delete(`/api/repos/${ownerId}/${repoName}/tags/${tagName}/`);
  }

  // Tree Management
  static async getTree(
    ownerId: number,
    repoName: string,
    sha: string,
  ): Promise<Tree> {
    const response = await axios.get(
      `/api/repos/${ownerId}/${repoName}/tree/${sha}/`,
    );
    return response.data;
  }

  static async createTree(
    ownerId: number,
    repoName: string,
    payload: CreateTreePayload,
  ): Promise<Tree> {
    const response = await axios.post(
      `/api/repos/${ownerId}/${repoName}/tree/create/`,
      payload,
    );
    return response.data;
  }

  // Git Operations
  static async pullRepository(ownerId: number, repoName: string): Promise<any> {
    const response = await axios.get(`/api/repos/${ownerId}/${repoName}/pull/`);
    return response.data;
  }

  static async pushRepository(
    ownerId: number,
    repoName: string,
    payload: PushPayload,
  ): Promise<any> {
    const response = await axios.post(
      `/api/repos/${ownerId}/${repoName}/push/`,
      payload,
    );
    return response.data;
  }
}
