"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Boxes,
  Code2,
  GitBranch,
  GitCommit,
  GitPullRequest,
  Server,
  Shield,
  Sparkles,
  Terminal,
} from "lucide-react";

import SiteShell from "@/app/components/site/SiteShell";
import TiltCard from "@/app/components/site/TiltCard";
import Reveal from "@/app/components/site/Reveal";
import Hero3D from "@/app/components/site/Hero3D";
import { useLanguage } from "@/app/language-provider";
import { AUTH_PATH } from "@/routes/path";

const marqueeItems = [
  "gent init",
  "branches",
  "commits",
  "tags",
  "blobs · sha-256",
  "push packs",
  "pull",
  "clone",
  "members",
  "trees",
];

const features = [
  {
    icon: Terminal,
    title: "Gent CLI",
    z: 40,
    description:
      "Initialize repos, stage files, commit, push, pull, and clone straight from your shell against the Gent API.",
  },
  {
    icon: Code2,
    title: "Code Browser",
    z: 24,
    description:
      "Open files from the dashboard, switch branches, read blobs, and create small text files in place.",
  },
  {
    icon: GitBranch,
    title: "Branches",
    z: 32,
    description:
      "Fork branches from any commit and keep each branch tree isolated in the Code tab.",
  },
  {
    icon: GitCommit,
    title: "Commit History",
    z: 24,
    description:
      "Review commit lists and diffs rendered from the exact backend data the CLI writes.",
  },
  {
    icon: GitPullRequest,
    title: "Push & Pull",
    z: 40,
    description:
      "Sync local objects with hosted repositories through Gent push packs and pull endpoints.",
  },
  {
    icon: Shield,
    title: "Access Control",
    z: 28,
    description:
      "Private repositories and member roles enforced by the Gent backend permission model.",
  },
];

const pipeline = [
  {
    icon: Terminal,
    tag: "01 · Local",
    title: "The CLI writes objects",
    body: "Every add and commit hashes content into local Gent objects — the same shape the server understands.",
  },
  {
    icon: Server,
    tag: "02 · API",
    title: "Push packs hit the API",
    body: "Push bundles objects to gent-api.onrender.com and clone pulls them back by owner-id URL.",
  },
  {
    icon: Boxes,
    tag: "03 · Web",
    title: "The dashboard reads them",
    body: "Repositories, branches, commits, trees, blobs, tags and members render from those same endpoints.",
  },
];

