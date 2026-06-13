"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  ChevronRight,
  Folder,
  GitBranch,
  GitCommit,
  Home,
  Terminal,
} from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar } from "@/components/ui/avatar";
import { FileTreeRow } from "@/components/features/projects/file-tree-row";
import { FileViewer } from "@/components/features/projects/file-viewer";
import {
  InteractiveGuideModal,
  type GuideKind,
} from "@/components/features/projects/interactive-guide-modal";

import { useRepoDetail } from "@/hooks/use-repos";
import {
  useBranches,
  useBranchCommit,
  useTree,
  useBlob,
  isEmptySha,
} from "@/hooks/use-git";
import { PATHS } from "@/lib/paths";
import { cn, shortSha, timeAgo } from "@/lib/utils";
import type { TreeEntry } from "@/types/api";

/**
 * Files page (`/app/[ownerId]/[name]/files`).
 *
 * Modelled on GitHub / GitLab repo browsers:
 *
 *   ┌────────────────────────────────────────────────────────┐
 *   │  Branch picker · breadcrumbs (root / sub / sub)        │
 *   ├──────────────┬─────────────────────────────────────────┤
 *   │ tree (left)  │   selected file (or directory) (right)  │
 *   │              │   - commit / sha / time block at top    │
 *   │  README.md   │   - viewer with line numbers, copy, dl  │
 *   │  src/        │                                         │
 *   │  package.json│                                         │
 *   └──────────────┴─────────────────────────────────────────┘
 *
 * Navigation:
 *   - Click a folder → push it onto the `pathStack` and load its tree.
 *   - Click a breadcrumb → pop the stack back to that depth.
 *   - Click a file → fetch the blob and render in the right pane.
 *
 * Empty cases handled:
 *   - Brand-new branch with a zero-sha (no commits yet) → empty state with
 *     a "Push your first commit" guide trigger.
 */
type Params = Promise<{ ownerId: string; name: string }>;

