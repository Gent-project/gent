"use client";

import { ToastContainer, useToasts } from "@/components/ui/Toast";

export default function ToastProvider({ children }: { children: React.ReactNode }) {
  const { toasts, removeToast } = useToasts();

  return (
    <>
      {children}
      <ToastContainer toasts={toasts} onClose={removeToast} />
    </>
  );
}