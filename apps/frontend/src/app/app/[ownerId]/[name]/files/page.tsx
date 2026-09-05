"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ChevronRight,
  File as FileIcon,
  Folder,
  GitBranch,
  GitCommit,
  Home,
  Terminal,
} from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar } from "@/components/ui/avatar";
import { FileViewer } from "@/components/features/projects/file-viewer";
import { CommitDiffModal } from "@/components/features/projects/commit-diff-modal";
import {
  InteractiveGuideModal,
  type GuideKind,
} from "@/components/features/projects/interactive-guide-modal";

import { useRepoDetail } from "@/hooks/use-repos";
import {
  useBranches,
  useBranchCommit,
  useCommits,
  useDirLastCommits,
  useTree,
  useBlob,
  isEmptySha,
} from "@/hooks/use-git";
import { PATHS } from "@/lib/paths";
import { cn, shortSha, timeAgo } from "@/lib/utils";
import type { Commit, TreeEntry } from "@/types/api";

/**
 * Files page (`/app/[ownerId]/[name]/files`).
 *
 * A GitHub-style repository browser:
 *
 *   ┌──────────────────────────────────────────────────────────┐
 *   │  Branch picker · breadcrumbs (root / sub / sub)          │
 *   ├──────────────────────────────────────────────────────────┤
 *   │  ◑ author · latest commit message       sha · 5d  N cmts │  ← header bar
 *   ├──────────────────────────────────────────────────────────┤
 *   │  📁 src/          add hooks and services       2 days ago │
 *   │  📄 README.md     Update README                5 days ago │  ← per-file
 *   │  📄 package.json  Initial commit               8 mo ago   │     last commit
 *   └──────────────────────────────────────────────────────────┘
 *
 * Interactions:
 *   - Click a folder  → descend into it.
 *   - Click a file    → open a full-width viewer (breadcrumbs walk back).
 *   - Click a commit  → open the diff modal ("what changed").
 *
 * The per-file "last commit" columns have no backend endpoint, so they're
 * computed in the browser by `useDirLastCommits` (walks the branch history)
 * and fall back to the entry sha if a file isn't attributed in time.
 */
type Params = Promise<{ ownerId: string; name: string }>;

