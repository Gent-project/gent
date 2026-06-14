"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Copy, Check } from "lucide-react";
import { toast } from "sonner";

import type { CliCommand } from "@/lib/cli-commands";
import { cn } from "@/lib/utils";

/**
 * CommandCard — collapsible card describing one CLI command.
 *
 * Closed state shows icon, name, syntax and summary. Expanded state reveals
 * description, examples (copy-to-clipboard) and related commands.
 */
export function CommandCard({
  command,
  initiallyOpen = false,
  index = 0,
  onSelectRelated,
}: {
  command: CliCommand;
  initiallyOpen?: boolean;
  index?: number;
  onSelectRelated?: (name: string) => void;
}) {
  const [open, setOpen] = useState(initiallyOpen);
  const Icon = command.icon;

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.02 }}
      className={cn(
        "rounded-2xl border bg-surface-container-lowest transition-all",
        open ? "border-primary/40 shadow-soft" : "border-outline-variant",
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full text-left p-4 flex items-start gap-4"
        aria-expanded={open}
      >
        <span className="mt-0.5 inline-flex size-10 items-center justify-center rounded-xl bg-primary-container text-on-primary-container shrink-0">
          <Icon className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-foreground">gent {command.name}</h3>
            <code className="rounded-md bg-surface-container px-1.5 py-0.5 text-[11px] font-mono text-on-surface-variant">
              {command.syntax}
            </code>
          </div>
          <p className="mt-1 text-sm text-on-surface-variant">{command.summary}</p>
        </div>
        <ChevronDown
          className={cn(
            "size-4 mt-2 text-on-surface-variant transition-transform shrink-0",
            open && "rotate-180",
          )}
        />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-1 space-y-4">
              <p className="text-sm text-foreground/90 leading-relaxed">
                {command.description}
              </p>

              <div>
                <h4 className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant mb-2">
                  Examples
                </h4>
                <ul className="space-y-2">
                  {command.examples.map((ex, i) => (
                    <ExampleRow key={i} command={ex.command} comment={ex.comment} />
                  ))}
                </ul>
              </div>

              {command.related && command.related.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant mb-2">
                    Related
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {command.related.map((r) => (
                      <button
                        key={r}
                        onClick={() => onSelectRelated?.(r)}
                        className="rounded-full bg-surface-container px-3 py-1 text-xs text-foreground hover:bg-primary-container hover:text-on-primary-container transition"
                      >
                        gent {r}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.article>
  );
}

function ExampleRow({ command, comment }: { command: string; comment?: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(command).then(() => {
      setCopied(true);
      toast.success("Copied to clipboard.");
      setTimeout(() => setCopied(false), 1200);
    });
  }
  return (
    <li className="group rounded-xl bg-inverse-surface text-on-inverse-surface px-3 py-2 flex items-start gap-3">
      <span className="text-primary font-mono select-none">$</span>
      <code className="flex-1 font-mono text-sm break-all">{command}</code>
      {comment && (
        <span className="text-xs text-on-inverse-surface/60 hidden sm:inline">
          # {comment}
        </span>
      )}
      <button
        type="button"
        onClick={copy}
        aria-label="Copy example"
        className="rounded-md p-1 hover:bg-on-inverse-surface/10 transition"
      >
        {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
      </button>
    </li>
  );
}
