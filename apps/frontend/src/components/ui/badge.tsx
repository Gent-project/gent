import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Badge — tiny pill, used for status, branch counts, "private", etc.
 */
const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full text-xs font-medium tracking-tight",
  {
    variants: {
      tone: {
        neutral: "bg-surface-container text-on-surface-variant",
        primary: "bg-primary-container text-on-primary-container",
        secondary: "bg-secondary-container text-on-secondary",
        tertiary: "bg-tertiary-fixed text-on-tertiary-container",
        warning: "bg-warning-container text-on-tertiary-container",
        error: "bg-error-container text-on-error-container",
        success: "bg-secondary-container text-on-secondary",
        outline: "border border-outline-variant text-on-surface-variant",
      },
      size: {
        sm: "h-5 px-2 text-[10.5px]",
        md: "h-6 px-2.5",
      },
    },
    defaultVariants: { tone: "neutral", size: "md" },
  },
);

type BadgeProps = React.HTMLAttributes<HTMLSpanElement> &
  VariantProps<typeof badgeVariants>;

export function Badge({ className, tone, size, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone, size }), className)} {...props} />;
}
