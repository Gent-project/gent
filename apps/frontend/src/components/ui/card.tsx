import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Card — surface container with consistent padding & rounded corners.
 *
 * Variants:
 *  - default: solid `surface-container-lowest` card with a hairline border.
 *  - raised:  same surface but with a soft floating shadow (for hero cards).
 *  - glass:   semi-transparent with backdrop blur (for hero overlays).
 *  - outline: transparent with a stronger border (for nested groupings).
 */
type CardProps = React.HTMLAttributes<HTMLDivElement> & {
  variant?: "default" | "raised" | "glass" | "outline";
  interactive?: boolean;
};

export function Card({
  className,
  variant = "default",
  interactive = false,
  ...props
}: CardProps) {
  return (
    <div
      data-slot="card"
      data-variant={variant}
      className={cn(
        "rounded-2xl border border-outline-variant",
        variant === "default" && "bg-surface-container-lowest",
        variant === "raised" && "bg-surface-container-lowest shadow-soft",
        variant === "glass" && "glass border-white/10",
        variant === "outline" && "bg-transparent border-outline-variant/80",
        interactive &&
          "transition-all duration-300 hover:-translate-y-0.5 hover:shadow-soft hover:border-primary/30",
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-5 pb-3", className)} {...p} />;
}
export function CardTitle({ className, ...p }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn("text-base font-semibold tracking-tight text-foreground", className)}
      {...p}
    />
  );
}
export function CardDescription({
  className,
  ...p
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn("mt-1 text-sm text-on-surface-variant", className)} {...p} />
  );
}
export function CardContent({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-5 pt-0", className)} {...p} />;
}
export function CardFooter({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 p-5 pt-3 border-t border-outline-variant",
        className,
      )}
      {...p}
    />
  );
}
