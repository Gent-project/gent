"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowUpRight, Clock3, FolderGit2, GitBranch, Globe2, LockKeyhole } from "lucide-react";
import { getDashboardTheme } from "./dashboard-theme";
import { Repository } from "@/types/repository";
import { DASHBOARD_PATH } from "@/routes/path";
import { getRepoOwner } from "@/lib/user-display";

interface RepositoryCardProps {
  repo: Repository;
  isDark: boolean;
  index: number;
  highlighted?: boolean;
  /** Overrides the dashboard link, e.g. for the public /explore route. */
  href?: string;
}

function getRelativeTime(dateString: string): string {
  const elapsed = Math.max(0, Date.now() - new Date(dateString).getTime());
  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

export default function RepositoryCard({ repo, isDark, index, highlighted = false, href }: RepositoryCardProps) {
  const t = getDashboardTheme(isDark);
  const owner = getRepoOwner(repo);
  const target = href ?? DASHBOARD_PATH.REPOSITORY(repo.owner_id, repo.name);

  return (
    <motion.article
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, delay: Math.min(index, 8) * 0.035 }}
      className="group relative border-b px-4 py-4 transition-colors last:border-b-0 sm:px-5"
      style={{ borderColor: t.borderMuted, background: highlighted ? t.accentMuted : "transparent" }}
    >
      <div className="flex items-start gap-3.5">
        <span
          className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border"
          style={{ color: t.accent, borderColor: t.border, background: t.accentMuted }}
        >
          <FolderGit2 className="h-4 w-4" />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={target}
              className="inline-flex min-w-0 items-center gap-1.5 text-[15px] font-semibold hover:underline"
              style={{ color: t.text }}
            >
              <span className="truncate" data-no-translate><span style={{ color: t.textMuted }}>{owner}/</span>{repo.name}</span>
              <ArrowUpRight className="h-3.5 w-3.5 shrink-0 opacity-0 transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:opacity-100" />
            </Link>
            <span
              className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold"
              style={{ borderColor: t.border, color: t.textMuted }}
            >
              {repo.is_private ? <><LockKeyhole className="h-2.5 w-2.5" /> Private</> : <><Globe2 className="h-2.5 w-2.5" /> Public</>}
            </span>
          </div>

          <p className="mt-1.5 line-clamp-1 text-sm" style={{ color: t.textMuted }}>
            <span data-no-translate={Boolean(repo.description) || undefined}>{repo.description || "No description provided."}</span>
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[10px]" style={{ color: t.textMuted }}>
            <span className="inline-flex items-center gap-1.5" data-no-translate><GitBranch className="h-3 w-3" />{repo.default_branch}</span>
            <span className="inline-flex items-center gap-1.5"><Clock3 className="h-3 w-3" />updated {getRelativeTime(repo.updated_at)}</span>
            <span className="hidden sm:inline">repo:{repo.id}</span>
          </div>
        </div>

        <Link
          href={target}
          aria-label={`Open ${repo.name}`}
          className="mt-1 hidden h-8 w-8 shrink-0 items-center justify-center rounded-lg border opacity-0 transition-all group-hover:opacity-100 sm:flex"
          style={{ borderColor: t.border, color: t.textMuted }}
        >
          <ArrowUpRight className="h-4 w-4" />
        </Link>
      </div>
    </motion.article>
  );
}
