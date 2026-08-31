"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight,
  CheckCircle,
  Cloud,
  Code,
  Code2,
  GitMerge,
  GitPullRequest,
  Shield,
  Users,
  Zap,
} from "lucide-react";

import { AUTH_PATH } from "@/routes/path";
import SiteShell from "@/app/components/site/SiteShell";
import Reveal from "@/app/components/site/Reveal";
import TiltCard from "@/app/components/site/TiltCard";
import NotificationCard from "@/app/components/NotificationCard";

const services = [
  { badge: "Core", icon: Code2, title: "Repository Management", description: "Create, clone, and organize projects with an interface built around Gent objects." },
  { badge: "Collaboration", icon: Users, title: "Team Collaboration", description: "Real-time updates, comments, and notifications keep everyone in sync." },
  { badge: "Review", icon: GitPullRequest, title: "Pull Requests", description: "Review code changes before merging and keep quality standards high." },
  { badge: "Security", icon: Shield, title: "Security & Access", description: "Role-based access control and private repositories enforced by the backend." },
  { badge: "Performance", icon: Zap, title: "Lightning Fast", description: "Clone, commit, and push operations complete in seconds." },
  { badge: "Integration", icon: Cloud, title: "CI/CD Integration", description: "Automate testing and deployment with the tools you already use." },
];

const whyGent = [
  { title: "Lightweight & Efficient", description: "Minimal resource usage with maximum performance from an optimized architecture.", icon: Zap },
  { title: "Developer Friendly", description: "Built by developers for developers — no steep learning curve.", icon: Code },
  { title: "Scalable Infrastructure", description: "Grow your projects without limits; the infrastructure scales with you.", icon: Cloud },
  { title: "Advanced Branching", description: "Powerful branching strategies for complex workflows. Merge with confidence.", icon: GitMerge },
];

const stack = [
  { name: "React", code: "const App = () => {\n  return <div>Hello</div>;\n};" },
  { name: "Next.js", code: "export default function Page() {\n  return <h1>Welcome</h1>;\n}" },
  { name: "TypeScript", code: "interface User {\n  name: string;\n  age: number;\n}" },
  { name: "Python", code: "def hello():\n    name = 'Gent'\n    return name" },
  { name: "Go", code: "func main() {\n  fmt.Println(\"Hello\")\n}" },
  { name: "Rust", code: "fn main() {\n  let name = \"Gent\";\n}" },
  { name: "Node.js", code: "const http = require('http');\nhttp.createServer();" },
  { name: "Docker", code: "FROM node:18\nWORKDIR /app\nRUN npm install" },
];

const quickStart = [
  "Create your account",
  "Initialize repository",
  "Start collaborating",
  "Deploy with confidence",
];

