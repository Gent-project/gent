"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useSelector } from "react-redux";
import { FolderGit2, Search, UserRound, Users } from "lucide-react";

import SiteShell from "@/app/components/site/SiteShell";
import RepositoryCard from "@/app/dashboard/_components/RepositoryCard";
import { getDashboardTheme } from "@/app/dashboard/_components/dashboard-theme";
import {
  RepoSort,
  useDebouncedValue,
  useRepositorySearch,
  useUserSearch,
} from "@/hooks/use-search";
import { PUBLIC_PATH } from "@/routes/path";
import { RootState } from "@/store";
import { getRepoOwner } from "@/lib/user-display";

type SearchType = "repos" | "users";

const SORTS: Array<{ id: RepoSort; label: string }> = [
  { id: "best", label: "Best match" },
  { id: "updated", label: "Recently updated" },
  { id: "newest", label: "Newest" },
  { id: "name", label: "Name" },
];

function ExploreContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isDark = useSelector((state: RootState) => state.theme.isDark);
  const t = getDashboardTheme(isDark);

  const initialQuery = searchParams.get("q") ?? "";
  const initialType = (searchParams.get("type") as SearchType) ?? "repos";

  const [query, setQuery] = useState(initialQuery);
  const [type, setType] = useState<SearchType>(initialType);
  const [sort, setSort] = useState<RepoSort>("best");
  const [page, setPage] = useState(1);

  const debouncedQuery = useDebouncedValue(query);

  // Keep the URL shareable without pushing a history entry per keystroke.
  useEffect(() => {
    const params = new URLSearchParams();
    if (debouncedQuery.trim()) params.set("q", debouncedQuery.trim());
    if (type === "users") params.set("type", "users");
    const search = params.toString();
    router.replace(search ? `/explore?${search}` : "/explore", { scroll: false });
  }, [debouncedQuery, type, router]);

  useEffect(() => setPage(1), [debouncedQuery, type, sort]);

  const repoResults = useRepositorySearch(debouncedQuery, { sort, page });
  const userResults = useUserSearch(debouncedQuery, { page });

  const active = type === "repos" ? repoResults : userResults;
  const count = active.data?.count ?? 0;
  const hasNext = Boolean(active.data?.next);

  return (
    <div className="mx-auto max-w-5xl px-4 pb-24 pt-28 sm:px-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight" style={{ color: t.text }}>
          Explore Gent
        </h1>
        <p className="mt-2 text-sm" style={{ color: t.textMuted }}>
          Search public repositories and the people who build them. No account needed.
        </p>
      </header>

      <div className="relative mt-6">
        <Search
          className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2"
          style={{ color: t.textMuted }}
        />
        <input
          autoFocus
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={
            type === "repos"
              ? "Search repositories, or owner/name…"
              : "Search people by username or name…"
          }
          className="w-full rounded-xl border py-3 pl-11 pr-4 text-sm outline-none transition-all focus:ring-2"
          style={{ background: t.inputBg, borderColor: t.border, color: t.text }}
          aria-label="Search Gent"
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {(["repos", "users"] as SearchType[]).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setType(option)}
            className="inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors"
            style={{
              borderColor: t.border,
              background: type === option ? t.accentMuted : t.inputBg,
              color: type === option ? t.accent : t.textMuted,
            }}
          >
            {option === "repos" ? (
              <FolderGit2 className="h-3.5 w-3.5" />
            ) : (
              <Users className="h-3.5 w-3.5" />
            )}
            {option === "repos" ? "Repositories" : "People"}
          </button>
        ))}

        {type === "repos" && (
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value as RepoSort)}
            className="ml-auto rounded-lg border px-3 py-1.5 text-xs outline-none"
            style={{ background: t.inputBg, borderColor: t.border, color: t.text }}
            aria-label="Sort repositories"
          >
            {SORTS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        )}
      </div>

      <p className="mt-5 text-xs" style={{ color: t.textMuted }}>
        {active.isLoading
          ? "Searching…"
          : `${count} ${type === "repos" ? "repository" : "person"}${count === 1 ? "" : type === "repos" ? " results" : "s"}`}
      </p>

      <div
        className="mt-3 overflow-hidden rounded-2xl border"
        style={{ background: t.elevated, borderColor: t.border }}
      >
        {active.isError ? (
          <p className="p-8 text-center text-sm" style={{ color: t.textMuted }}>
            Search is unavailable right now. Try again in a moment.
          </p>
        ) : type === "repos" ? (
          repoResults.data?.results.length ? (
            repoResults.data.results.map((repo, index) => (
              <RepositoryCard
                key={repo.id}
                repo={repo}
                isDark={isDark}
                index={index}
                href={PUBLIC_PATH.REPOSITORY(getRepoOwner(repo), repo.name)}
              />
            ))
          ) : (
            <p className="p-8 text-center text-sm" style={{ color: t.textMuted }}>
              {debouncedQuery.trim()
                ? `No public repositories match “${debouncedQuery.trim()}”.`
                : "No public repositories yet."}
            </p>
          )
        ) : userResults.data?.results.length ? (
          userResults.data.results.map((user) => (
            <Link
              key={user.id}
              href={PUBLIC_PATH.PROFILE(user.username)}
              className="flex items-center gap-3 border-b px-5 py-4 transition-colors last:border-b-0"
              style={{ borderColor: t.borderMuted }}
            >
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border"
                style={{ borderColor: t.border, background: t.accentMuted, color: t.accent }}
              >
                <UserRound className="h-4 w-4" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold" style={{ color: t.text }}>
                  {user.username}
                </span>
                <span className="block text-xs" style={{ color: t.textMuted }}>
                  {user.display_name !== user.username && `${user.display_name} · `}
                  {user.public_repo_count} public{" "}
                  {user.public_repo_count === 1 ? "repository" : "repositories"}
                </span>
              </span>
            </Link>
          ))
        ) : (
          <p className="p-8 text-center text-sm" style={{ color: t.textMuted }}>
            {debouncedQuery.trim()
              ? `No people match “${debouncedQuery.trim()}”.`
              : "Type a name to find people."}
          </p>
        )}
      </div>

      {(page > 1 || hasNext) && (
        <div className="mt-5 flex items-center justify-center gap-3">
          <button
            type="button"
            disabled={page === 1}
            onClick={() => setPage((value) => Math.max(1, value - 1))}
            className="rounded-lg border px-3 py-1.5 text-xs font-medium disabled:opacity-40"
            style={{ borderColor: t.border, color: t.text, background: t.inputBg }}
          >
            Previous
          </button>
          <span className="text-xs" style={{ color: t.textMuted }}>
            Page {page}
          </span>
          <button
            type="button"
            disabled={!hasNext}
            onClick={() => setPage((value) => value + 1)}
            className="rounded-lg border px-3 py-1.5 text-xs font-medium disabled:opacity-40"
            style={{ borderColor: t.border, color: t.text, background: t.inputBg }}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

export default function ExplorePage() {
  return (
    <SiteShell>
      <Suspense fallback={null}>
        <ExploreContent />
      </Suspense>
    </SiteShell>
  );
}
