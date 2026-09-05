"use client";

import { Modal } from "@/components/ui/modal";
import { CommitDiffPanel } from "@/components/features/projects/commit-diff";
import { useCommitDiff } from "@/hooks/use-git";
import { shortSha } from "@/lib/utils";

/**
 * CommitDiffModal — wide modal that loads a commit's diff on demand.
 *
 * The query only runs while the modal is open (we pass `undefined` as the sha
 * when closed), so opening it is what triggers the tree/blob fetches.
 */
export function CommitDiffModal({
  open,
  onClose,
  ownerId,
  name,
  sha,
}: {
  open: boolean;
  onClose: () => void;
  ownerId: number | string;
  name: string;
  sha: string | null;
}) {
  const diffQuery = useCommitDiff(ownerId, name, open && sha ? sha : undefined);

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title={
        <span className="inline-flex items-center gap-2">
          Changes
          {sha && (
            <code className="rounded-md bg-surface-container px-1.5 py-0.5 text-xs font-mono font-normal text-on-surface-variant">
              {shortSha(sha)}
            </code>
          )}
        </span>
      }
      description="Files added, removed, or modified in this commit."
    >
      <div className="max-h-[72vh] overflow-y-auto scrollbar-thin pr-1">
        <CommitDiffPanel
          diff={diffQuery.data}
          isLoading={diffQuery.isLoading}
          error={diffQuery.error}
        />
      </div>
    </Modal>
  );
}
