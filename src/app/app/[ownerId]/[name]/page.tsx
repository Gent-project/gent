"use client";

import { use, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  GitBranch,
  GitBranchPlus,
  GitCommit,
  Tag as TagIcon,
  Copy,
  Check,
  Globe,
  Lock,
  Trash2,
  Activity,
  Terminal,
  FolderTree,
} from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CommitTimeline } from "@/components/features/projects/commit-timeline";
import { BranchList } from "@/components/features/projects/branch-list";
import { TagList } from "@/components/features/projects/tag-list";
import { useDeleteRepo, useRepoDetail } from "@/hooks/use-repos";
import { useBranches, useCommits, useTags } from "@/hooks/use-git";
import { PATHS } from "@/lib/paths";
import { cloneCommand } from "@/lib/gent-urls";
import { timeAgo, cn } from "@/lib/utils";
import { InteractiveGuideModal, GuideKind } from "@/components/features/projects/interactive-guide-modal";

/**
 * Project detail page.
 *
 * Route: /app/[ownerId]/[name]
 *
 * Layout:
 *   ┌─ AppShell ──────────────────────────────────┐
 *   │ Hero: repo name, badges, clone URL          │
 *   │ Stats: branches · commits · tags · updated  │
 *   │ Tabs: Commits / Branches / Tags             │
 *   │ Live-sync indicator (pulses while polling)  │
 *   └─────────────────────────────────────────────┘
 *
 * All four queries (repo, commits, branches, tags) poll every 12s via the
 * `use-git` hooks, so a `gent push` from the terminal flows here without
 * the user touching the page.
 */
type Params = Promise<{ ownerId: string; name: string }>;
type Tab = "commits" | "branches" | "tags";

