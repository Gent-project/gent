"use client";

import { ArrowLeft, GitCommit, Plus, Minus } from "lucide-react";
import { useCommit, useCommitDiff } from "@/hooks/use-commits";
import { getDashboardTheme } from "@/app/dashboard/_components/dashboard-theme";

interface CommitDetailsProps {
  ownerId: number;
  repoName: string;
  sha: string;
  isDark: boolean;
  onBack: () => void;
}

export default function CommitDetails({
  ownerId,
  repoName,
  sha,
  isDark,
  onBack,
}: CommitDetailsProps) {
  const t = getDashboardTheme(isDark);

  const {
    data: commit,
    isLoading: commitLoading,
    error: commitError,
  } = useCommit(ownerId, repoName, sha);

  const {
    data: diff,
    isLoading: diffLoading,
    error: diffError,
  } = useCommitDiff(ownerId, repoName, sha);

  if (commitLoading || diffLoading) {
    return (
      <div className="p-6">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-sm mb-6 hover:underline"
          style={{ color: t.textMuted }}
        >
          <ArrowLeft className="w-4 h-4" />
          Back to commits
        </button>

        <div className="animate-pulse space-y-4">
          <div
            className="h-6 rounded w-1/3"
            style={{ backgroundColor: t.surface }}
          />
          <div
            className="h-4 rounded w-1/2"
            style={{ backgroundColor: t.surface }}
          />
          <div
            className="h-32 rounded"
            style={{ backgroundColor: t.surface }}
          />
        </div>
      </div>
    );
  }

  if (commitError || !commit) {
    return (
      <div className="p-6">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-sm mb-6 hover:underline"
          style={{ color: t.textMuted }}
        >
          <ArrowLeft className="w-4 h-4" />
          Back to commits
        </button>

        <div className="rounded-lg border p-6 text-center">
          <p style={{ color: t.text }}>Failed to load commit.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Back button */}
      <div className="px-5 py-4 border-b" style={{ borderColor: t.border }}>
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-sm hover:underline"
          style={{ color: t.textMuted }}
        >
          <ArrowLeft className="w-4 h-4" />
          Back to commits
        </button>
      </div>

      {/* Commit header */}
      <div className="px-5 py-5 border-b" style={{ borderColor: t.border }}>
        <div className="flex items-start gap-3">
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
            style={{
              backgroundColor: t.accentMuted,
              color: t.accent,
            }}
          >
            <GitCommit className="w-5 h-5" />
          </div>

          <div className="min-w-0 flex-1">
            <h2
              className="text-lg font-semibold mb-1"
              style={{ color: t.text }}
            >
              {commit.message}
            </h2>

            <p className="text-sm" style={{ color: t.textMuted }}>
              {commit.author_name} committed{" "}
              {new Date(commit.committed_at).toLocaleString()}
            </p>

            <div className="mt-3">
              <code
                className="text-xs font-mono px-2 py-1 rounded"
                style={{
                  backgroundColor: t.surface,
                  color: t.textSecondary,
                }}
              >
                {commit.sha}
              </code>
            </div>
          </div>
        </div>

        {/* Diff summary */}
        {diff && (
          <div className="flex items-center gap-4 mt-4 text-xs">
            <span style={{ color: t.textMuted }}>
              {diff.files?.length ?? 0}{" "}
              {diff.files?.length === 1 ? "file" : "files"} changed
            </span>

            <span className="text-green-600 flex items-center gap-1">
              <Plus className="w-3 h-3" />
              {diff.additions}
            </span>

            <span className="text-red-600 flex items-center gap-1">
              <Minus className="w-3 h-3" />
              {diff.deletions}
            </span>
          </div>
        )}
      </div>

      {/* Diff error */}
      {diffError && (
        <div className="m-5 rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/20 p-4 text-sm text-red-600">
          Failed to load commit diff.
        </div>
      )}

      {/* Files */}
      <div className="p-5 space-y-5">
        {diff?.files?.map((file: any) => (
          <div
            key={file.path}
            className="rounded-lg border overflow-hidden"
            style={{
              borderColor: t.border,
              backgroundColor: t.surface,
            }}
          >
            {/* File header */}
            <div
              className="flex items-center justify-between px-4 py-3 border-b"
              style={{
                borderColor: t.border,
                backgroundColor: t.surface,
              }}
            >
              <div className="flex items-center gap-3 min-w-0">
                <span
                  className="font-mono text-sm font-medium truncate"
                  style={{ color: t.text }}
                >
                  {file.path}
                </span>

                <span
                  className="text-xs px-2 py-0.5 rounded"
                  style={{
                    backgroundColor: t.surface,
                    color: t.textMuted,
                  }}
                >
                  {file.status}
                </span>
              </div>

              <div className="flex items-center gap-3 text-xs shrink-0">
                {file.additions > 0 && (
                  <span className="text-green-600">+{file.additions}</span>
                )}

                {file.deletions > 0 && (
                  <span className="text-red-600">-{file.deletions}</span>
                )}
              </div>
            </div>

            {/* Diff lines */}
            <div className="overflow-x-auto">
              <div className="font-mono text-xs sm:text-sm">
                {file.lines?.map((line: any, index: number) => {
                  const isAdd = line.kind === "add";
                  const isRemove = line.kind === "remove";
                  const isHunk = line.kind === "hunk";

                  if (isHunk) {
                    return (
                      <div
                        key={index}
                        className="px-4 py-2 text-blue-600 dark:text-blue-400 border-b"
                        style={{
                          backgroundColor: isDark
                            ? "rgba(30, 64, 175, 0.15)"
                            : "#eff6ff",
                          borderColor: t.border,
                        }}
                      >
                        {line.text}
                      </div>
                    );
                  }

                  return (
                    <div
                      key={index}
                      className="flex border-b last:border-b-0"
                      style={{
                        borderColor: t.border,
                        backgroundColor: isAdd
                          ? isDark
                            ? "rgba(22, 101, 52, 0.18)"
                            : "#f0fdf4"
                          : isRemove
                            ? isDark
                              ? "rgba(153, 27, 27, 0.18)"
                              : "#fef2f2"
                            : "transparent",
                      }}
                    >
                      {/* Old line */}
                      <div
                        className="w-12 shrink-0 px-2 py-1 text-right select-none border-r"
                        style={{
                          color: t.textMuted,
                          borderColor: t.border,
                        }}
                      >
                        {line.old ?? ""}
                      </div>

                      {/* New line */}
                      <div
                        className="w-12 shrink-0 px-2 py-1 text-right select-none border-r"
                        style={{
                          color: t.textMuted,
                          borderColor: t.border,
                        }}
                      >
                        {line.new ?? ""}
                      </div>

                      {/* Sign */}
                      <div
                        className={`w-7 shrink-0 px-1 py-1 text-center font-bold ${
                          isAdd
                            ? "text-green-600"
                            : isRemove
                              ? "text-red-600"
                              : ""
                        }`}
                      >
                        {isAdd ? "+" : isRemove ? "-" : ""}
                      </div>

                      {/* Text */}
                      <pre
                        className="px-2 py-1 whitespace-pre min-w-0"
                        style={{ color: t.text }}
                      >
                        {line.text}
                      </pre>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ))}

        {!diffLoading && diff && diff.files?.length === 0 && (
          <div
            className="text-center py-10 text-sm"
            style={{ color: t.textMuted }}
          >
            No changes found in this commit.
          </div>
        )}
      </div>
    </div>
  );
}
