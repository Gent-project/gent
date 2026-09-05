"use client";

import { useMemo, useState } from "react";
import { Copy, Check, Download, FileText, FileWarning } from "lucide-react";
import { toast } from "sonner";

import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import type { Blob } from "@/types/api";
import { cn, shortSha } from "@/lib/utils";

/**
 * FileViewer — renders a Blob (file content) with line numbers.
 *
 * Binary blobs (base64-encoded) are shown as "binary file" with a download
 * button instead of trying to print raw bytes into the DOM. Text files keep
 * monospace formatting and line numbers; we don't syntax-highlight (yet) so
 * the bundle stays small.
 */
export function FileViewer({
  fileName,
  blob,
  isLoading,
  error,
}: {
  fileName: string;
  blob: Blob | undefined;
  isLoading: boolean;
  error?: unknown;
}) {
  const [copied, setCopied] = useState(false);

  const text = useMemo(() => {
    if (!blob || blob.encoding !== "utf-8") return null;
    return blob.content ?? "";
  }, [blob]);

  const lineCount = text?.split("\n").length ?? 0;

  function copy() {
    if (text == null) return;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      toast.success("File copied to clipboard.");
      setTimeout(() => setCopied(false), 1500);
    });
  }

  function download() {
    if (!blob) return;
    let payload: string;
    let mime: string;
    if (blob.encoding === "base64") {
      payload = blob.content;
      mime = "application/octet-stream";
      const bin = atob(payload);
      const arr = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      const url = URL.createObjectURL(new window.Blob([arr], { type: mime }));
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      link.click();
      URL.revokeObjectURL(url);
    } else {
      payload = blob.content ?? "";
      mime = "text/plain";
      const url = URL.createObjectURL(new window.Blob([payload], { type: mime }));
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      link.click();
      URL.revokeObjectURL(url);
    }
  }

  return (
    <div className="rounded-2xl border border-outline-variant bg-surface-container-lowest overflow-hidden">
      <div className="flex items-center gap-3 border-b border-outline-variant bg-surface-container-low px-4 py-3">
        <FileText className="size-4 text-on-surface-variant" />
        <span className="font-mono text-sm truncate flex-1">{fileName}</span>
        {blob && (
          <>
            <Badge tone="outline" size="sm">
              {blob.encoding}
            </Badge>
            <Badge tone="outline" size="sm">
              {formatBytes(blob.size)}
            </Badge>
            <code className="rounded-md bg-surface-container px-1.5 py-0.5 text-[11px] font-mono text-on-surface-variant">
              {shortSha(blob.sha)}
            </code>
            <button
              type="button"
              onClick={copy}
              disabled={text == null}
              title="Copy file contents"
              className="inline-flex h-7 w-7 items-center justify-center rounded-md hover:bg-surface-container disabled:opacity-50"
            >
              {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
            </button>
            <button
              type="button"
              onClick={download}
              title="Download file"
              className="inline-flex h-7 w-7 items-center justify-center rounded-md hover:bg-surface-container"
            >
              <Download className="size-3.5" />
            </button>
          </>
        )}
      </div>

      {isLoading ? (
        <div className="p-4 space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-4 w-full" />
          ))}
        </div>
      ) : error ? (
        <div className="flex items-start gap-3 p-6 text-error">
          <FileWarning className="size-5 mt-0.5" />
          <p className="text-sm">
            Couldn't load this file. It may have been deleted or your session
            expired.
          </p>
        </div>
      ) : blob?.encoding === "base64" ? (
        <div className="p-6 text-sm text-on-surface-variant">
          <FileWarning className="size-5 mb-2 text-tertiary" />
          This file is binary. Use the download button above to fetch it locally.
        </div>
      ) : (
        <pre className="font-mono text-sm leading-relaxed overflow-auto scrollbar-thin max-h-[560px]">
          <table className="border-collapse w-full">
            <tbody>
              {text!.split("\n").map((line, i) => (
                <tr key={i} className="hover:bg-surface-container-low">
                  <td
                    className={cn(
                      "select-none pr-3 pl-4 text-right align-top",
                      "text-on-surface-variant/60 border-r border-outline-variant/60",
                      "min-w-[3rem] tabular-nums",
                    )}
                  >
                    {i + 1}
                  </td>
                  <td className="px-3 align-top whitespace-pre">{line || " "}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </pre>
      )}

      {blob && (
        <div className="border-t border-outline-variant bg-surface-container-low px-4 py-2 text-xs text-on-surface-variant">
          {lineCount.toLocaleString()} lines · {formatBytes(blob.size)} ·{" "}
          {blob.encoding}
        </div>
      )}
    </div>
  );
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
