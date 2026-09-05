"use client";

import { notFound, useParams } from "next/navigation";
import Link from "next/link";
import { useSelector } from "react-redux";
import { CalendarDays, FolderGit2, UserRound } from "lucide-react";

import SiteShell from "@/app/components/site/SiteShell";
import RepositoryCard from "@/app/dashboard/_components/RepositoryCard";
import { getDashboardTheme } from "@/app/dashboard/_components/dashboard-theme";
import { usePublicProfile } from "@/hooks/use-search";
import { isReservedSlug } from "@/routes/reserved";
import { PUBLIC_PATH } from "@/routes/path";
import { RootState } from "@/store";

export default function PublicProfilePage() {
  const params = useParams();
  const username = params.username as string;
  const isDark = useSelector((state: RootState) => state.theme.isDark);
  const t = getDashboardTheme(isDark);

  // Static routes win in Next.js; this stops a typo'd URL becoming a lookup.
  if (isReservedSlug(username)) notFound();

  const { data, isLoading, isError } = usePublicProfile(username);

  return (
    <SiteShell>
      <div className="mx-auto max-w-5xl px-4 pb-24 pt-28 sm:px-6">
        {isLoading ? (
          <div className="animate-pulse space-y-5">
            <div className="h-24 rounded-2xl border" style={{ background: t.elevated, borderColor: t.border }} />
            <div className="h-72 rounded-2xl border" style={{ background: t.elevated, borderColor: t.border }} />
          </div>
        ) : isError || !data ? (
          <div
            className="rounded-2xl border p-10 text-center"
            style={{ background: t.elevated, borderColor: t.border }}
          >
            <h1 className="text-xl font-semibold" style={{ color: t.text }}>
              User not found
            </h1>
            <p className="mt-2 text-sm" style={{ color: t.textMuted }}>
              There is no Gent user called “{username}”.
            </p>
            <Link
              href={PUBLIC_PATH.EXPLORE}
              className="mt-5 inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold"
              style={{ background: t.accent, color: t.successText }}
            >
              Explore repositories
            </Link>
          </div>
        ) : (
          <>
            <header
              className="flex flex-wrap items-center gap-4 rounded-2xl border p-6"
              style={{ background: t.elevated, borderColor: t.border }}
            >
              <span
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border"
                style={{ borderColor: t.border, background: t.accentMuted, color: t.accent }}
              >
                <UserRound className="h-6 w-6" />
              </span>
              <div className="min-w-0">
                <h1 className="text-2xl font-bold tracking-tight" style={{ color: t.text }} data-no-translate>
                  {data.user.display_name}
                </h1>
                <p className="font-mono text-sm" style={{ color: t.textMuted }} data-no-translate>
                  @{data.user.username}
                </p>
                <div
                  className="mt-2 flex flex-wrap gap-x-5 gap-y-1 font-mono text-[10px]"
                  style={{ color: t.textMuted }}
                >
                  <span className="inline-flex items-center gap-1.5">
                    <FolderGit2 className="h-3 w-3" />
                    {data.user.public_repo_count} public{" "}
                    {data.user.public_repo_count === 1 ? "repository" : "repositories"}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarDays className="h-3 w-3" />
                    joined {new Date(data.user.date_joined).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "short",
                    })}
                  </span>
                </div>
              </div>
            </header>

            <div
              className="mt-5 overflow-hidden rounded-2xl border"
              style={{ background: t.elevated, borderColor: t.border }}
            >
              {data.repositories.length ? (
                data.repositories.map((repo, index) => (
                  <RepositoryCard
                    key={repo.id}
                    repo={repo}
                    isDark={isDark}
                    index={index}
                    href={PUBLIC_PATH.REPOSITORY(data.user.username, repo.name)}
                  />
                ))
              ) : (
                <p className="p-10 text-center text-sm" style={{ color: t.textMuted }}>
                  No public repositories yet.
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </SiteShell>
  );
}
