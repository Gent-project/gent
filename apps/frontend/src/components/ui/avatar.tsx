import * as React from "react";
import { avatarColors, cn, initials } from "@/lib/utils";

/**
 * Avatar — deterministic coloured bubble with initials.
 *
 * Pass `seed` (an email or username) to get a stable colour. If you provide
 * `name`, the initials are derived from it; otherwise the seed is used.
 */
export function Avatar({
  seed,
  name,
  size = 36,
  className,
}: {
  seed: string;
  name?: string;
  size?: number;
  className?: string;
}) {
  const colors = avatarColors(seed);
  return (
    <span
      role="img"
      aria-label={name ?? seed}
      style={{
        width: size,
        height: size,
        background: colors.bg,
        color: colors.fg,
        fontSize: size * 0.4,
      }}
      className={cn(
        "inline-flex items-center justify-center rounded-full font-semibold select-none",
        className,
      )}
    >
      {initials(name ?? seed)}
    </span>
  );
}
