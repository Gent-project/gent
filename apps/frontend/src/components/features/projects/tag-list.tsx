"use client";

import { Tag as TagIcon } from "lucide-react";
import { motion } from "framer-motion";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { shortSha, timeAgo } from "@/lib/utils";
import type { Tag } from "@/types/api";

/** TagList — compact tags list with sha + annotated flag. */
export function TagList({
  tags,
  isLoading,
}: {
  tags: Tag[] | undefined;
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-12 rounded-xl" />
        ))}
      </div>
    );
  }
  if (!tags || tags.length === 0) {
    return (
      <Card variant="outline">
        <EmptyState
          icon={<TagIcon />}
          title="No tags yet."
          description="Mark releases with `gent tag v1.0.0` and they'll appear here."
        />
      </Card>
    );
  }
  return (
    <ul className="space-y-2">
      {tags.map((t, i) => (
        <motion.li
          key={t.id}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.04 }}
        >
          <Card className="p-3.5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <span className="inline-flex size-9 items-center justify-center rounded-full bg-tertiary-fixed text-on-tertiary-container">
                <TagIcon className="size-4" />
              </span>
              <div className="min-w-0">
                <p className="font-medium truncate">{t.name}</p>
                <p className="text-xs text-on-surface-variant truncate">
                  Tagged {timeAgo(t.created_at)} · {t.message || "no message"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {t.annotated && <Badge tone="tertiary" size="sm">annotated</Badge>}
              <code className="rounded-md bg-surface-container px-2 py-1 text-xs font-mono">
                {shortSha(t.commit_sha)}
              </code>
            </div>
          </Card>
        </motion.li>
      ))}
    </ul>
  );
}
