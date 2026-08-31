"use client";

import { useId } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface InputFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  containerClassName?: string;
  error?: string;
  required?: boolean;
}

export default function InputField({
  label,
  className,
  containerClassName,
  error,
  required,
  id,
  ...props
}: InputFieldProps) {
  const generatedId = useId();
  const inputId = id || generatedId;

  return (
    <div className={cn("w-full space-y-2", containerClassName)}>
      {label && (
        <Label htmlFor={inputId} className="text-sm font-medium text-muted">
          {label}
          {required && <span className="ml-1 text-brand">*</span>}
        </Label>
      )}
      <Input
        id={inputId}
        className={cn(
          "w-full rounded-xl border border-line bg-surface/60 p-2.5 text-fg placeholder:text-faint transition-all focus-visible:border-brand/60 focus-visible:ring-2 focus-visible:ring-brand/20",
          error && "border-destructive focus-visible:border-destructive focus-visible:ring-destructive/20",
          className,
        )}
        required={required}
        {...props}
      />
      {error && <p className="mt-1 text-sm text-destructive">{error}</p>}
    </div>
  );
}
