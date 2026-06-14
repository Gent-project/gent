import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * EmptyState — friendly placeholder when a list has no items.
 * Stays compact so it fits inside cards as well as full pages.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center py-12 px-6 gap-3",
        className,
      )}
    >
      {icon && (
        <div className="flex items-center justify-center size-14 rounded-2xl bg-primary-container text-on-primary-container [&>svg]:size-7">
          {icon}
        </div>
      )}
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      {description && (
        <p className="max-w-sm text-sm text-on-surface-variant text-balance">
          {description}
        </p>
      )}
      {action && <div className="pt-2">{action}</div>}
    </div>
  );
}
