/**
 * Repositories service.
 *
 * Maps the four /repos endpoints to TypeScript and returns plain data.
 * Path-building lives here so consumers never concatenate URLs by hand.
 */
import { api } from "@/lib/api-client";
import type { CreateRepoPayload, Repository } from "@/types/api";

const base = (ownerId: number | string, name: string) =>
  `/repos/${ownerId}/${encodeURIComponent(name)}`;

export const reposService = {
  /** GET /repos/ — every repo the current user can see. */
  async list(): Promise<Repository[]> {
    const { data } = await api.get<Repository[]>("/repos/");
    return data;
  },

  /** POST /repos/create/ — creates a repo and returns it. */
  async create(payload: CreateRepoPayload): Promise<Repository> {
    const { data } = await api.post<{ message: string; repository: Repository }>(
      "/repos/create/",
      payload,
    );
    return data.repository;
  },

  /** GET /repos/{owner}/{name}/ */
  async detail(ownerId: number | string, name: string): Promise<Repository> {
    const { data } = await api.get<Repository>(`${base(ownerId, name)}/`);
    return data;
  },

  /** DELETE /repos/{owner}/{name}/delete/ */
  async remove(ownerId: number | string, name: string): Promise<void> {
    await api.delete(`${base(ownerId, name)}/delete/`);
  },
};