export default function ProjectFilesPage({ params }: { params: Params }) {
  const { ownerId, name } = use(params);
  const ownerIdNum = Number(ownerId);

  const repoQuery = useRepoDetail(ownerIdNum, name);
  const branchesQuery = useBranches(ownerIdNum, name);
  const commitsQuery = useCommits(ownerIdNum, name);

  const branches = branchesQuery.data ?? [];
  const defaultBranch = repoQuery.data?.default_branch ?? "main";
  const [activeBranch, setActiveBranch] = useState<string>("");

  // When branches load, default the picker to the repo's default branch.
  useEffect(() => {
    if (!activeBranch && branches.length > 0) {
      const initial =
        branches.find((b) => b.name === defaultBranch)?.name ?? branches[0].name;
      setActiveBranch(initial);
    }
  }, [branches, defaultBranch, activeBranch]);

  const branchCommitQuery = useBranchCommit(ownerIdNum, name, activeBranch);
  const headCommit = branchCommitQuery.data?.commit ?? null;
  const rootTreeSha = headCommit?.tree_sha;

  /** Root → current folder, each entry being a { name, treeSha }. */
  const [pathStack, setPathStack] = useState<{ name: string; treeSha: string }[]>([]);
  const [selectedFile, setSelectedFile] = useState<TreeEntry | null>(null);

  // Reset to root any time the branch (or its HEAD) changes.
  useEffect(() => {
    setPathStack([]);
    setSelectedFile(null);
  }, [activeBranch, rootTreeSha]);

  const currentTreeSha = pathStack.length
    ? pathStack[pathStack.length - 1].treeSha
    : rootTreeSha;
  const treeQuery = useTree(ownerIdNum, name, currentTreeSha);

  const sortedEntries = useMemo(
    () => (treeQuery.data ? sortEntries(treeQuery.data.entries) : []),
    [treeQuery.data],
  );

  // Per-file "last commit" for the current directory (the GitHub columns).
  const lastCommits = useDirLastCommits(
    ownerIdNum,
    name,
    headCommit?.sha,
    pathStack.map((p) => p.name),
    sortedEntries,
    commitsQuery.data,
  );

  // Selected file (full-width viewer)
  const blobQuery = useBlob(
    ownerIdNum,
    name,
    selectedFile?.type === "blob" ? selectedFile.sha : undefined,
  );

  // Commit diff modal
  const [diffSha, setDiffSha] = useState<string | null>(null);

  // Guide modal
  const [guide, setGuide] = useState<{ open: boolean; kind: GuideKind }>({
    open: false,
    kind: "clone",
  });

  /* ----------- Loading + error guards ----------- */

  if (repoQuery.isLoading) {
    return (
      <AppShell title="Loading…">
        <Skeleton className="h-12 rounded-xl mb-4" />
        <Skeleton className="h-80 rounded-2xl" />
      </AppShell>
    );
  }
  if (repoQuery.isError || !repoQuery.data) {
    return (
      <AppShell title="Project not found">
        <Button asChild>
          <Link href={PATHS.app.dashboard}>Back to dashboard</Link>
        </Button>
      </AppShell>
    );
  }

  const repo = repoQuery.data;
  const commitCount = commitsQuery.data?.length ?? 0;

  // Breadcrumbs: root / …folders / [file]
  const folderCrumbs = ["root", ...pathStack.map((p) => p.name)];
  const crumbs = selectedFile
    ? [...folderCrumbs, selectedFile.name]
    : folderCrumbs;
  const fileCrumbIndex = selectedFile ? crumbs.length - 1 : -1;

  /* ----------- Handlers ----------- */

  function openEntry(entry: TreeEntry) {
    if (entry.type === "tree") {
      setSelectedFile(null);
      setPathStack((s) => [...s, { name: entry.name, treeSha: entry.sha }]);
    } else {
      setSelectedFile(entry);
    }
  }
  function navigateTo(depth: number) {
    // depth indexes into `folderCrumbs`; the optional file crumb is a no-op.
    if (depth > folderCrumbs.length - 1) return;
    setSelectedFile(null);
    setPathStack((s) => s.slice(0, depth));
  }

  const isEmptyBranch = isEmptySha(branchCommitQuery.data?.branch?.commit_sha);

  return (
    <AppShell
      title={
        <span className="inline-flex items-center gap-2">
          <Folder className="size-5 text-primary" />
          {repo.name}
          <span className="text-on-surface-variant font-normal">/ files</span>
        </span>
      }
      subtitle="Browse the working tree on every branch."
      actions={
        <>
          <Button asChild variant="outline" size="sm">
            <Link href={PATHS.app.project(ownerIdNum, name)}>
              <ArrowLeft className="size-4" /> Project
            </Link>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setGuide({ open: true, kind: "clone" })}
          >
            <Terminal className="size-4" /> Clone
          </Button>
        </>
      }
    >
      {/* Toolbar: branch picker + breadcrumbs */}
      <Card className="mb-5 p-4">
        <div className="flex flex-col lg:flex-row lg:items-center gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <Badge tone="primary" size="sm">
              <GitBranch className="size-3" /> branch
            </Badge>
            <select
              value={activeBranch}
              onChange={(e) => setActiveBranch(e.target.value)}
              className="rounded-xl border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm outline-none focus:border-primary"
            >
              {branches.length === 0 && <option value="">—</option>}
              {branches.map((b) => (
                <option key={b.id} value={b.name}>
                  {b.name}
                  {b.name === defaultBranch ? "  (default)" : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="flex-1 min-w-0 overflow-x-auto scrollbar-thin">
            <ol className="flex items-center gap-1 text-sm text-on-surface-variant">
              {crumbs.map((b, i) => (
                <li key={i} className="flex items-center gap-1">
                  {i > 0 && <ChevronRight className="size-3.5 shrink-0" />}
                  <button
                    type="button"
                    onClick={() => navigateTo(i)}
                    disabled={i === fileCrumbIndex}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-md px-2 py-0.5",
                      i === fileCrumbIndex
                        ? "text-foreground font-medium cursor-default"
                        : "hover:bg-surface-container-low",
                      i === crumbs.length - 1 && "text-foreground font-medium",
                    )}
                  >
                    {i === 0 && <Home className="size-3.5" />}
                    {i === fileCrumbIndex && <FileIcon className="size-3.5" />}
                    {b}
                  </button>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </Card>

      {isEmptyBranch ? (
        <Card variant="outline">
          <EmptyState
            icon={<Folder />}
            title={`The "${activeBranch}" branch is empty.`}
            description="No commits yet. Once you push from the CLI, files will appear here."
            action={
              <Button onClick={() => setGuide({ open: true, kind: "clone" })}>
                <Terminal className="size-4" /> Show me how to push
              </Button>
            }
          />
        </Card>
      ) : selectedFile ? (
        /* ---------- Full-width file viewer ---------- */
        <div className="min-w-0 space-y-3">
          <button
            type="button"
            onClick={() => setSelectedFile(null)}
            className="inline-flex items-center gap-1.5 text-sm text-on-surface-variant hover:text-foreground"
          >
            <ArrowLeft className="size-4" /> All files
          </button>
          <FileViewer
            fileName={[...pathStack.map((p) => p.name), selectedFile.name].join("/")}
            blob={blobQuery.data}
            isLoading={blobQuery.isLoading}
            error={blobQuery.error}
          />
        </div>
      ) : (
        /* ---------- GitHub-style file table ---------- */
        <div className="overflow-hidden rounded-2xl border border-outline-variant bg-surface-container-lowest">
          {/* Latest commit bar */}
          {headCommit && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-outline-variant bg-surface-container-low px-4 py-3">
              <Avatar
                seed={headCommit.author_email || headCommit.author_name || headCommit.sha}
                name={headCommit.author_name || headCommit.author_email}
                size={22}
              />
              <span className="text-sm font-medium">
                {headCommit.author_name || headCommit.author_email || "unknown"}
              </span>
              <button
                type="button"
                onClick={() => setDiffSha(headCommit.sha)}
                title="View changes in this commit"
                className="min-w-0 flex-1 truncate text-left text-sm text-on-surface-variant hover:text-foreground hover:underline"
              >
                {headCommit.message}
              </button>
              <div className="ml-auto flex items-center gap-3 text-xs text-on-surface-variant">
                <button
                  type="button"
                  onClick={() => setDiffSha(headCommit.sha)}
                  className="rounded-md bg-surface-container px-1.5 py-0.5 font-mono hover:text-foreground"
                >
                  {shortSha(headCommit.sha)}
                </button>
                <span className="whitespace-nowrap">{timeAgo(headCommit.committed_at)}</span>
                <Link
                  href={PATHS.app.project(ownerIdNum, name)}
                  className="inline-flex items-center gap-1 rounded-full border border-outline-variant px-2 py-0.5 hover:bg-surface-container"
                >
                  <GitCommit className="size-3" />
                  {commitCount} {commitCount === 1 ? "commit" : "commits"}
                </Link>
              </div>
            </div>
          )}

          {/* Rows */}
          {treeQuery.isLoading ? (
            <div className="space-y-px p-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-10 rounded-lg" />
              ))}
            </div>
          ) : treeQuery.isError ? (
            <p className="p-4 text-sm text-error">Couldn&apos;t load this tree.</p>
          ) : sortedEntries.length === 0 ? (
            <p className="p-4 text-sm text-on-surface-variant">This folder is empty.</p>
          ) : (
            <ul>
              {sortedEntries.map((entry) => (
                <FileRow
                  key={`${entry.sha}-${entry.name}`}
                  entry={entry}
                  lastCommit={lastCommits.data?.[entry.name] ?? null}
                  loadingCommit={lastCommits.isLoading}
                  onOpen={() => openEntry(entry)}
                  onOpenCommit={(sha) => setDiffSha(sha)}
                />
              ))}
            </ul>
          )}
        </div>
      )}

      <InteractiveGuideModal
        open={guide.open}
        onClose={() => setGuide((g) => ({ ...g, open: false }))}
        kind={guide.kind}
        ownerId={ownerIdNum}
        repoName={repo.name}
        defaultBranch={defaultBranch}
      />

      <CommitDiffModal
        open={!!diffSha}
        onClose={() => setDiffSha(null)}
        ownerId={ownerIdNum}
        name={name}
        sha={diffSha}
      />
    </AppShell>
  );
}

