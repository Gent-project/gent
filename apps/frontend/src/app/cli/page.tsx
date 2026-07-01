"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Search, Terminal, X } from "lucide-react";

import { MarketingNav } from "@/components/layout/marketing-nav";
import { MarketingFooter } from "@/components/layout/marketing-footer";
import { CommandCard } from "@/components/features/cli/command-card";
import { AnimatedTerminal } from "@/components/features/cli/animated-terminal";
import {
  CLI_CATEGORIES,
  CLI_COMMANDS,
  type CliCommandCategory,
} from "@/lib/cli-commands";
import { cn } from "@/lib/utils";

/**
 * CLI Explorer — `/cli`
 *
 * Public, animated reference for every Gent CLI command. Users can:
 *   - Filter by category in a sticky sidebar.
 *   - Search command names / summaries with instant fuzzy match.
 *   - Expand any card to see syntax, examples and related commands.
 *
 * The whole list is static (see `src/lib/cli-commands.ts`) so the page works
 * offline and gets fully cached by Next.js.
 */
export default function CliExplorerPage() {
  const [activeCategory, setActiveCategory] = useState<CliCommandCategory | "all">("all");
  const [query, setQuery] = useState("");
  const [highlighted, setHighlighted] = useState<string | undefined>();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return CLI_COMMANDS.filter((c) => {
      if (activeCategory !== "all" && c.category !== activeCategory) return false;
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        c.summary.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q) ||
        c.syntax.toLowerCase().includes(q)
      );
    });
  }, [activeCategory, query]);

  const counts = useMemo(() => {
    const result: Record<string, number> = { all: CLI_COMMANDS.length };
    for (const cat of CLI_CATEGORIES) {
      result[cat.id] = CLI_COMMANDS.filter((c) => c.category === cat.id).length;
    }
    return result;
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      <MarketingNav />

      {/* Hero */}
      <section className="relative gradient-mesh border-b border-outline-variant">
        <div className="mx-auto max-w-7xl px-4 sm:px-8 py-16 grid lg:grid-cols-2 gap-10 items-center">
          <div>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="inline-flex items-center gap-2 rounded-full border border-outline-variant bg-surface-container-lowest/80 backdrop-blur px-3 py-1 text-xs font-semibold uppercase tracking-widest text-on-surface-variant"
            >
              <Terminal className="size-3" /> CLI reference
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05, duration: 0.4 }}
              className="mt-4 text-4xl sm:text-5xl font-bold tracking-tight text-balance"
            >
              Everything Gent can do from your terminal.
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.4 }}
              className="mt-4 text-on-surface-variant max-w-xl"
            >
              Click a command to expand its docs, examples and friends. Every
              snippet copies in one tap.
            </motion.p>
          </div>
          <AnimatedTerminal
            script={[
              { type: "cmd", text: "gent init" },
              { type: "out", text: "✓ Initialised empty repository in .gent/" },
              { type: "cmd", text: "gent add ." },
              { type: "cmd", text: 'gent commit -m "first commit"' },
              { type: "out", text: "[main 9c2f1d2] first commit · 14 files changed" },
              { type: "cmd", text: "gent push origin main" },
              {
                type: "out",
                text: "✓ Pushed 14 objects · branch main updated",
                className: "text-secondary",
              },
            ]}
          />
        </div>
      </section>

      {/* Body */}
      <section className="mx-auto max-w-7xl px-4 sm:px-8 py-10 w-full">
        {/* Search bar */}
        <div className="sticky top-16 z-20 -mx-4 sm:mx-0 mb-8">
          <div className="glass border border-outline-variant rounded-2xl px-3 py-2 flex items-center gap-2">
            <Search className="size-4 text-on-surface-variant" />
            <input
              type="search"
              placeholder="Search commands… (e.g. branch, push, --hard)"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="flex-1 bg-transparent outline-none text-sm"
              aria-label="Search CLI commands"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                className="rounded-full p-1 hover:bg-surface-container"
                aria-label="Clear search"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-[220px_1fr]">
          {/* Sidebar: categories */}
          <aside className="space-y-1 lg:sticky lg:top-36 lg:self-start">
            <CategoryButton
              active={activeCategory === "all"}
              count={counts.all}
              onClick={() => setActiveCategory("all")}
            >
              All commands
            </CategoryButton>
            {CLI_CATEGORIES.map((cat) => (
              <CategoryButton
                key={cat.id}
                active={activeCategory === cat.id}
                count={counts[cat.id]}
                onClick={() => setActiveCategory(cat.id)}
              >
                {cat.label}
              </CategoryButton>
            ))}
          </aside>

          {/* Commands list */}
          <div className="space-y-3">
            {filtered.length === 0 ? (
              <p className="text-sm text-on-surface-variant text-center py-12">
                No commands match "{query}". Try a different keyword.
              </p>
            ) : (
              filtered.map((c, i) => (
                <CommandCard
                  key={c.name}
                  command={c}
                  index={i}
                  initiallyOpen={highlighted === c.name}
                  onSelectRelated={(name) => {
                    setHighlighted(name);
                    setActiveCategory("all");
                    setQuery("");
                    // Scroll into view after the next paint
                    requestAnimationFrame(() => {
                      const el = document.getElementById(`cmd-${name}`);
                      el?.scrollIntoView({ behavior: "smooth", block: "center" });
                    });
                  }}
                />
              ))
            )}
          </div>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}

function CategoryButton({
  active,
  count,
  onClick,
  children,
}: {
  active: boolean;
  count: number;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "group flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-sm transition-all",
        active
          ? "bg-primary-container text-on-primary-container font-semibold"
          : "text-on-surface-variant hover:bg-surface-container-low hover:text-foreground",
      )}
    >
      <span>{children}</span>
      <span className="text-xs text-on-surface-variant/80 tabular-nums">{count}</span>
    </button>
  );
}
