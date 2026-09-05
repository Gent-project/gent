"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { BookMarked, Clock3, GitBranch, LockKeyhole, Search, UserRound } from "lucide-react";

import SiteShell from "@/app/components/site/SiteShell";
import { RepoSort, useDebouncedValue, useRepositorySearch, useUserSearch } from "@/hooks/use-search";
import { PUBLIC_PATH } from "@/routes/path";
import { getRepoOwner } from "@/lib/user-display";

type SearchType = "repos" | "users";

const SORTS: Array<{ id: RepoSort; label: string }> = [
  { id: "best", label: "Best match" },
  { id: "updated", label: "Recently updated" },
  { id: "newest", label: "Newest" },
  { id: "name", label: "Name" },
];

function relativeTime(value: string): string {
  const elapsed = Math.max(0, Date.now() - new Date(value).getTime());
  const days = Math.floor(elapsed / 86_400_000);
  if (days < 1) return "today";
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months === 1 ? "" : "s"} ago`;
  const years = Math.floor(months / 12);
  return `${years} year${years === 1 ? "" : "s"} ago`;
}

function ExploreContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [type, setType] = useState<SearchType>(
    (searchParams.get("type") as SearchType) ?? "repos",
  );
  const [sort, setSort] = useState<RepoSort>("best");
  const [page, setPage] = useState(1);

  const debounced = useDebouncedValue(query, 300);
  const trimmed = debounced.trim();

  useEffect(() => {
    const params = new URLSearchParams();
    if (trimmed) params.set("q", trimmed);
    if (type === "users") params.set("type", "users");
    const search = params.toString();
    router.replace(search ? `/explore?${search}` : "/explore", { scroll: false });
  }, [trimmed, type, router]);

  useEffect(() => setPage(1), [trimmed, type, sort]);

  // Both run so the filter rail can show a count for each tab, like GitHub.
  const repos = useRepositorySearch(trimmed, { sort, page: type === "repos" ? page : 1 });
  const users = useUserSearch(trimmed, { page: type === "users" ? page : 1 });

  const active = type === "repos" ? repos : users;
  const total = active.data?.count ?? 0;
  const hasNext = Boolean(active.data?.next);

  const tabs = useMemo(
    () => [
      { id: "repos" as SearchType, label: "Repositories", count: repos.data?.count, icon: BookMarked },
      { id: "users" as SearchType, label: "People", count: users.data?.count, icon: UserRound },
    ],
    [repos.data?.count, users.data?.count],
  );

  return (
    <div className="mx-auto max-w-6xl px-4 pb-24 pt-28 sm:px-6">
      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
        <input
          autoFocus
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search repositories, or owner/name…"
          aria-label="Search Gent"
          className="w-full rounded-lg border border-line bg-surface/60 py-3 pl-11 pr-4 text-sm text-fg outline-none transition-colors placeholder:text-faint focus:border-brand/50 focus:bg-surface"
        />
      </div>

      <div className="mt-6 grid gap-8 md:grid-cols-[200px_minmax(0,1fr)]">
        {/* filter rail */}
        <aside className="md:sticky md:top-24 md:self-start">
          <h2 className="px-3 pb-2 text-xs font-semibold uppercase tracking-wide text-faint">
            Filter by
          </h2>
          <nav className="space-y-0.5">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setType(tab.id)}
                aria-current={type === tab.id}
                className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
                  type === tab.id
                    ? "bg-brand/12 font-semibold text-fg"
                    : "text-muted hover:bg-brand/8 hover:text-fg"
                }`}
              >
                <tab.icon className="h-4 w-4 shrink-0" />
                <span className="flex-1 text-left">{tab.label}</span>
                {tab.count !== undefined && (
                  <span className="rounded-full bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] text-muted">
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </aside>

        {/* results */}
        <section className="min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
            <p className="text-sm font-semibold text-fg">
              {active.isLoading
                ? "Searching…"
                : `${total} ${type === "repos" ? "repository" : "user"}${total === 1 ? "" : "s"}`}
            </p>

            {type === "repos" && (
              <select
                value={sort}
                onChange={(event) => setSort(event.target.value as RepoSort)}
                aria-label="Sort results"
                className="rounded-lg border border-line bg-surface/60 px-3 py-1.5 text-xs text-fg outline-none"
              >
                {SORTS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            )}
          </div>

          {active.isError ? (
            <p className="py-12 text-center text-sm text-muted">
              Search is unavailable right now. Try again in a moment.
            </p>
          ) : type === "repos" ? (
            repos.data?.results.length ? (
              <ul className="divide-y divide-line">
                {repos.data.results.map((repo) => {
                  const owner = getRepoOwner(repo);
                  return (
                    <li key={repo.id} className="py-4">
                      <div className="flex items-start gap-2">
                        <Link
                          href={PUBLIC_PATH.REPOSITORY(owner, repo.name)}
                          className="text-base font-semibold text-brand hover:underline"
                          data-no-translate
                        >
                          {owner}/{repo.name}
                        </Link>
                        {repo.is_private && (
                          <span className="mt-1 inline-flex items-center gap-1 rounded-full border border-line px-2 py-0.5 text-[10px] font-medium text-muted">
                            <LockKeyhole className="h-2.5 w-2.5" /> Private
                          </span>
                        )}
                      </div>

                      {repo.description && (
                        <p className="mt-1 line-clamp-2 text-sm text-muted">{repo.description}</p>
                      )}

                      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-faint">
                        <span className="inline-flex items-center gap-1.5" data-no-translate>
                          <GitBranch className="h-3 w-3" />
                          {repo.default_branch}
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <Clock3 className="h-3 w-3" />
                          Updated {relativeTime(repo.updated_at)}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="py-12 text-center text-sm text-muted">
                {trimmed
                  ? `No repositories matched “${trimmed}”.`
                  : "Search for a repository by name, description, or owner."}
              </p>
            )
          ) : users.data?.results.length ? (
            <ul className="divide-y divide-line">
              {users.data.results.map((user) => (
                <li key={user.id} className="py-4">
                  <Link href={PUBLIC_PATH.PROFILE(user.username)} className="flex items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-line text-muted">
                      <UserRound className="h-5 w-5" />
                    </span>
                    <span className="min-w-0">
                      <span
                        className="block text-sm font-semibold text-brand hover:underline"
                        data-no-translate
                      >
                        {user.username}
                      </span>
                      {user.display_name !== user.username && (
                        <span className="block truncate text-sm text-muted" data-no-translate>
                          {user.display_name}
                        </span>
                      )}
                      <span className="block text-xs text-faint">
                        {user.public_repo_count} public{" "}
                        {user.public_repo_count === 1 ? "repository" : "repositories"}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-12 text-center text-sm text-muted">
              {trimmed ? `No users matched “${trimmed}”.` : "Search for people by username or name."}
            </p>
          )}

          {(page > 1 || hasNext) && (
            <div className="mt-6 flex items-center justify-center gap-3">
              <button
                type="button"
                disabled={page === 1}
                onClick={() => setPage((value) => Math.max(1, value - 1))}
                className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-fg transition-colors disabled:opacity-40"
              >
                Previous
              </button>
              <span className="text-xs text-muted">Page {page}</span>
              <button
                type="button"
                disabled={!hasNext}
                onClick={() => setPage((value) => value + 1)}
                className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-fg transition-colors disabled:opacity-40"
              >
                Next
              </button>
            </div>
          )}
        </section>
      </div>
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
