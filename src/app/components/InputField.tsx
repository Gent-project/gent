"use client";

import { useState } from "react";
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
  const [inputId] = useState(() => id || `input-${Math.random().toString(36).substr(2, 9)}`);

  return (
    <div className={cn("space-y-2 w-full", containerClassName)}>
      {label && (
        <Label htmlFor={inputId} className="text-sm font-medium text-gray-700">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </Label>
      )}
      <Input
        id={inputId}
        className={cn(
          "border-2 border-[#90AB8B] focus:border-[#5A7863] focus:ring-[#5A7863] rounded-md p-2 w-full",
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
