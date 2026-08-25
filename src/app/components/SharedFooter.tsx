"use client";

import Link from "next/link";
import { GitBranch, Terminal } from "lucide-react";
import { useSelector } from "react-redux";

import { RootState } from "@/store";

const footerLinks = [
  { href: "/home", label: "Home" },
  { href: "/cli", label: "CLI Docs" },
  { href: "/faq", label: "FAQ" },
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
];

export default function SharedFooter() {
  const isDark = useSelector((state: RootState) => state.theme.isDark);

  const footer = isDark
    ? "border-white/10 bg-[#0b1117] text-white"
    : "border-[#5A7863]/15 bg-white text-[#223022]";
  const muted = isDark ? "text-white/60" : "text-[#4a5f4a]";
  const panel = isDark
    ? "border-white/10 bg-white/[0.04]"
    : "border-[#5A7863]/15 bg-[#f4f7ef]";

  return (
    <footer className={`border-t ${footer}`}>
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid gap-8 md:grid-cols-[1fr_auto] md:items-start">
          <div>
            <Link href="/home" className="inline-flex items-center gap-3">
              <span
                className={`flex h-9 w-9 items-center justify-center rounded-lg ${
                  isDark ? "bg-white/10" : "bg-[#f4f7ef]"
                }`}
              >
                <GitBranch
                  className={`h-5 w-5 ${isDark ? "text-[#7dd3fc]" : "text-[#5A7863]"}`}
                />
              </span>
              <span>
                <span className="block text-base font-bold leading-5">Gent</span>
                <span className={`block text-xs ${muted}`}>
                  Lightweight version control for this project.
                </span>
              </span>
            </Link>

            <div
              className={`mt-5 inline-flex max-w-full items-center gap-2 rounded-lg border px-3 py-2 font-mono text-sm ${panel}`}
            >
              <Terminal className="h-4 w-4 shrink-0" />
              <span className="break-all">npm install -g gent-cli</span>
            </div>
          </div>

          <nav className="flex flex-wrap gap-x-4 gap-y-2 md:justify-end">
            {footerLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`text-sm transition hover:opacity-100 ${muted}`}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className={`mt-8 border-t pt-5 text-xs ${isDark ? "border-white/10 text-white/45" : "border-[#5A7863]/15 text-[#4a5f4a]"}`}>
          Gent dashboard uses the same API repository path expected by the CLI:
          <span className="ml-1 font-mono">/api/repos/&lt;owner_id&gt;/&lt;repo_name&gt;</span>
        </div>
      </div>
    </footer>
  );
}
