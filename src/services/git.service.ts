/**
 * "Git-shaped" service — branches, commits, tags for a given repo.
 *
 * Grouped under one service object because UI code almost always pulls these
 * together (a project page wants branches + commits + tags at once).
 */
import { api } from "@/lib/api-client";
import type { Branch, Commit, Tag } from "@/types/api";

const repoBase = (ownerId: number | string, name: string) =>
  `/repos/${ownerId}/${encodeURIComponent(name)}`;

export const gitService = {
  /* ----------- Branches ----------- */
  async branches(ownerId: number | string, name: string): Promise<Branch[]> {
    const { data } = await api.get<Branch[]>(`${repoBase(ownerId, name)}/branches/`);
    return data;
  },

  /* ----------- Commits ----------- */
  async commits(ownerId: number | string, name: string): Promise<Commit[]> {
    const { data } = await api.get<Commit[]>(`${repoBase(ownerId, name)}/commits/`);
    return data;
  },

  async commitDetail(
    ownerId: number | string,
    name: string,
    sha: string,
  ): Promise<Commit> {
    const { data } = await api.get<Commit>(`${repoBase(ownerId, name)}/commits/${sha}/`);
    return data;
  },

  /* ----------- Tags ----------- */
  async tags(ownerId: number | string, name: string): Promise<Tag[]> {
    const { data } = await api.get<Tag[]>(`${repoBase(ownerId, name)}/tags/`);
    return data;
  },
};
