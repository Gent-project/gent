"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown } from "lucide-react";

import { MarketingNav } from "@/components/layout/marketing-nav";
import { MarketingFooter } from "@/components/layout/marketing-footer";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { CLI_NPM_PACKAGE, installCommand } from "@/lib/gent-urls";

/**
 * /faq — common questions with animated accordion answers.
 *
 * Static client component so the open/close animation feels instant. Each
 * answer is a short paragraph + optional inline code snippet.
 */
const FAQS: { q: string; a: React.ReactNode; tag: string }[] = [
  {
    tag: "general",
    q: "What is Gent?",
    a: "Gent is a modern, Git-shaped version control platform. There's a fast CLI for everyday work and a beautiful web dashboard that updates the instant you push.",
  },
  {
    tag: "general",
    q: "Is Gent free?",
    a: "Yes. Gent is free for personal use today and doesn't ask for a credit card. If we add paid tiers in the future they will be additive — you'll never be billed retroactively.",
  },
  {
    tag: "cli",
    q: "How do I install the CLI?",
    a: (
      <>
        Install it from npm:
        <pre className="mt-3 rounded-xl bg-inverse-surface text-on-inverse-surface p-3 text-xs overflow-x-auto">
          {installCommand}
        </pre>
        Then run <code>gent setup</code> once and you're done.
      </>
    ),
  },
  {
    tag: "cli",
    q: "How do I clone a project?",
    a: (
      <>
        Open the project on the dashboard and copy the URL shown next to the
        "Clone" button. It looks like{" "}
        <code>https://gent-api.onrender.com/api/repos/&lt;owner_id&gt;/&lt;repo_name&gt;</code>.
        Paste it after <code>gent clone</code>:
        <pre className="mt-3 rounded-xl bg-inverse-surface text-on-inverse-surface p-3 text-xs overflow-x-auto">
{`gent clone https://gent-api.onrender.com/api/repos/10/first-project`}
        </pre>
      </>
    ),
  },
  {
    tag: "cli",
    q: "How do I push my first commit?",
    a: (
      <>
        Inside your project folder:
        <pre className="mt-3 rounded-xl bg-inverse-surface text-on-inverse-surface p-3 text-xs overflow-x-auto">
{`gent init
gent add .
gent commit -m "first commit"
gent push origin main`}
        </pre>
      </>
    ),
  },
  {
    tag: "web",
    q: "Why isn't my push showing on the web?",
    a: "The dashboard polls the server every 12 seconds. If you don't see your push after a refresh, check `gent status` for unpushed commits and confirm with `gent log`.",
  },
  {
    tag: "web",
    q: "Can I switch between light and dark mode?",
    a: "Yes. Use the moon/sun button in the top bar, or go to Settings → Appearance. Your choice is remembered on this device.",
  },
  {
    tag: "data",
    q: "Where is my data stored?",
    a: "All commits, branches and tags live on Gent's API at gent-api.onrender.com. You can export everything any time with `gent clone`.",
  },
  {
    tag: "data",
    q: "How do I delete a project?",
    a: 'Open the project page on the dashboard and click "Delete". This is permanent and cannot be undone.',
  },
  {
    tag: "data",
    q: "How do I delete my account?",
    a: (
      <>
        Email <a href="mailto:hello@gent.dev">hello@gent.dev</a> from the
        address on your account and we'll remove everything within 14 days.
      </>
    ),
  },
];

export default function FAQPage() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <div className="min-h-screen flex flex-col">
      <MarketingNav />

      <section className="relative gradient-mesh border-b border-outline-variant">
        <div className="mx-auto max-w-3xl px-4 sm:px-8 py-16 text-center">
          <Badge tone="secondary">FAQ</Badge>
          <h1 className="mt-4 text-4xl sm:text-5xl font-bold tracking-tight text-balance">
            Quick answers to common questions.
          </h1>
          <p className="mt-3 text-on-surface-variant">
            Don't see what you need? Email{" "}
            <a href="mailto:hello@gent.dev" className="text-primary hover:underline">
              hello@gent.dev
            </a>
            .
          </p>
        </div>
      </section>

      <main className="mx-auto w-full max-w-3xl px-4 sm:px-8 py-14 space-y-3">
        {FAQS.map((item, i) => {
          const open = openIndex === i;
          return (
            <article
              key={item.q}
              className={cn(
                "rounded-2xl border bg-surface-container-lowest transition-all",
                open ? "border-primary/40 shadow-soft" : "border-outline-variant",
              )}
            >
              <button
                type="button"
                onClick={() => setOpenIndex(open ? null : i)}
                className="w-full text-left px-5 py-4 flex items-center gap-3"
                aria-expanded={open}
              >
                <Badge tone="outline" size="sm">
                  {item.tag}
                </Badge>
                <h3 className="flex-1 font-semibold text-foreground">{item.q}</h3>
                <ChevronDown
                  className={cn(
                    "size-4 text-on-surface-variant transition-transform",
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
                    transition={{ duration: 0.22 }}
                    className="overflow-hidden"
                  >
                    <div className="px-5 pb-5 text-sm text-on-surface-variant leading-relaxed">
                      {item.a}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </article>
          );
        })}

        <p className="pt-6 text-center text-sm text-on-surface-variant">
          The CLI is published as <code>{CLI_NPM_PACKAGE}</code> on npm. Run{" "}
          <code>{installCommand}</code> to install it.
        </p>
      </main>

      <MarketingFooter />
    </div>
  );
}
