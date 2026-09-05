"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  BookOpen,
  Check,
  Code2,
  Copy,
  GitBranch,
  GitCommit,
  GitPullRequest,
  KeyRound,
  RotateCcw,
  Search,
  Terminal,
} from "lucide-react";

import SiteShell from "@/app/components/site/SiteShell";
import Reveal from "@/app/components/site/Reveal";

const quickStart = [
  "npm install -g gent-cli",
  "gent login",
  "gent init",
  "gent add README.md",
  'gent commit -m "Initial commit"',
  "gent remote add origin https://gent-api.onrender.com/api/repos/1/my-repo",
  "gent push origin main",
];

const commandGroups = [
  {
    title: "Repository Setup",
    icon: Terminal,
    commands: [
      ["gent auto", "Guided interactive flow for auth, init, remote, commit, and push."],
      ["gent init [-y] [--remote [name]]", "Create a local .gent repository."],
      ["gent clone [url] [dir]", "Download a full repository from the Gent backend."],
    ],
  },
  {
    title: "Staging and Working Tree",
    icon: Code2,
    commands: [
      ["gent status [-s]", "Show staged, modified, untracked, and deleted files."],
      ["gent add <files...> [-A]", "Snapshot files and stage them."],
      ["gent rm <files...> [--cached]", "Stop tracking files."],
      ["gent reset [files...]", "Unstage files."],
      ["gent diff [files...] [--staged] [--stat]", "Show line-level diffs."],
    ],
  },
  {
    title: "History",
    icon: GitCommit,
    commands: [
      ["gent commit [-m <msg>] [-a] [--ai]", "Record staged changes."],
      ["gent log [-n <N>] [--oneline] [--graph] [--stat]", "Inspect commit history."],
      ["gent show [ref] [--no-patch]", "Show commit details and diff."],
      ["gent tag [name] [-m <msg>] [-d <name>]", "Create, list, or delete tags."],
      ["gent explain [ref] [--staged]", "Summarize a commit or staged changes."],
    ],
  },
  {
    title: "Branches and Merges",
    icon: GitBranch,
    commands: [
      ["gent branch [name] [-d <name>] [-a]", "List, create, or delete branches."],
      ["gent checkout <branch> [-b]", "Switch branches or create a new branch."],
      ["gent merge <branch> [-m <msg>]", "Merge another branch into the current branch."],
      ["gent resolve", "Resolve conflicts left by a merge."],
      ["gent stash [pop|list|drop|apply] [-m <msg>]", "Temporarily store working changes."],
    ],
  },
  {
    title: "Remote Sync",
    icon: GitPullRequest,
    commands: [
      ["gent remote [add|remove|set-url] [-v]", "Manage repository remotes."],
      ["gent repos [--create <name>] [--description <text>] [--private]", "List or create backend repositories."],
      ["gent push [remote] [branch] [-f]", "Upload commits and objects."],
      ["gent pull [remote] [branch]", "Download and merge remote commits."],
    ],
  },
  {
    title: "Account",
    icon: KeyRound,
    commands: [
      ["gent register", "Create a Gent account."],
      ["gent login", "Log in and store local CLI auth."],
      ["gent logout", "Clear local CLI auth."],
      ["gent whoami", "Show the current authenticated user."],
    ],
  },
  {
    title: "Safety",
    icon: RotateCcw,
    commands: [
      ["gent undo", "Reverse the last history-changing operation."],
      ["gent undo --list", "Show operation history."],
      ["gent redo", "Re-apply the last undone operation."],
      ["gent reset --soft <hash>", "Move branch pointer without changing files."],
      ["gent reset --hard <hash>", "Restore branch pointer and working tree."],
    ],
  },
  {
    title: "Inspection",
    icon: Search,
    commands: [
      ["gent summary [--ai]", "Show repository health and local stats."],
      ["gent log --graph", "Draw an ASCII graph with branch and merge labels."],
      ["gent show", "Inspect the current or selected commit."],
    ],
  },
];

export default function CliDocsPage() {
  const [copied, setCopied] = useState(false);

  const copyAll = async () => {
    try {
      await navigator.clipboard.writeText(quickStart.join("\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <SiteShell>
      {/* hero */}
      <section className="mx-auto grid max-w-6xl gap-10 px-6 pb-16 pt-36 sm:pt-44 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
        <Reveal y={16}>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-brand">
            CLI documentation
          </p>
          <h1 className="mt-4 font-display text-5xl font-bold leading-[1.03] tracking-tight sm:text-6xl">
            Every Gent command,
            <span className="text-gradient"> grouped by flow.</span>
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-8 text-muted">
            The checked-in Gent CLI reference, kept in lock-step with the backend
            API contract.
          </p>
          <div className="mt-6 rounded-2xl border border-line bg-surface/40 p-4 backdrop-blur">
            <p className="text-sm font-semibold">Remote URL format</p>
            <code className="mt-2 block break-all rounded-lg bg-[#040a08] p-3 font-mono text-sm text-brand-2">
              https://gent-api.onrender.com/api/repos/&lt;owner_id&gt;/&lt;repo_name&gt;
            </code>
          </div>
        </Reveal>

        <Reveal y={16} delay={0.1}>
          <div className="border-beam glow-soft overflow-hidden rounded-2xl bg-[#040a08]/95 ring-1 ring-line">
            <div className="flex items-center justify-between border-b border-white/5 px-4 py-3">
              <div className="flex items-center gap-2">
                <Terminal className="h-4 w-4 text-brand" />
                <span className="font-mono text-xs text-white/50">
                  quick start
                </span>
              </div>
              <button
                onClick={copyAll}
                className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-white/50 transition-colors hover:text-brand"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-brand" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
            <div className="p-5 font-mono text-sm leading-7 text-slate-100">
              {quickStart.map((command, i) => (
                <motion.div
                  key={command}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 + i * 0.07 }}
                  className="flex gap-2"
                >
                  <span className="select-none text-brand">❯</span>
                  <span className="break-all">{command}</span>
                </motion.div>
              ))}
            </div>
          </div>
        </Reveal>
      </section>

      {/* reference */}
      <section className="mx-auto max-w-6xl px-6 pb-24">
        <Reveal className="mb-10 flex items-center gap-3">
          <BookOpen className="h-5 w-5 text-brand" />
          <h2 className="font-display text-3xl font-bold tracking-tight">
            Command Reference
          </h2>
        </Reveal>

        <div className="grid gap-5 lg:grid-cols-2">
          {commandGroups.map((group, index) => (
            <Reveal key={group.title} delay={(index % 2) * 0.08}>
              <section className="h-full rounded-2xl border border-line bg-surface/40 p-5 backdrop-blur transition-colors hover:border-brand/30">
                <div className="mb-4 flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand/12 ring-1 ring-brand/25">
                    <group.icon className="h-4.5 w-4.5 text-brand" />
                  </span>
                  <h3 className="font-display text-lg font-semibold">
                    {group.title}
                  </h3>
                </div>
                <div className="space-y-2.5">
                  {group.commands.map(([command, description]) => (
                    <div
                      key={command}
                      className="group rounded-xl border border-line bg-[#040a08]/40 p-3 transition-colors hover:border-brand/30"
                    >
                      <code className="font-mono text-sm font-semibold text-brand-2">
                        {command}
                      </code>
                      <p className="mt-1 text-sm leading-6 text-muted">
                        {description}
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            </Reveal>
          ))}
        </div>
      </section>
    </SiteShell>
  );
}
