"use client";

import Link from "next/link";
import { useState } from "react";
import { Check, Copy, GitBranch, Terminal } from "lucide-react";

const columns: { title: string; links: { href: string; label: string }[] }[] = [
  {
    title: "Product",
    links: [
      { href: "/home", label: "Overview" },
      { href: "/how-it-works", label: "How it works" },
      { href: "/services", label: "Services" },
      { href: "/dashboard", label: "Dashboard" },
    ],
  },
  {
    title: "Developers",
    links: [
      { href: "/cli", label: "CLI Docs" },
      { href: "/faq", label: "FAQ" },
      { href: "/auth/signup", label: "Create account" },
      { href: "/auth/login", label: "Sign in" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/privacy", label: "Privacy" },
      { href: "/terms", label: "Terms" },
    ],
  },
];

export default function SharedFooter() {
  const [copied, setCopied] = useState(false);
  const install = "npm install -g gent-cli";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(install);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <footer className="relative mt-24 overflow-hidden border-t border-line">
      {/* glowing wordmark backdrop */}
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-16 left-1/2 -z-10 -translate-x-1/2 select-none font-display text-[26vw] font-bold leading-none text-brand/[0.05] sm:text-[22vw]"
      >
        gent
      </div>

      <div className="mx-auto grid max-w-6xl gap-12 px-6 py-16 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <Link href="/home" className="inline-flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand/12 ring-1 ring-brand/30">
              <GitBranch className="h-5 w-5 text-brand" />
            </span>
            <span className="font-display text-lg font-bold">Gent</span>
          </Link>
          <p className="mt-4 max-w-xs text-sm leading-6 text-muted">
            A lightweight version control system — a Git-like CLI, a hosted API,
            and a web dashboard that read from the same objects.
          </p>

          <button
            data-no-translate
            onClick={copy}
            className="group mt-5 inline-flex items-center gap-2 rounded-xl border border-line bg-surface/50 px-3 py-2 font-mono text-sm text-fg transition-colors hover:border-brand/40"
          >
            <Terminal className="h-4 w-4 text-brand" />
            <span>{install}</span>
            {copied ? (
              <Check className="h-4 w-4 text-brand" />
            ) : (
              <Copy className="h-4 w-4 text-faint transition-colors group-hover:text-brand" />
            )}
          </button>
        </div>

        {columns.map((col) => (
          <nav key={col.title} className="flex flex-col gap-3">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-faint">
              {col.title}
            </p>
            {col.links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="w-fit text-sm text-muted transition-colors hover:text-brand"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        ))}
      </div>

      <div className="mx-auto flex max-w-6xl flex-col gap-2 border-t border-line px-6 py-6 text-xs text-faint sm:flex-row sm:items-center sm:justify-between">
        <span>© {new Date().getFullYear()} Gent. Built for developers.</span>
        <span data-no-translate className="font-mono">/api/repos/&lt;owner_id&gt;/&lt;repo_name&gt;</span>
      </div>
    </footer>
  );
}
