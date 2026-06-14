"use client";

import { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  FileWarning,
  GitCommit,
  Minus,
  Plus,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { cn, shortSha, timeAgo } from "@/lib/utils";
import type { ChangeStatus, CommitDiffResult, FileDiff } from "@/lib/diff";

/**
 * CommitDiffPanel — renders "what changed in this commit".
 *
 * Header: the commit (author, message, sha, time) plus a +/− roll-up.
 * Body: one collapsible block per changed file with a unified line diff.
 *
 * The data is assembled client-side by `useCommitDiff`; this component is
 * purely presentational so it can live inside a modal, a drawer, or a page.
 */
export function CommitDiffPanel({
  diff,
  isLoading,
  error,
}: {
  diff: CommitDiffResult | undefined;
  isLoading: boolean;
  error?: unknown;
}) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-16 rounded-xl" />
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
    );
  }

  if (error || !diff) {
    return (
      <EmptyState
        icon={<FileWarning />}
        title="Couldn't load this commit."
        description="The diff couldn't be computed. The commit may be unreachable or your session expired."
      />
    );
  }

  const { commit, parentSha, files, additions, deletions } = diff;

  return (
    <div className="flex flex-col gap-4">
      {/* Commit header */}
      <div className="rounded-xl border border-outline-variant bg-surface-container-low p-4 pr-12">
        <div className="flex items-start gap-3">
          <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary-container text-on-primary-container">
            <GitCommit className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold leading-snug break-words">{commit.message}</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-on-surface-variant">
              <span className="inline-flex items-center gap-1.5">
                <Avatar
                  seed={commit.author_email || commit.author_name || commit.sha}
                  name={commit.author_name || commit.author_email}
                  size={16}
                />
                {commit.author_name || commit.author_email || "unknown"}
              </span>
              <span>{timeAgo(commit.committed_at)}</span>
              <code className="rounded-md bg-surface-container px-1.5 py-0.5 font-mono">
                {shortSha(commit.sha)}
              </code>
              {parentSha && (
                <span>
                  parent <code className="font-mono">{shortSha(parentSha)}</code>
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <Badge tone="outline" size="sm">
            {files.length} {files.length === 1 ? "file" : "files"} changed
          </Badge>
          <span className="inline-flex items-center gap-0.5 font-mono font-semibold text-[#3f7a52] dark:text-[#8fd6a8]">
            <Plus className="size-3" />
            {additions}
          </span>
          <span className="inline-flex items-center gap-0.5 font-mono font-semibold text-on-error-container">
            <Minus className="size-3" />
            {deletions}
          </span>
        </div>
      </div>

      {/* Files */}
      {files.length === 0 ? (
        <EmptyState
          icon={<GitCommit />}
          title="No file changes."
          description="This commit doesn't alter any files compared to its parent."
        />
      ) : (
        <div className="space-y-3">
          {files.map((file) => (
            <FileDiffBlock key={`${file.status}:${file.path}`} file={file} />
          ))}
        </div>
      )}
    </div>
  );
}

const STATUS_TONE: Record<ChangeStatus, "success" | "error" | "warning"> = {
  added: "success",
  removed: "error",
  modified: "warning",
};

function FileDiffBlock({ file }: { file: FileDiff }) {
  const [open, setOpen] = useState(true);

  return (
    <div className="overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 border-b border-outline-variant bg-surface-container-low px-3 py-2 text-left"
      >
        {open ? (
          <ChevronDown className="size-4 shrink-0 text-on-surface-variant" />
        ) : (
          <ChevronRight className="size-4 shrink-0 text-on-surface-variant" />
        )}
        <Badge tone={STATUS_TONE[file.status]} size="sm" className="shrink-0 capitalize">
          {file.status}
        </Badge>
        <span className="min-w-0 flex-1 truncate font-mono text-xs sm:text-sm">
          {file.path}
        </span>
        {!file.binary && (file.additions > 0 || file.deletions > 0) && (
          <span className="hidden shrink-0 items-center gap-2 font-mono text-xs sm:inline-flex">
            <span className="text-[#3f7a52] dark:text-[#8fd6a8]">+{file.additions}</span>
            <span className="text-on-error-container">−{file.deletions}</span>
          </span>
        )}
      </button>

      {open && (
        <div>
          {file.binary ? (
            <p className="px-4 py-5 text-sm text-on-surface-variant">
              Binary file — not shown.
            </p>
          ) : file.tooLarge ? (
            <p className="px-4 py-5 text-sm text-on-surface-variant">
              This file is too large to render an inline diff.
            </p>
          ) : file.lines.length === 0 ? (
            <p className="px-4 py-5 text-sm text-on-surface-variant">
              No textual changes.
            </p>
          ) : (
            <DiffLineTable file={file} />
          )}
        </div>
      )}
    </div>
  );
}

function DiffLineTable({ file }: { file: FileDiff }) {
  return (
    <pre className="overflow-x-auto scrollbar-thin font-mono text-xs leading-relaxed">
      <table className="w-full border-collapse">
        <tbody>
          {file.lines.map((line, i) => {
            if (line.kind === "hunk") {
              return (
                <tr key={i} className="bg-surface-container text-on-surface-variant">
                  <td colSpan={3} className="px-3 py-0.5 select-none">
                    {line.text}
                  </td>
                </tr>
              );
            }
            const add = line.kind === "add";
            const del = line.kind === "del";
            return (
              <tr
                key={i}
                className={cn(
                  add && "bg-light-green/70",
                  del && "bg-error-container/70",
                )}
              >
                <td className="w-[1%] select-none whitespace-nowrap border-r border-outline-variant/50 px-2 text-right align-top text-on-surface-variant/60 tabular-nums">
                  {line.oldNumber ?? ""}
                </td>
                <td className="w-[1%] select-none whitespace-nowrap border-r border-outline-variant/50 px-2 text-right align-top text-on-surface-variant/60 tabular-nums">
                  {line.newNumber ?? ""}
                </td>
                <td className="px-3 align-top whitespace-pre-wrap break-words">
                  <span
                    className={cn(
                      "mr-1 select-none",
                      add && "text-[#3f7a52] dark:text-[#8fd6a8]",
                      del && "text-on-error-container",
                    )}
                  >
                    {add ? "+" : del ? "−" : " "}
                  </span>
                  {line.text || " "}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </pre>
  );
}
