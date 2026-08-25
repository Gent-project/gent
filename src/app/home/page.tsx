"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Code2,
  GitBranch,
  GitCommit,
  GitPullRequest,
  Shield,
  Terminal,
} from "lucide-react";
import { useSelector } from "react-redux";

import SharedFooter from "@/app/components/SharedFooter";
import SharedNavigation from "@/app/components/SharedNavigation";
import { AUTH_PATH } from "@/routes/path";
import { RootState } from "@/store";

const workflow = [
  "gent init",
  "gent add README.md",
  'gent commit -m "Initial commit"',
  "gent remote add origin https://gent-api.onrender.com/api/repos/1/my-repo",
  "gent push origin main",
];

const features = [
  {
    icon: Terminal,
    title: "Gent CLI",
    description:
      "Initialize local repositories, stage files, commit changes, push, pull, and clone from the Gent API.",
  },
  {
    icon: Code2,
    title: "Code Browser",
    description:
      "Open repository files from the dashboard, switch branches, read blobs, and create small text files.",
  },
  {
    icon: GitBranch,
    title: "Branches",
    description:
      "Create branches from existing commits and keep each branch tree separate in the Code tab.",
  },
  {
    icon: GitCommit,
    title: "Commit History",
    description:
      "Review commit lists and diffs from the same backend data used by the CLI.",
  },
  {
    icon: GitPullRequest,
    title: "Push and Pull",
    description:
      "Use Gent push packs and pull endpoints to sync local objects with the hosted repository.",
  },
  {
    icon: Shield,
    title: "Repository Access",
    description:
      "Private repositories and member roles are handled by the Gent backend permissions.",
  },
];

export default function Home() {
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
        <section className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:px-8 lg:py-24">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
            className="flex flex-col justify-center"
          >
            <p className={`mb-4 text-sm font-semibold uppercase ${accent}`}>
              Gent version control
            </p>
            <h1 className="max-w-3xl text-4xl font-bold leading-tight sm:text-5xl lg:text-6xl">
              A simple web home for the Gent CLI.
            </h1>
            <p className={`mt-5 max-w-2xl text-base leading-7 sm:text-lg ${muted}`}>
              Gent connects a lightweight CLI, a hosted API, and a dashboard for
              repositories, commits, branches, tags, files, and members.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href={AUTH_PATH.LOGIN}
                className={`inline-flex items-center justify-center gap-2 rounded-lg px-5 py-3 text-sm font-semibold transition ${
                  isDark
                    ? "bg-[#7dd3fc] text-[#071018] hover:bg-[#9be1fd]"
                    : "bg-[#2d3e2d] text-white hover:bg-[#3b523b]"
                }`}
              >
                Open Dashboard <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/cli"
                className={`inline-flex items-center justify-center gap-2 rounded-lg border px-5 py-3 text-sm font-semibold transition ${
                  isDark
                    ? "border-white/20 text-white hover:bg-white/10"
                    : "border-[#2d3e2d]/25 text-[#2d3e2d] hover:bg-white"
                }`}
              >
                Read CLI Docs
              </Link>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08, duration: 0.45 }}
            className={`rounded-xl border p-4 shadow-xl ${panel}`}
          >
            <div className="mb-4 flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-red-400" />
              <span className="h-3 w-3 rounded-full bg-yellow-400" />
              <span className="h-3 w-3 rounded-full bg-green-400" />
              <span className={`ml-2 text-xs ${muted}`}>Gent terminal</span>
            </div>
            <div className="rounded-lg bg-[#0b1117] p-5 font-mono text-sm text-slate-100">
              {workflow.map((command, index) => (
                <motion.div
                  key={command}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.15 + index * 0.08 }}
                  className="mb-2 last:mb-0"
                >
                  <span className="text-[#7dd3fc]">$</span> {command}
                </motion.div>
              ))}
            </div>
          </motion.div>
        </section>

        <section
          className={`border-y ${
            isDark
              ? "border-white/10 bg-white/[0.03]"
              : "border-[#5A7863]/15 bg-white/45"
          }`}
        >
          <div className="mx-auto grid max-w-7xl gap-4 px-4 py-10 sm:px-6 md:grid-cols-3 lg:px-8">
            {[
              ["API remote format", "/api/repos/<owner_id>/<repo_name>"],
              ["Object storage", "Blob SHA-256 with Gent push packs"],
              ["Dashboard routes", "/dashboard/repository/<owner>/<repo>"],
            ].map(([label, value]) => (
              <div key={label}>
                <p className={`text-xs font-semibold uppercase ${muted}`}>
                  {label}
                </p>
                <p className="mt-1 break-words font-mono text-sm font-semibold">
                  {value}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <p className={`text-sm font-semibold uppercase ${accent}`}>
              What exists now
            </p>
            <h2 className="mt-3 text-3xl font-bold">
              Built around real Gent workflows.
            </h2>
            <p className={`mt-3 leading-7 ${muted}`}>
              These are the parts connected to the current CLI, API, and
              dashboard flow.
            </p>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature, index) => (
              <motion.article
                key={feature.title}
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.04 }}
                className={`rounded-lg border p-5 ${panel}`}
              >
                <feature.icon className={`h-5 w-5 ${accent}`} />
                <h3 className="mt-4 text-base font-semibold">
                  {feature.title}
                </h3>
                <p className={`mt-2 text-sm leading-6 ${muted}`}>
                  {feature.description}
                </p>
              </motion.article>
            ))}
          </div>
        </section>

        <section
          id="workflow"
          className="mx-auto grid max-w-7xl gap-8 px-4 pb-20 sm:px-6 lg:grid-cols-2 lg:px-8"
        >
          <div className={`rounded-lg border p-6 ${panel}`}>
            <h2 className="text-2xl font-bold">From CLI to backend</h2>
            <p className={`mt-3 leading-7 ${muted}`}>
              The CLI stores local objects, sends push packs to the API, and
              clones repositories from the owner-id URL shown in the dashboard.
            </p>
          </div>
          <div className={`rounded-lg border p-6 ${panel}`}>
            <h2 className="text-2xl font-bold">From backend to web</h2>
            <p className={`mt-3 leading-7 ${muted}`}>
              The dashboard reads repositories, branches, commits, trees, blobs,
              tags, and members directly from Gent API endpoints.
            </p>
          </div>
        </section>
      </main>

      <SharedFooter />
    </div>
  );
}
