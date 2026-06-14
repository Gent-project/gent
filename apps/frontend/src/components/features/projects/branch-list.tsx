"use client";

import { GitBranch, Terminal } from "lucide-react";
import { motion } from "framer-motion";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { shortSha, timeAgo } from "@/lib/utils";
import type { Branch } from "@/types/api";

/**
 * BranchList — compact list of branches with their head sha.
 *
 * The default branch is highlighted with a primary-tinted badge. If
 * `onCheckout` is provided, each row gets a small "Checkout" button that
 * opens the interactive walkthrough modal.
 */
export function BranchList({
  branches,
  defaultBranch,
  isLoading,
  onCheckout,
}: {
  branches: Branch[] | undefined;
  defaultBranch?: string;
  isLoading: boolean;
  onCheckout?: (branchName: string) => void;
}) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-14 rounded-xl" />
        ))}
      </div>
    );
  }

  if (!branches || branches.length === 0) {
    return (
      <Card variant="outline">
        <EmptyState
          icon={<GitBranch />}
          title="No branches yet."
          description="Once you push a branch from the CLI it will appear here."
        />
      </Card>
    );
  }

  return (
    <ul className="space-y-2">
      {branches.map((b, i) => {
        const isDefault = b.name === defaultBranch;
        return (
          <motion.li
            key={b.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
          >
            <Card className="p-3.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <span className="inline-flex size-9 items-center justify-center rounded-full bg-secondary-container text-on-secondary">
                  <GitBranch className="size-4" />
                </span>
                <div className="min-w-0">
                  <p className="font-medium truncate">{b.name}</p>
                  <p className="text-xs text-on-surface-variant truncate">
                    Updated {timeAgo(b.updated_at)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {isDefault && <Badge tone="primary" size="sm">default</Badge>}
                <code className="rounded-md bg-surface-container px-2 py-1 text-xs font-mono">
                  {shortSha(b.commit_sha)}
                </code>
                {onCheckout && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onCheckout(b.name)}
                    title="Show how to checkout this branch from the CLI"
                  >
                    <Terminal className="size-3.5" />
                    Checkout
                  </Button>
                )}
              </div>
            </Card>
          </motion.li>
        );
      })}
    </ul>
  );
}
