import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * Button — the project's only button primitive.
 *
 * All variants pull from the Material-style design tokens (primary, on-primary,
 * primary-container, etc.) so they automatically restyle when light/dark mode
 * toggles. The "tonal" variant matches Material 3's "tonal" button style and is
 * the right default for medium-emphasis actions on a coloured surface.
 */
const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-2 whitespace-nowrap",
    "rounded-full text-sm font-semibold tracking-tight",
    "transition-[transform,background,box-shadow,color] duration-200",
    "active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50",
    "[&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0",
    "outline-none focus-visible:ring-[3px] focus-visible:ring-primary/40",
  ].join(" "),
  {
    variants: {
      variant: {
        primary:
          "bg-primary text-on-primary hover:brightness-110 shadow-sm hover:shadow-md",
        tonal:
          "bg-primary-container text-on-primary-container hover:brightness-95",
        secondary:
          "bg-secondary text-on-secondary hover:brightness-105",
        outline:
          "border border-outline-variant bg-transparent text-foreground hover:bg-surface-container-low",
        ghost:
          "bg-transparent text-foreground hover:bg-surface-container-low",
        destructive:
          "bg-error text-on-error hover:brightness-110 shadow-sm",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        sm: "h-8 px-3 text-xs",
        md: "h-10 px-5",
        lg: "h-12 px-7 text-base",
        icon: "size-10",
        "icon-sm": "size-8",
        "icon-lg": "size-12",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  };

function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}

export { Button, buttonVariants };
export type { ButtonProps };
