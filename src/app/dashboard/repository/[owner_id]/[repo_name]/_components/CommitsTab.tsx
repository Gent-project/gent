"use client";

import { GitCommit, Copy } from "lucide-react";
import { useState } from "react";
import CommitDetails from "./CommitDetails";
import { Commit } from "@/types/repository";
import { getDashboardTheme } from "@/app/dashboard/_components/dashboard-theme";

interface CommitsTabProps {
  commits: Commit[];
  isLoading: boolean;
  isDark: boolean;
  ownerName: string;
  ownerId: number;
  repoName: string;
}

export default function CommitsTab({
  commits,
  isLoading,
  isDark,
  ownerName,
  repoName,
  ownerId,
}: CommitsTabProps) {
  const [selectedSha, setSelectedSha] = useState<string | null>(null);
  const t = getDashboardTheme(isDark);

  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return `${diffInSeconds} seconds ago`;
    if (diffInSeconds < 3600)
      return `${Math.floor(diffInSeconds / 60)} minutes ago`;
    if (diffInSeconds < 86400)
      return `${Math.floor(diffInSeconds / 3600)} hours ago`;
    if (diffInSeconds < 2592000)
      return `${Math.floor(diffInSeconds / 86400)} days ago`;
    if (diffInSeconds < 31536000)
      return `${Math.floor(diffInSeconds / 2592000)} months ago`;
    return `${Math.floor(diffInSeconds / 31536000)} years ago`;
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-3">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="flex gap-3 p-3 rounded border"
              style={{ borderColor: t.border }}
            >
              <div className="w-8 h-8 bg-gray-300 rounded-full"></div>
              <div className="flex-1">
                <div className="h-4 bg-gray-300 rounded mb-2"></div>
                <div className="h-3 bg-gray-300 rounded w-1/2"></div>
              </div>
              <div className="h-3 bg-gray-300 rounded w-20"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (commits.length === 0) {
    return (
      <div className="text-center py-12 p-6">
        <GitCommit
          className="w-16 h-16 mx-auto mb-4 opacity-40"
          style={{ color: t.textMuted }}
        />
        <h3 className="text-lg font-semibold mb-2" style={{ color: t.text }}>
          No commits yet
        </h3>
        <p className="text-sm" style={{ color: t.textMuted }}>
          This repository doesn't have any commits yet.
        </p>
      </div>
    );
  }
  if (selectedSha) {
    return (
      <CommitDetails
        ownerId={ownerId}
        repoName={repoName}
        sha={selectedSha}
        isDark={isDark}
        onBack={() => setSelectedSha(null)}
      />
    );
  }

  return (
    <div>
      {commits.map((commit, index) => (
        <div
          key={commit.id}
          className={`flex items-start gap-3 p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors ${
            index !== commits.length - 1 ? "border-b" : ""
          }`}
          style={{ borderColor: t.border }}
        >
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-mono"
            style={{ backgroundColor: t.accentMuted, color: t.accent }}
          >
            {commit.author_name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium" style={{ color: t.text }}>
              {commit.message}
            </p>
            <div
              className="flex items-center gap-2 mt-1 text-xs"
              style={{ color: t.textMuted }}
            >
              <span>{commit.author_name}</span>
              <span>committed {formatRelativeTime(commit.committed_at)}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelectedSha(commit.sha)}
              className="px-2 py-1 text-xs rounded font-mono hover:underline"
              style={{
                backgroundColor: t.surface,
                color: t.textSecondary,
              }}
            >
              {commit.sha.substring(0, 7)}
            </button>
            <button
              className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
              style={{ color: t.textMuted }}
              onClick={() => navigator.clipboard.writeText(commit.sha)}
            >
              <Copy className="w-3 h-3" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
