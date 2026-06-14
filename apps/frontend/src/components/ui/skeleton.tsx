import * as React from "react";
import { cn } from "@/lib/utils";

/** Skeleton — animated placeholder bar used while data is loading. */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-md bg-surface-container",
        className,
      )}
      {...props}
    />
  );
}
