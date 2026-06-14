import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Gent wordmark + glyph. Pure SVG so it scales/colour-shifts with currentColor.
 */
export function Logo({
  className,
  withWordmark = true,
  size = 28,
}: {
  className?: string;
  withWordmark?: boolean;
  size?: number;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2 text-foreground", className)}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="g-grad" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="var(--primary)" />
            <stop offset="100%" stopColor="var(--tertiary)" />
          </linearGradient>
        </defs>
        <rect width="32" height="32" rx="9" fill="url(#g-grad)" />
        <path
          d="M21.5 11.5h-4.25C14.9 11.5 13 13.4 13 15.75v.5C13 18.6 14.9 20.5 17.25 20.5h2.25v-3h-2.25"
          stroke="var(--on-primary)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </svg>
      {withWordmark && (
        <span className="text-[15px] font-semibold tracking-tight">Gent</span>
      )}
    </span>
  );
}
