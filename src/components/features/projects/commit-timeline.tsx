"use client";

import { motion } from "framer-motion";
import { GitCommit, User2 } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { shortSha, timeAgo } from "@/lib/utils";
import type { Commit } from "@/types/api";

/**
 * CommitTimeline — vertical list of commits with a left-rail connector.
 *
 * Designed to feel "alive": each row fades up sequentially and the connector
 * dot for the freshest commit gets the marching-ants animation if it was
 * authored in the last minute.
 */
export function CommitTimeline({
  commits,
  isLoading,
}: {
  commits: Commit[] | undefined;
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-2xl" />
        ))}
      </div>
    );
  }

  if (!commits || commits.length === 0) {
    return (
      <Card variant="outline">
        <EmptyState
          icon={<GitCommit />}
          title="No commits yet."
          description="Push from your CLI and they'll show up here in real time."
        />
      </Card>
    );
  }

  return (
    <ol className="relative space-y-3 before:absolute before:left-[19px] before:top-3 before:bottom-3 before:w-px before:bg-outline-variant">
      {commits.map((c, i) => {
        const fresh = Date.now() - new Date(c.committed_at).getTime() < 60_000;
        return (
          <motion.li
            key={c.id}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.04, duration: 0.3 }}
            className="relative pl-12"
          >
            <span
              className={`absolute left-2 top-3 inline-flex h-9 w-9 items-center justify-center rounded-full border-2 border-surface-container-lowest bg-primary text-on-primary ${
                fresh ? "pulse-dot" : ""
              }`}
            >
              <GitCommit className="size-4" />
            </span>
            <Card className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-foreground truncate">{c.message}</p>
                  <div className="mt-1 flex items-center gap-3 text-xs text-on-surface-variant">
                    <span className="inline-flex items-center gap-1">
                      <Avatar
                        seed={c.author_email || c.author_name || c.sha}
                        name={c.author_name || c.author_email}
                        size={18}
                      />
                      {c.author_name || c.author_email || "unknown"}
                    </span>
                    <span>{timeAgo(c.committed_at)}</span>
                  </div>
                </div>
                <code className="rounded-md bg-surface-container px-2 py-1 text-xs font-mono">
                  {shortSha(c.sha)}
                </code>
              </div>
            </Card>
          </motion.li>
        );
      })}
    </ol>
  );
}
