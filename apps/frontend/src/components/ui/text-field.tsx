"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

/**
 * TextField — composed input with label, helper text, and validation message.
 *
 * Uses `useId` so labels are always linked to inputs without callers having to
 * remember to pass `htmlFor`/`id`. Error/help text is rendered in a fixed
 * 18px-tall slot so the form layout doesn't jump as validation appears.
 */
type TextFieldProps = React.ComponentProps<typeof Input> & {
  label: string;
  helperText?: string;
  error?: string;
  leadingIcon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
};

export function TextField({
  label,
  helperText,
  error,
  leadingIcon,
  trailingIcon,
  className,
  id,
  ...inputProps
}: TextFieldProps) {
  const reactId = React.useId();
  const fieldId = id ?? `tf-${reactId}`;
  const helpId = `${fieldId}-help`;
  const invalid = Boolean(error);
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label
        htmlFor={fieldId}
        className="text-sm font-medium text-foreground"
      >
        {label}
      </label>
      <div className="relative">
        {leadingIcon && (
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-on-surface-variant [&>svg]:size-4">
            {leadingIcon}
          </span>
        )}
        <Input
          id={fieldId}
          aria-invalid={invalid || undefined}
          aria-describedby={helperText || error ? helpId : undefined}
          className={cn(
            leadingIcon && "pl-10",
            trailingIcon && "pr-10",
          )}
          {...inputProps}
        />
        {trailingIcon && (
          <span className="absolute inset-y-0 right-3 flex items-center text-on-surface-variant [&>svg]:size-4">
            {trailingIcon}
          </span>
        )}
      </div>
      <p
        id={helpId}
        className={cn(
          "min-h-[18px] text-xs leading-[18px] transition-colors",
          invalid ? "text-error" : "text-on-surface-variant/80",
        )}
      >
        {error ?? helperText ?? " "}
      </p>
    </div>
  );
}
