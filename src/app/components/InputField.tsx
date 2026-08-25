"use client";

import { useId } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useSelector } from "react-redux";
import { RootState } from "@/store";

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
  const isDark = useSelector((state: RootState) => state.theme.isDark);
  const generatedId = useId();
  const inputId = id || generatedId;

  return (
    <div className={cn("space-y-2 w-full", containerClassName)}>
      {label && (
        <Label htmlFor={inputId} className={`text-sm font-medium ${
          isDark ? "text-white/80" : "text-[#2d3e2d]/80"
        }`}>
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </Label>
      )}
      <Input
        id={inputId}
        className={cn(
          "border-2 rounded-md p-2 w-full transition-all",
          isDark
            ? "border-white/20 bg-white/10 text-white placeholder:text-white/50 focus:border-[#7dd3fc] focus:ring-[#7dd3fc]"
            : "border-[#5A7863]/30 bg-white/50 text-[#2d3e2d] placeholder:text-[#2d3e2d]/50 focus:border-[#5A7863] focus:ring-[#5A7863]",
          error && "border-red-500 focus:border-red-500 focus:ring-red-500",
          className
        )}
        required={required}
        {...props}
      />
      {error && <p className="text-sm text-red-500 mt-1">{error}</p>}
    </div>
  );
}
