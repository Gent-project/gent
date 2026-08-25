"use client";

import { motion } from "framer-motion";
import {
  BookOpen,
  Code2,
  GitBranch,
  GitCommit,
  GitPullRequest,
  KeyRound,
  RotateCcw,
  Search,
  Terminal,
} from "lucide-react";
import { useSelector } from "react-redux";

import SharedFooter from "@/app/components/SharedFooter";
import SharedNavigation from "@/app/components/SharedNavigation";
import { RootState } from "@/store";

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
  const isDark = useSelector((state: RootState) => state.theme.isDark);

  const pageBg = isDark
    ? "bg-[#0f1419] text-white"
    : "bg-[#f4f7ef] text-[#223022]";
  const panel = isDark
    ? "border-white/10 bg-white/[0.04]"
    : "border-[#5A7863]/20 bg-white/70";
  const muted = isDark ? "text-white/65" : "text-[#4a5f4a]";
  const accent = isDark ? "text-[#7dd3fc]" : "text-[#5A7863]";

  return (
    <div className={`min-h-screen transition-colors duration-300 ${pageBg}`}>
      <SharedNavigation />

      <main className="pt-24">
        <section className="mx-auto grid max-w-7xl gap-8 px-4 py-14 sm:px-6 lg:grid-cols-[0.95fr_1.05fr] lg:px-8 lg:py-20">
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
          >
            <p className={`mb-4 text-sm font-semibold uppercase ${accent}`}>
              CLI documentation
            </p>
            <h1 className="text-4xl font-bold leading-tight sm:text-5xl">
              Gent commands, grouped by workflow.
            </h1>
            <p className={`mt-5 max-w-2xl leading-7 ${muted}`}>
              This page summarizes the checked-in Gent CLI command reference and
              keeps the web instructions aligned with the backend API contract.
            </p>
            <div className={`mt-6 rounded-lg border p-4 ${panel}`}>
              <p className="text-sm font-semibold">Remote URL format</p>
              <code className="mt-2 block break-all rounded bg-[#0b1117] p-3 text-sm text-[#7dd3fc]">
                https://gent-api.onrender.com/api/repos/&lt;owner_id&gt;/&lt;repo_name&gt;
              </code>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08, duration: 0.35 }}
            className={`rounded-xl border p-4 shadow-xl ${panel}`}
          >
            <div className="mb-4 flex items-center gap-2">
              <Terminal className={`h-4 w-4 ${accent}`} />
              <span className="text-sm font-semibold">Quick start</span>
            </div>
            <div className="rounded-lg bg-[#0b1117] p-5 font-mono text-sm text-slate-100">
              {quickStart.map((command) => (
                <div key={command} className="mb-2 last:mb-0">
                  <span className="text-[#7dd3fc]">$</span> {command}
                </div>
              ))}
            </div>
          </motion.div>
        </section>

        <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6 lg:px-8">
          <div className="mb-8 flex items-center gap-3">
            <BookOpen className={`h-5 w-5 ${accent}`} />
            <h2 className="text-2xl font-bold">Command Reference</h2>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            {commandGroups.map((group, index) => (
              <motion.section
                key={group.title}
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.03 }}
                className={`rounded-lg border p-5 ${panel}`}
              >
                <div className="mb-4 flex items-center gap-3">
                  <group.icon className={`h-5 w-5 ${accent}`} />
                  <h3 className="font-semibold">{group.title}</h3>
                </div>
                <div className="space-y-3">
                  {group.commands.map(([command, description]) => (
                    <div
                      key={command}
                      className={`rounded-md border p-3 ${
                        isDark
                          ? "border-white/10 bg-[#0b1117]/70"
                          : "border-[#5A7863]/15 bg-white"
                      }`}
                    >
                      <code className={`text-sm font-semibold ${accent}`}>
                        {command}
                      </code>
                      <p className={`mt-1 text-sm leading-6 ${muted}`}>
                        {description}
                      </p>
                    </div>
                  ))}
                </div>
              </motion.section>
            ))}
          </div>
        </section>
      </main>

      <SharedFooter />
    </div>
  );
}
