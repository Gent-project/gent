"use client";

import type { LucideIcon } from "lucide-react";
import SiteShell from "./SiteShell";
import Reveal from "./Reveal";

export interface LegalSection {
  title: string;
  content: string;
}

export default function LegalPage({
  eyebrow,
  title,
  intro,
  icon: Icon,
  lastUpdated,
  sections,
}: {
  eyebrow: string;
  title: string;
  intro: string;
  icon: LucideIcon;
  lastUpdated: string;
  sections: LegalSection[];
}) {
  return (
    <SiteShell>
      <section className="mx-auto max-w-3xl px-6 pb-12 pt-36 text-center sm:pt-44">
        <Reveal>
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand/12 ring-1 ring-brand/30 glow-ring">
            <Icon className="h-8 w-8 text-brand" />
          </div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-brand">
            {eyebrow}
          </p>
          <h1 className="mt-4 font-display text-5xl font-bold tracking-tight sm:text-6xl">
            {title}
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-muted">
            {intro}
          </p>
          <p className="mt-4 font-mono text-xs text-faint">
            Last updated: {lastUpdated}
          </p>
        </Reveal>
      </section>

      <section className="mx-auto max-w-3xl px-6 pb-24">
        <div className="space-y-4">
          {sections.map((section, i) => (
            <Reveal key={section.title} delay={Math.min(i * 0.04, 0.3)} y={18}>
              <article className="group rounded-2xl border border-line bg-surface/40 p-6 backdrop-blur transition-colors hover:border-brand/30">
                <div className="flex items-baseline gap-3">
                  <span
                    aria-hidden
                    className="h-2 w-2 shrink-0 translate-y-2 rounded-full bg-brand transition-transform group-hover:scale-150"
                  />
                  <h2 className="font-display text-xl font-semibold">
                    {section.title}
                  </h2>
                </div>
                <p className="mt-3 pl-5 leading-7 text-muted">{section.content}</p>
              </article>
            </Reveal>
          ))}
        </div>
      </section>
    </SiteShell>
  );
}