/**
 * One row of the file table: name · last-commit message · relative time.
 * The name opens the file/folder; the message opens that commit's diff.
 */
function FileRow({
  entry,
  lastCommit,
  loadingCommit,
  onOpen,
  onOpenCommit,
}: {
  entry: TreeEntry;
  lastCommit: Commit | null;
  loadingCommit: boolean;
  onOpen: () => void;
  onOpenCommit: (sha: string) => void;
}) {
  const isFolder = entry.type === "tree";
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-outline-variant px-4 py-2.5 last:border-0 hover:bg-surface-container-low sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_auto]">
      <button
        type="button"
        onClick={onOpen}
        className="flex min-w-0 items-center gap-2.5 text-left"
      >
        <span
          className={cn(
            "inline-flex size-7 shrink-0 items-center justify-center rounded-md",
            isFolder
              ? "bg-tertiary-fixed text-on-tertiary-container"
              : "bg-surface-container text-on-surface-variant",
          )}
        >
          {isFolder ? <Folder className="size-3.5" /> : <FileIcon className="size-3.5" />}
        </span>
        <span className="truncate text-sm font-medium hover:text-primary hover:underline">
          {entry.name}
        </span>
      </button>

      {/* Last commit message (hidden on narrow screens) */}
      <div className="hidden min-w-0 sm:block">
        {lastCommit ? (
          <button
            type="button"
            onClick={() => onOpenCommit(lastCommit.sha)}
            title={lastCommit.message}
            className="block w-full truncate text-left text-sm text-on-surface-variant hover:text-foreground hover:underline"
          >
            {lastCommit.message}
          </button>
        ) : loadingCommit ? (
          <Skeleton className="h-4 w-40 rounded" />
        ) : (
          <code className="text-xs text-on-surface-variant/70">{shortSha(entry.sha)}</code>
        )}
      </div>

      {/* Relative time */}
      <div className="whitespace-nowrap text-right text-xs text-on-surface-variant">
        {lastCommit ? (
          timeAgo(lastCommit.committed_at)
        ) : loadingCommit ? (
          <Skeleton className="ml-auto h-4 w-16 rounded" />
        ) : (
          "—"
        )}
      </div>
    </li>
  );
}

/** Folders before files; alphabetical inside each group (git-style display). */
function sortEntries(entries: TreeEntry[]): TreeEntry[] {
  return [...entries].sort((a, b) => {
    if (a.type !== b.type) return a.type === "tree" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}
