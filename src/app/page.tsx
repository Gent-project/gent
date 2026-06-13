"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Cloud,
  GitBranch,
  GitCommit,
  Sparkles,
  Terminal,
  ShieldCheck,
  Zap,
  CheckCircle2,
} from "lucide-react";

import { MarketingNav } from "@/components/layout/marketing-nav";
import { MarketingFooter } from "@/components/layout/marketing-footer";
import { AnimatedTerminal } from "@/components/features/cli/animated-terminal";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PATHS } from "@/lib/paths";

/**
 * Landing page (`/`).
 *
 * Sections:
 *   1. Hero with animated terminal + CTAs.
 *   2. Stat strip with three key benefits.
 *   3. Features grid.
 *   4. "How it works" — three numbered steps.
 *   5. Live workflow demo (terminal beside a faux dashboard line).
 *   6. CTA / footer.
 */
export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col">
      <MarketingNav />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 gradient-mesh -z-10" />
        <div className="mx-auto max-w-7xl px-4 sm:px-8 pt-16 pb-20 grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              <Badge tone="primary">
                <Sparkles className="size-3" /> Now in open beta
              </Badge>
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05, duration: 0.45 }}
              className="mt-5 text-balance text-5xl md:text-6xl font-bold tracking-tight leading-[1.05]"
            >
              Version control that{" "}
              <span className="text-primary">moves at the speed of your terminal.</span>
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.45 }}
              className="mt-5 text-lg text-on-surface-variant max-w-xl"
            >
              Gent is a modern, Git-shaped platform. A blazing-fast CLI for everyday work, and a
              beautiful web dashboard that updates the instant you push.
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15, duration: 0.45 }}
              className="mt-7 flex flex-wrap items-center gap-3"
            >
              <Button asChild size="lg">
                <Link href={PATHS.auth.signup}>
                  Get started — it's free <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href={PATHS.cli}>
                  <Terminal className="size-4" /> Browse the CLI
                </Link>
              </Button>
            </motion.div>
            <motion.ul
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.25, duration: 0.4 }}
              className="mt-6 flex flex-wrap items-center gap-4 text-sm text-on-surface-variant"
            >
              <li className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="size-4 text-primary" /> Free for personal use
              </li>
              <li className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="size-4 text-primary" /> macOS, Linux, Windows
              </li>
              <li className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="size-4 text-primary" /> Open beta
              </li>
            </motion.ul>
          </div>
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
          >
            <AnimatedTerminal
              script={[
                { type: "cmd", text: "gent init" },
                { type: "out", text: "✓ Initialised empty repository in .gent/" },
                { type: "cmd", text: 'gent commit -am "ship landing page"' },
                { type: "out", text: "[main 7f3a9b1] ship landing page · 3 files changed" },
                { type: "cmd", text: "gent push" },
                {
                  type: "out",
                  text: "✓ Pushed 3 objects · dashboard updated",
                  className: "text-secondary",
                },
              ]}
            />
          </motion.div>
        </div>
      </section>

      {/* Stat strip */}
      <section className="border-y border-outline-variant bg-surface-container-lowest">
        <div className="mx-auto max-w-7xl px-4 sm:px-8 py-10 grid gap-6 md:grid-cols-3 text-center md:text-left">
          {[
            { value: "< 200ms", label: "Median push latency" },
            { value: "30+", label: "Commands in the CLI" },
            { value: "100%", label: "Web ↔ CLI parity" },
          ].map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.07 }}
              className="space-y-1"
            >
              <p className="text-3xl md:text-4xl font-bold tracking-tight text-primary">{s.value}</p>
              <p className="text-sm text-on-surface-variant">{s.label}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-7xl px-4 sm:px-8 py-20 w-full">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-2xl"
        >
          <Badge tone="secondary">Features</Badge>
          <h2 className="mt-3 text-3xl md:text-4xl font-bold tracking-tight">
            Familiar concepts, modern feel.
          </h2>
          <p className="mt-3 text-on-surface-variant">
            If you've ever used Git, you already know Gent. We kept the model and dropped the
            sharp edges.
          </p>
        </motion.div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            {
              icon: Terminal,
              title: "Ergonomic CLI",
              desc: "Smart defaults, helpful errors, autocompletion. `gent docs` answers everything.",
            },
            {
              icon: Cloud,
              title: "Always-in-sync web",
              desc: "Push from the terminal and the dashboard reflects it within seconds. No refresh.",
            },
            {
              icon: GitBranch,
              title: "Branches & merges",
              desc: "Same model as Git — branch freely, merge cleanly, resolve conflicts with `gent resolve`.",
            },
            {
              icon: GitCommit,
              title: "Bulletproof history",
              desc: "Every action is journalled — `gent undo` walks you back safely.",
            },
            {
              icon: Sparkles,
              title: "Optional AI helpers",
              desc: "Explain commits, summarise releases, review staged changes. Plug in your provider.",
            },
            {
              icon: ShieldCheck,
              title: "JWT-secured",
              desc: "Standard access + refresh tokens, automatic rotation. Your code stays yours.",
            },
          ].map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
            >
              <Card interactive className="h-full">
                <CardContent className="p-5">
                  <span className="inline-flex size-11 items-center justify-center rounded-2xl bg-primary-container text-on-primary-container">
                    <f.icon className="size-5" />
                  </span>
                  <h3 className="mt-4 font-semibold text-foreground">{f.title}</h3>
                  <p className="mt-1 text-sm text-on-surface-variant">{f.desc}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="border-y border-outline-variant bg-surface-container-low">
        <div className="mx-auto max-w-7xl px-4 sm:px-8 py-20">
          <div className="max-w-2xl">
            <Badge tone="tertiary">How it works</Badge>
            <h2 className="mt-3 text-3xl md:text-4xl font-bold tracking-tight">
              From terminal to web in three steps.
            </h2>
          </div>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {[
              {
                step: "01",
                title: "Sign up & install",
                desc: "Create your free account, then `npm i -g @gent/cli` to install the binary.",
              },
              {
                step: "02",
                title: "Commit & push",
                desc: "Use the commands you already know. `init`, `add`, `commit`, `push`. Done.",
              },
              {
                step: "03",
                title: "Track it online",
                desc: "Open the dashboard. Every branch, commit and tag is ready to share.",
              },
            ].map((s, i) => (
              <motion.div
                key={s.step}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
              >
                <Card className="h-full">
                  <CardContent className="p-6">
                    <span className="font-mono text-sm text-primary">{s.step}</span>
                    <h3 className="mt-2 text-lg font-semibold">{s.title}</h3>
                    <p className="mt-2 text-sm text-on-surface-variant">{s.desc}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Workflow demo */}
      <section className="mx-auto max-w-7xl px-4 sm:px-8 py-20 w-full grid lg:grid-cols-2 gap-10 items-center">
        <div>
          <Badge tone="primary">
            <Zap className="size-3" /> Live sync
          </Badge>
          <h2 className="mt-3 text-3xl md:text-4xl font-bold tracking-tight">
            Terminal and dashboard, in lockstep.
          </h2>
          <p className="mt-3 text-on-surface-variant">
            Push from your CLI and the project page reflects the new commit, branch or tag without
            so much as a refresh — ideal for pairing or showing progress.
          </p>
          <Button asChild className="mt-6">
            <Link href={PATHS.auth.signup}>
              Try it now <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
        <AnimatedTerminal
          script={[
            { type: "cmd", text: 'gent commit -am "fix nav z-index"' },
            { type: "out", text: "[main a91b9f5] fix nav z-index" },
            { type: "cmd", text: "gent push" },
            { type: "out", text: "✓ Pushed 1 object", className: "text-secondary" },
            { type: "out", text: "→ Dashboard updated · view at gent.dev/abdo/atlas" },
          ]}
        />
      </section>

      {/* CTA */}
      <section className="border-t border-outline-variant bg-surface-container-low">
        <div className="mx-auto max-w-3xl px-4 sm:px-8 py-20 text-center">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
            Ready to give your project the home it deserves?
          </h2>
          <p className="mt-3 text-on-surface-variant">
            Create your account and start pushing in under a minute.
          </p>
          <div className="mt-7 flex items-center justify-center gap-3">
            <Button asChild size="lg">
              <Link href={PATHS.auth.signup}>Start now</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href={PATHS.cli}>Read the docs</Link>
            </Button>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