export default function ProjectFilesPage({ params }: { params: Params }) {
  const { ownerId, name } = use(params);
  const ownerIdNum = Number(ownerId);

  const repoQuery = useRepoDetail(ownerIdNum, name);
  const branchesQuery = useBranches(ownerIdNum, name);

  const branches = branchesQuery.data ?? [];
  const defaultBranch = repoQuery.data?.default_branch ?? "main";
  const [activeBranch, setActiveBranch] = useState<string>("");

  // When branches load, default the picker to the repo's default branch
  // (or whatever the first branch is).
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

  /**
   * `pathStack` is a list of { name, treeSha } from root to current folder.
   * The last element's treeSha is the one we render. Selecting a folder pushes
   * a new entry; clicking a breadcrumb truncates the stack.
   */
  const [pathStack, setPathStack] = useState<{ name: string; treeSha: string }[]>([]);
  // Reset to root any time the branch changes.
  useEffect(() => {
    setPathStack([]);
    setSelectedFile(null);
  }, [activeBranch, rootTreeSha]);

  const currentTreeSha = pathStack.length ? pathStack[pathStack.length - 1].treeSha : rootTreeSha;
  const treeQuery = useTree(ownerIdNum, name, currentTreeSha);

  // Selected file (right pane)
  const [selectedFile, setSelectedFile] = useState<TreeEntry | null>(null);
  const blobQuery = useBlob(
    ownerIdNum,
    name,
    selectedFile?.type === "blob" ? selectedFile.sha : undefined,
  );

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
  const breadcrumbs = ["root", ...pathStack.map((p) => p.name)];

  /* ----------- Handlers ----------- */

  function openFolder(entry: TreeEntry) {
    if (entry.type !== "tree") return;
    setSelectedFile(null);
    setPathStack((s) => [...s, { name: entry.name, treeSha: entry.sha }]);
  }
  function navigateTo(depth: number) {
    setSelectedFile(null);
    setPathStack((s) => s.slice(0, depth));
  }
  function openFile(entry: TreeEntry) {
    if (entry.type !== "blob") return;
    setSelectedFile(entry);
  }

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
              {breadcrumbs.map((b, i) => (
                <li key={i} className="flex items-center gap-1">
                  {i > 0 && <ChevronRight className="size-3.5 shrink-0" />}
                  <button
                    type="button"
                    onClick={() => navigateTo(i)}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-md px-2 py-0.5 hover:bg-surface-container-low",
                      i === breadcrumbs.length - 1 && "text-foreground font-medium",
                    )}
                  >
                    {i === 0 && <Home className="size-3.5" />}
                    {b}
                  </button>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </Card>

      {/* HEAD commit summary */}
      {headCommit && (
        <Card variant="raised" className="mb-5 p-4">
          <div className="flex items-start gap-3">
            <span className="inline-flex size-10 items-center justify-center rounded-xl bg-primary-container text-on-primary-container">
              <GitCommit className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold truncate">{headCommit.message}</p>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-on-surface-variant">
                <span className="inline-flex items-center gap-1">
                  <Avatar
                    seed={headCommit.author_email || headCommit.author_name || headCommit.sha}
                    name={headCommit.author_name || headCommit.author_email}
                    size={16}
                  />
                  {headCommit.author_name || headCommit.author_email || "unknown"}
                </span>
                <span>{timeAgo(headCommit.committed_at)}</span>
                <code className="rounded-md bg-surface-container px-1.5 py-0.5 font-mono">
                  {shortSha(headCommit.sha)}
                </code>
                {headCommit.parent_shas?.length > 0 && (
                  <span>
                    parents{" "}
                    {headCommit.parent_shas
                      .map((p) => shortSha(p))
                      .join(", ")}
                  </span>
                )}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Empty-branch state */}
      {isEmptySha(branchCommitQuery.data?.branch?.commit_sha) ? (
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
      ) : (
        <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
          {/* Left: tree */}
          <Card className="p-3 h-fit lg:sticky lg:top-32">
            {treeQuery.isLoading ? (
              <div className="space-y-2 p-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-9 rounded-lg" />
                ))}
              </div>
            ) : treeQuery.isError ? (
              <p className="p-3 text-sm text-error">Couldn't load this tree.</p>
            ) : (treeQuery.data?.entries.length ?? 0) === 0 ? (
              <p className="p-3 text-sm text-on-surface-variant">This folder is empty.</p>
            ) : (
              <motion.div
                initial="hidden"
                animate="show"
                variants={{ show: { transition: { staggerChildren: 0.015 } } }}
                className="space-y-0.5"
              >
                {sortEntries(treeQuery.data!.entries).map((entry, i) => (
                  <FileTreeRow
                    key={`${entry.sha}-${entry.name}`}
                    entry={entry}
                    active={selectedFile?.sha === entry.sha}
                    onOpen={(e) => (e.type === "tree" ? openFolder(e) : openFile(e))}
                    index={i}
                  />
                ))}
              </motion.div>
            )}
          </Card>

          {/* Right: file viewer */}
          <div className="min-w-0">
            {selectedFile ? (
              <FileViewer
                fileName={[...pathStack.map((p) => p.name), selectedFile.name].join("/")}
                blob={blobQuery.data}
                isLoading={blobQuery.isLoading}
                error={blobQuery.error}
              />
            ) : (
              <Card variant="outline">
                <EmptyState
                  icon={<Folder />}
                  title="Pick a file."
                  description="Choose any file in the tree on the left to view its contents here."
                />
              </Card>
            )}
          </div>
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
    </AppShell>
  );
}

/** Folders before files; alphabetical inside each group (Git-style display). */
function sortEntries(entries: TreeEntry[]): TreeEntry[] {
  return [...entries].sort((a, b) => {
    if (a.type !== b.type) return a.type === "tree" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}