export default function Home() {
  const { language } = useLanguage();

  return (
    <SiteShell>
      {/* ===================== HERO ===================== */}
      <section className="relative mx-auto max-w-6xl px-6 pb-16 pt-36 sm:pt-44">
        <div className="grid items-center gap-12 lg:grid-cols-[1.02fr_0.98fr]">
          {/* copy */}
          <div>
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 rounded-full border border-line bg-surface/50 px-3 py-1.5 text-xs font-medium text-muted backdrop-blur"
            >
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-brand" />
              </span>
              Gent version control · CLI + API + Web
            </motion.div>

            <h1
              className={`mt-6 font-display text-5xl font-bold tracking-tight sm:text-6xl ${
                language === "ar" ? "leading-[1.12] lg:text-[4.15rem]" : "leading-[0.98] lg:text-[4.6rem]"
              }`}
            >
              {language === "ar" ? (
                <motion.span
                  data-no-translate
                  initial={{ opacity: 0, y: 28 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.7, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
                  className="inline-block"
                >
                  تحكم بالإصدارات،
                  <br />
                  <span
                    className="inline-block"
                    style={{
                      WebkitTextStroke: "1.2px var(--brand)",
                      color: "transparent",
                    }}
                  >
                    مصنوع
                  </span>{" "}
                  <span className="text-gradient anim-gradient inline-block">
                    بضوء أخضر.
                  </span>
                </motion.span>
              ) : (
                <>
                  {["Version", "control,"].map((w, i) => (
                    <motion.span
                      key={w}
                      initial={{ opacity: 0, y: 28 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.7, delay: 0.05 + i * 0.08, ease: [0.22, 1, 0.36, 1] }}
                      className="mr-3 inline-block"
                    >
                      {w}
                    </motion.span>
                  ))}
                  <br />
                  <motion.span
                    initial={{ opacity: 0, y: 28 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.7, delay: 0.24, ease: [0.22, 1, 0.36, 1] }}
                    className="inline-block"
                    style={{
                      WebkitTextStroke: "1.4px var(--brand)",
                      color: "transparent",
                    }}
                  >
                    forged
                  </motion.span>{" "}
                  <motion.span
                    initial={{ opacity: 0, y: 28 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.7, delay: 0.32, ease: [0.22, 1, 0.36, 1] }}
                    className="relative inline-block"
                  >
                    in{" "}
                    <span className="text-gradient anim-gradient">green.</span>
                    <svg
                      aria-hidden
                      viewBox="0 0 200 12"
                      className="absolute -bottom-1 left-0 h-3 w-full"
                      preserveAspectRatio="none"
                    >
                      <motion.path
                        d="M2 8 C 50 2, 150 2, 198 7"
                        stroke="var(--brand)"
                        strokeWidth="3"
                        strokeLinecap="round"
                        fill="none"
                        initial={{ pathLength: 0 }}
                        animate={{ pathLength: 1 }}
                        transition={{ duration: 0.8, delay: 0.7 }}
                      />
                    </svg>
                  </motion.span>
                </>
              )}
            </h1>

            <motion.p
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.12 }}
              className="mt-6 max-w-xl text-lg leading-8 text-muted"
            >
              A lightweight Git-like CLI, a hosted API, and a dashboard that all
              speak the same objects — repositories, commits, branches, tags,
              files, and members.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.19 }}
              className="mt-9 flex flex-col gap-3 sm:flex-row"
            >
              <Link
                href={AUTH_PATH.LOGIN}
                className="group relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-xl bg-brand px-6 py-3.5 text-sm font-semibold text-brand-ink transition-transform duration-200 hover:scale-[1.03]"
              >
                <span className="anim-shimmer absolute inset-0" />
                <span className="relative">Open the Dashboard</span>
                <ArrowRight className="relative h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
              <Link
                href="/cli"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-line-strong bg-surface/40 px-6 py-3.5 text-sm font-semibold text-fg backdrop-blur transition-colors hover:border-brand/50 hover:bg-brand/5"
              >
                <Terminal className="h-4 w-4 text-brand" />
                Read CLI Docs
              </Link>
            </motion.div>

            {/* stat strip */}
            <motion.dl
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="mt-12 grid max-w-lg grid-cols-3 gap-6 border-t border-line pt-6"
            >
              {[
                ["6", "core object types"],
                ["1", "CLI · API · Web"],
                ["SHA-256", "content addressed"],
              ].map(([n, l]) => (
                <div key={l}>
                  <dt className="font-display text-2xl font-bold text-fg">{n}</dt>
                  <dd className="mt-1 text-xs leading-4 text-faint">{l}</dd>
                </div>
              ))}
            </motion.dl>
          </div>

          {/* 3D parallax scene */}
          <motion.div
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.9, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
          >
            <Hero3D />
          </motion.div>
        </div>
      </section>

      {/* ===================== MARQUEE ===================== */}
      <div className="relative flex overflow-hidden border-y border-line py-4">
        <div className="marquee-track flex shrink-0 items-center gap-8 pr-8">
          {[...marqueeItems, ...marqueeItems].map((item, i) => (
            <span
              key={i}
              className="flex items-center gap-8 font-mono text-sm text-faint"
            >
              <Sparkles className="h-3.5 w-3.5 text-brand/60" />
              {item}
            </span>
          ))}
        </div>
      </div>

      {/* ===================== FEATURES ===================== */}
      <section className="mx-auto max-w-6xl px-6 py-24">
        <Reveal className="max-w-2xl">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-brand">
            What exists now
          </p>
          <h2 className="mt-4 font-display text-4xl font-bold tracking-tight sm:text-5xl">
            Built around real Gent workflows.
          </h2>
          <p className="mt-4 text-lg leading-8 text-muted">
            Every surface below is wired to the current CLI, API, and dashboard —
            not a mockup.
          </p>
        </Reveal>

        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f, i) => (
            <Reveal key={f.title} delay={i * 0.06}>
              <TiltCard
                intensity={7}
                glare={false}
                className="group h-full rounded-2xl border border-line bg-surface/40 p-6 backdrop-blur transition-colors hover:border-brand/40"
              >
                <div
                  className="layer-3d flex h-11 w-11 items-center justify-center rounded-xl bg-brand/12 ring-1 ring-brand/25"
                  style={{ "--z": `${f.z}px` } as React.CSSProperties}
                >
                  <f.icon className="h-5 w-5 text-brand" />
                </div>
                <h3 className="layer-3d mt-5 font-display text-lg font-semibold" style={{ "--z": "18px" } as React.CSSProperties}>
                  {f.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-muted">{f.description}</p>
              </TiltCard>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ===================== PIPELINE ===================== */}
      <section className="mx-auto max-w-6xl px-6 pb-24">
        <Reveal className="mb-14 max-w-2xl">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-brand">
            The path of a commit
          </p>
          <h2 className="mt-4 font-display text-4xl font-bold tracking-tight sm:text-5xl">
            From your shell to the web.
          </h2>
        </Reveal>

        <div className="relative grid gap-5 md:grid-cols-3">
          {/* connecting line */}
          <div className="pointer-events-none absolute left-0 right-0 top-8 hidden h-px bg-gradient-to-r from-brand/0 via-brand/40 to-brand/0 md:block" />
          {pipeline.map((step, i) => (
            <Reveal key={step.tag} delay={i * 0.12}>
              <div className="relative h-full rounded-2xl border border-line bg-surface/40 p-6 backdrop-blur">
                <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-bg ring-1 ring-brand/30 glow-ring">
                  <step.icon className="h-7 w-7 text-brand" />
                </div>
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-faint">
                  {step.tag}
                </p>
                <h3 className="mt-2 font-display text-xl font-semibold">
                  {step.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-muted">{step.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ===================== CTA ===================== */}
      <section className="mx-auto max-w-6xl px-6 pb-8">
        <Reveal>
          <div className="border-beam glow-soft relative overflow-hidden rounded-3xl bg-surface/60 p-10 text-center backdrop-blur sm:p-16">
            <div
              aria-hidden
              className="anim-pulse-glow pointer-events-none absolute left-1/2 top-0 -z-10 h-72 w-72 -translate-x-1/2 rounded-full blur-3xl"
              style={{ background: "var(--glow)" }}
            />
            <h2 className="mx-auto max-w-2xl font-display text-4xl font-bold tracking-tight sm:text-5xl">
              Spin up your first repository.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-lg text-muted">
              Install the CLI, push a commit, and watch it appear in the
              dashboard seconds later.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href={AUTH_PATH.SIGNIN}
                className="group inline-flex items-center gap-2 rounded-xl bg-brand px-6 py-3.5 text-sm font-semibold text-brand-ink transition-transform hover:scale-[1.03]"
              >
                Create free account
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
              <span className="font-mono text-sm text-faint">
                npm install -g gent-cli
              </span>
            </div>
          </div>
        </Reveal>
      </section>
    </SiteShell>
  );
}