export default function Services() {
  return (
    <SiteShell>
      {/* hero */}
      <section className="mx-auto grid max-w-6xl gap-12 px-6 pb-16 pt-36 sm:pt-44 md:grid-cols-2 md:items-center">
        <Reveal>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-brand">
            Services
          </p>
          <h1 className="mt-4 font-display text-5xl font-bold leading-[1.03] tracking-tight sm:text-6xl">
            Powerful services for
            <span className="text-gradient"> your projects.</span>
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-8 text-muted">
            Version control and collaboration built to streamline your workflow —
            from repository management to team access.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href={AUTH_PATH.LOGIN}
              className="group inline-flex items-center justify-center gap-2 rounded-xl bg-brand px-6 py-3.5 text-sm font-semibold text-brand-ink transition-transform hover:scale-[1.03]"
            >
              Sign in
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <Link
              href={AUTH_PATH.SIGNIN}
              className="inline-flex items-center justify-center rounded-xl border border-line-strong bg-surface/40 px-6 py-3.5 text-sm font-semibold text-fg backdrop-blur transition-colors hover:border-brand/50"
            >
              Start new project
            </Link>
          </div>
        </Reveal>

        <Reveal delay={0.1}>
          <TiltCard intensity={8} className="rounded-2xl border border-line bg-surface/50 p-8 backdrop-blur glow-soft">
            <h3 className="font-display text-2xl font-bold">Quick start</h3>
            <div className="mt-5 space-y-3.5">
              {quickStart.map((step) => (
                <div key={step} className="flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 shrink-0 text-brand" />
                  <span className="text-muted">{step}</span>
                </div>
              ))}
            </div>
          </TiltCard>
        </Reveal>
      </section>

      {/* services grid */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <Reveal className="mb-14 text-center">
          <h2 className="font-display text-4xl font-bold tracking-tight sm:text-5xl">
            Our core services
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-muted">
            Comprehensive solutions for modern development teams.
          </p>
        </Reveal>

        <div className="grid gap-5 md:grid-cols-3">
          {services.map((s, i) => (
            <Reveal key={s.title} delay={(i % 3) * 0.08}>
              <TiltCard
                intensity={7}
                glare={false}
                className="group h-full rounded-2xl border border-line bg-surface/40 p-6 backdrop-blur transition-colors hover:border-brand/40"
              >
                <div className="flex items-start justify-between">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand/12 ring-1 ring-brand/25">
                    <s.icon className="h-5 w-5 text-brand" />
                  </span>
                  <span className="rounded-full bg-brand/12 px-3 py-1 font-mono text-[11px] font-bold text-brand">
                    {s.badge}
                  </span>
                </div>
                <h3 className="mt-5 font-display text-lg font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted">{s.description}</p>
                <Link
                  href={AUTH_PATH.LOGIN}
                  className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-brand transition-transform group-hover:translate-x-1"
                >
                  Get started <ArrowRight className="h-4 w-4" />
                </Link>
              </TiltCard>
            </Reveal>
          ))}
        </div>
      </section>

      {/* why gent */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <Reveal className="mb-14 text-center">
          <h2 className="font-display text-4xl font-bold tracking-tight sm:text-5xl">
            Why developers choose Gent
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-muted">
            Features that make everyday development easier.
          </p>
        </Reveal>

        <div className="grid gap-5 md:grid-cols-2">
          {whyGent.map((f, i) => (
            <Reveal key={f.title} delay={(i % 2) * 0.08}>
              <div className="h-full rounded-2xl border border-line bg-surface/40 p-8 backdrop-blur transition-colors hover:border-brand/30">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand/12 ring-1 ring-brand/25">
                  <f.icon className="h-6 w-6 text-brand" />
                </span>
                <h3 className="mt-4 font-display text-xl font-semibold">{f.title}</h3>
                <p className="mt-2 leading-7 text-muted">{f.description}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* stack */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <Reveal className="mb-14 text-center">
          <h2 className="font-display text-4xl font-bold tracking-tight sm:text-5xl">
            Works with your stack
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-muted">
            Compatible with all major languages and frameworks.
          </p>
        </Reveal>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stack.map((tech, i) => (
            <Reveal key={tech.name} delay={(i % 4) * 0.06}>
              <div className="overflow-hidden rounded-2xl border border-line bg-surface/40 backdrop-blur transition-colors hover:border-brand/40">
                <div className="flex items-center gap-2 border-b border-line px-4 py-2.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-brand/60" />
                  <span className="font-mono text-xs font-semibold text-fg">
                    {tech.name}
                  </span>
                </div>
                <pre className="h-28 overflow-hidden bg-[#040a08]/60 p-4 font-mono text-[11px] leading-relaxed text-brand-2">
                  {tech.code}
                </pre>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-4xl px-6 py-16">
        <Reveal>
          <motion.div className="border-beam glow-soft relative overflow-hidden rounded-3xl bg-surface/60 p-12 text-center backdrop-blur">
            <h2 className="font-display text-4xl font-bold tracking-tight sm:text-5xl">
              Build your next project on Gent
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-muted">
              Create repositories, manage branches and members, and sync local
              work through the Gent CLI and API.
            </p>
            <Link
              href={AUTH_PATH.LOGIN}
              className="mt-8 inline-flex items-center gap-2 rounded-xl bg-brand px-8 py-4 text-sm font-semibold text-brand-ink transition-transform hover:scale-[1.03]"
            >
              Sign in now <ArrowRight className="h-5 w-5" />
            </Link>
          </motion.div>
        </Reveal>
      </section>

      <NotificationCard />
    </SiteShell>
  );
}
