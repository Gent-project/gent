"use client";

import { motion } from "framer-motion";
import { File as FileIcon, Folder } from "lucide-react";
import { cn, shortSha } from "@/lib/utils";
import type { TreeEntry } from "@/types/api";

/**
 * A single row inside the file browser — either a tree (folder) or a blob
 * (file). Clicking either fires `onOpen` with the entry; the parent component
 * decides whether to navigate into the folder or render the file.
 */
export function FileTreeRow({
  entry,
  active,
  onOpen,
  index = 0,
}: {
  entry: TreeEntry;
  active?: boolean;
  onOpen: (entry: TreeEntry) => void;
  index?: number;
}) {
  return (
    <motion.button
      type="button"
      onClick={() => onOpen(entry)}
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.015, duration: 0.18 }}
      className={cn(
        "group w-full flex items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors",
        active
          ? "bg-primary-container text-on-primary-container"
          : "text-foreground hover:bg-surface-container-low",
      )}
    >
      <span
        className={cn(
          "inline-flex size-7 items-center justify-center rounded-md shrink-0",
          entry.type === "tree"
            ? "bg-tertiary-fixed text-on-tertiary-container"
            : "bg-surface-container text-on-surface-variant",
        )}
      >
        {entry.type === "tree" ? (
          <Folder className="size-3.5" />
        ) : (
          <FileIcon className="size-3.5" />
        )}
      </span>
      <span className="flex-1 truncate text-sm font-medium">{entry.name}</span>
      <code className="hidden sm:inline rounded-md bg-surface-container/70 px-1.5 py-0.5 text-[10.5px] font-mono text-on-surface-variant">
        {shortSha(entry.sha, 7)}
      </code>
    </motion.button>
  );
}