export default function ProjectDetailPage({ params }: { params: Params }) {
  const { ownerId, name } = use(params);
  const router = useRouter();
  const ownerIdNum = Number(ownerId);

  const repoQuery = useRepoDetail(ownerIdNum, name);
  const branches = useBranches(ownerIdNum, name);
  const commits = useCommits(ownerIdNum, name);
  const tags = useTags(ownerIdNum, name);
  const deleteRepo = useDeleteRepo();

  const [tab, setTab] = useState<Tab>("commits");
  const [copied, setCopied] = useState(false);
  const [guide, setGuide] = useState<{ open: boolean; kind: GuideKind; branch?: string }>({
    open: false,
    kind: "clone",
  });

  const syncing =
    branches.isFetching || commits.isFetching || tags.isFetching || repoQuery.isFetching;

  /**
   * Canonical CLI clone command for this project.
   *
   * Format the Gent CLI accepts (see `apps/Cli/src/utils/constants.js`):
   *   /api/repos/{owner_id}/{repo_name}
   *
   * That's why we resolve it through `cloneCommand()` instead of building
   * `https://gent.dev/...` by hand — the CLI would reject that form with
   * "Invalid repository URL".
   */
  const cloneCmd = useMemo(
    () => cloneCommand(ownerIdNum, name),
    [ownerIdNum, name],
  );

  function copy() {
    navigator.clipboard.writeText(cloneCmd).then(() => {
      setCopied(true);
      toast.success("Clone command copied.");
      setTimeout(() => setCopied(false), 1500);
    });
  }

  function destroy() {
    if (!confirm(`Delete project "${name}"? This cannot be undone.`)) return;
    deleteRepo.mutate(
      { ownerId: ownerIdNum, name },
      { onSuccess: () => router.push(PATHS.app.dashboard) },
    );
  }

  if (repoQuery.isLoading) {
    return (
      <AppShell title="Loading…">
        <Skeleton className="h-40 rounded-2xl mb-6" />
        <Skeleton className="h-72 rounded-2xl" />
      </AppShell>
    );
  }
  if (repoQuery.isError || !repoQuery.data) {
    return (
      <AppShell title="Project not found" subtitle="It may have been deleted or you don't have access.">
        <Button asChild>
          <Link href={PATHS.app.dashboard}>Back to dashboard</Link>
        </Button>
      </AppShell>
    );
  }

  const repo = repoQuery.data;

  return (
    <AppShell
      title={
        <span className="inline-flex items-center gap-2">
          {repo.name}
          {syncing && (
            <span
              className="inline-flex items-center gap-1.5 text-xs font-medium text-on-surface-variant"
              title="Syncing with server"
            >
              <span className="size-2 rounded-full bg-primary pulse-dot" />
              live
            </span>
          )}
        </span>
      }
      subtitle={repo.description || "No description yet."}
      actions={
        <>
          <Button asChild variant="outline" size="sm">
            <Link href={PATHS.app.projectFiles(ownerIdNum, name)}>
              <FolderTree className="size-4" /> Files
            </Link>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setGuide({ open: true, kind: "clone" })}
          >
            <Terminal className="size-4" /> Clone
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setGuide({ open: true, kind: "new-branch" })}
          >
            <GitBranchPlus className="size-4" /> New branch
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={destroy}
            disabled={deleteRepo.isPending}
          >
            <Trash2 className="size-4" /> Delete
          </Button>
        </>
      }
    >
      {/* Hero card */}
      <Card variant="raised" className="p-6 mb-6 gradient-mesh">
        <div className="flex flex-wrap items-center gap-3">
          <Badge tone={repo.is_private ? "warning" : "success"}>
            {repo.is_private ? (
              <>
                <Lock className="size-3" /> Private
              </>
            ) : (
              <>
                <Globe className="size-3" /> Public
              </>
            )}
          </Badge>
          <Badge tone="primary">
            <GitBranch className="size-3" />
            {repo.default_branch}
          </Badge>
          <Badge tone="outline">
            <Activity className="size-3" /> Updated {timeAgo(repo.updated_at)}
          </Badge>
        </div>
        <pre className="mt-4 inline-flex max-w-full items-center gap-2 rounded-xl bg-inverse-surface/95 text-on-inverse-surface px-3 py-2 text-xs overflow-x-auto">
          <span>{cloneCmd}</span>
          <button onClick={copy} aria-label="Copy clone URL" className="hover:opacity-80">
            {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          </button>
        </pre>
      </Card>

      {/* Stats strip */}
      <div className="grid gap-4 sm:grid-cols-3 mb-6">
        <Stat
          icon={<GitBranch className="size-4" />}
          label="Branches"
          value={branches.data?.length ?? 0}
        />
        <Stat
          icon={<GitCommit className="size-4" />}
          label="Commits"
          value={commits.data?.length ?? 0}
        />
        <Stat icon={<TagIcon className="size-4" />} label="Tags" value={tags.data?.length ?? 0} />
      </div>

      {/* Tabs */}
      <div className="mb-4 flex items-center gap-1 rounded-full border border-outline-variant bg-surface-container-lowest p-1 w-fit">
        {(["commits", "branches", "tags"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "relative rounded-full px-4 py-1.5 text-sm font-medium capitalize transition-colors",
              tab === t ? "text-on-primary" : "text-on-surface-variant hover:text-foreground",
            )}
          >
            {tab === t && (
              <motion.span
                layoutId="tab-pill"
                className="absolute inset-0 rounded-full bg-primary"
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
              />
            )}
            <span className="relative">{t}</span>
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
        >
          {tab === "commits" && (
            <CommitTimeline commits={commits.data} isLoading={commits.isLoading} />
          )}
          {tab === "branches" && (
            <BranchList
              branches={branches.data}
              defaultBranch={repo.default_branch}
              isLoading={branches.isLoading}
              onCheckout={(branchName) =>
                setGuide({ open: true, kind: "checkout", branch: branchName })
              }
            />
          )}
          {tab === "tags" && <TagList tags={tags.data} isLoading={tags.isLoading} />}
        </motion.div>
      </AnimatePresence>

      <InteractiveGuideModal
        open={guide.open}
        onClose={() => setGuide((g) => ({ ...g, open: false }))}
        kind={guide.kind}
        ownerId={ownerIdNum}
        repoName={repo.name}
        defaultBranch={repo.default_branch}
        targetBranch={guide.branch}
      />
    </AppShell>
  );
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <span className="inline-flex size-9 items-center justify-center rounded-xl bg-primary-container text-on-primary-container">
          {icon}
        </span>
        <div>
          <p className="text-[11px] uppercase tracking-widest text-on-surface-variant">
            {label}
          </p>
          <p className="text-lg font-bold tabular-nums">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
