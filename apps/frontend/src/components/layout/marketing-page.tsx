"use client";

import { motion } from "framer-motion";

import { MarketingNav } from "./marketing-nav";
import { MarketingFooter } from "./marketing-footer";
import { Badge } from "@/components/ui/badge";

/**
 * MarketingPage — common chrome for static content pages
 * (privacy, terms, faq, anything else marketing).
 *
 * Provides the nav, footer, a typographic hero with eyebrow badge,
 * and a prose container for the body content.
 */
export function MarketingPage({
  eyebrow,
  title,
  subtitle,
  updated,
  children,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  updated?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col">
      <MarketingNav />

      <section className="relative gradient-mesh border-b border-outline-variant">
        <div className="mx-auto max-w-3xl px-4 sm:px-8 py-16 text-center">
          <Badge tone="primary">{eyebrow}</Badge>
          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="mt-4 text-4xl sm:text-5xl font-bold tracking-tight text-balance"
          >
            {title}
          </motion.h1>
          {subtitle && (
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.05 }}
              className="mt-3 text-on-surface-variant text-balance"
            >
              {subtitle}
            </motion.p>
          )}
          {updated && (
            <p className="mt-4 text-xs uppercase tracking-widest text-on-surface-variant">
              Last updated · {updated}
            </p>
          )}
        </div>
      </section>

      <main className="mx-auto w-full max-w-3xl px-4 sm:px-8 py-14">
        <article
          className="
            prose prose-sm sm:prose-base max-w-none
            [&_h2]:mt-10 [&_h2]:mb-3 [&_h2]:text-xl [&_h2]:font-semibold
            [&_h3]:mt-6 [&_h3]:mb-2 [&_h3]:text-base [&_h3]:font-semibold
            [&_p]:text-on-surface-variant [&_p]:leading-relaxed [&_p]:mt-3
            [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:text-on-surface-variant
            [&_li]:mt-1.5
            [&_a]:text-primary [&_a]:underline-offset-4 hover:[&_a]:underline
            [&_code]:rounded-md [&_code]:bg-surface-container [&_code]:px-1.5
            [&_code]:py-0.5 [&_code]:text-[0.85em] [&_code]:font-mono
          "
        >
          {children}
        </article>
      </main>

      <MarketingFooter />
    </div>
  );
}
