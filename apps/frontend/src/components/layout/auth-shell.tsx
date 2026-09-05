"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Terminal, GitBranch, Zap, ShieldCheck } from "lucide-react";

import { Logo } from "@/components/ui/logo";
import { PATHS } from "@/lib/paths";
import { ThemeToggle } from "./theme-toggle";

/**
 * AuthShell — two-pane layout used by /auth/login and /auth/signup.
 *
 * Left pane is the form (passed in as children); right pane is a decorative
 * "marketing" card that explains what Gent is. On small screens the right
 * pane collapses and only the form is shown.
 */
export function AuthShell({
  children,
  title,
  subtitle,
}: {
  children: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  const benefits = [
    { icon: Terminal, text: "Drive everything from a fast, ergonomic CLI." },
    { icon: GitBranch, text: "Familiar Git-shaped branches, commits, tags." },
    { icon: Zap, text: "Pushes appear on the web within seconds." },
    { icon: ShieldCheck, text: "JWT-secured. Your code stays yours." },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-30 glass border-b border-outline-variant/60">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-8">
          <Link href={PATHS.home} className="inline-flex">
            <Logo />
          </Link>
          <ThemeToggle />
        </div>
      </header>

      <div className="flex-1 grid lg:grid-cols-2">
        {/* Left: form */}
        <div className="flex items-center justify-center p-6 sm:p-10">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="w-full max-w-md space-y-6"
          >
            <div>
              <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
              <p className="mt-2 text-sm text-on-surface-variant">{subtitle}</p>
            </div>
            {children}
          </motion.div>
        </div>

        {/* Right: hero */}
        <div className="hidden lg:flex items-center justify-center p-10 gradient-mesh relative overflow-hidden">
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1, duration: 0.5 }}
            className="relative max-w-md w-full rounded-3xl border border-outline-variant bg-surface-container-lowest/80 glass p-7 shadow-soft"
          >
            <div className="flex items-center gap-2 mb-5">
              <span className="size-2.5 rounded-full bg-error" />
              <span className="size-2.5 rounded-full bg-tertiary" />
              <span className="size-2.5 rounded-full bg-secondary" />
              <span className="ml-2 text-xs text-on-surface-variant font-mono">
                ~/projects/atlas $
              </span>
            </div>
            <div className="font-mono text-sm space-y-2 leading-relaxed">
              <Typed text="gent init" delay={0.4} />
              <Typed text="gent add ." delay={1.1} />
              <Typed text='gent commit -m "first commit"' delay={1.8} />
              <Typed text="gent push origin main" delay={2.7} />
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 3.6 }}
                className="text-secondary"
              >
                ✓ Pushed 12 objects · 1 branch updated
              </motion.p>
            </div>
            <div className="mt-7 grid grid-cols-2 gap-3">
              {benefits.map((b, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 + i * 0.08 }}
                  className="flex items-start gap-2 rounded-xl bg-surface-container-low/70 p-3"
                >
                  <b.icon className="size-4 mt-0.5 text-primary" />
                  <span className="text-xs text-on-surface-variant leading-snug">
                    {b.text}
                  </span>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

/** Lazily-typed terminal line, character by character. */
function Typed({ text, delay = 0 }: { text: string; delay?: number }) {
  return (
    <motion.p
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay }}
      className="text-foreground"
    >
      <span className="text-primary">$</span>{" "}
      <motion.span
        initial={{ width: 0 }}
        animate={{ width: "auto" }}
        transition={{ delay, duration: text.length * 0.04, ease: "linear" }}
        className="inline-block overflow-hidden whitespace-pre align-bottom"
      >
        {text}
      </motion.span>
    </motion.p>
  );
}
