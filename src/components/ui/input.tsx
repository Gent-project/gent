import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Input — themed text input.
 *
 * Pairs with `<TextField>` (label + helper text), but can be used standalone.
 * Border / ring colours come from the design tokens so the focus ring matches
 * the rest of the UI in both modes.
 */
function Input({ className, type = "text", ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-11 w-full min-w-0 rounded-xl",
        "border border-outline-variant bg-surface-container-lowest",
        "px-4 py-2 text-sm text-foreground placeholder:text-on-surface-variant/70",
        "transition-[border-color,box-shadow,background] outline-none",
        "focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-primary/25",
        "disabled:cursor-not-allowed disabled:opacity-60",
        "aria-invalid:border-error aria-invalid:ring-[3px] aria-invalid:ring-error/20",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
