"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronDown,
  Code2,
  GitBranch,
  Lock,
  Search,
  Server,
  Terminal,
  Users,
} from "lucide-react";

import SiteShell from "@/app/components/site/SiteShell";
import Reveal from "@/app/components/site/Reveal";

const faqCategories = [
  {
    category: "Gent Basics",
    icon: GitBranch,
    questions: [
      {
        q: "What is Gent?",
        a: "Gent is this project's lightweight version control system. It has a CLI, a Django API, and a web dashboard for repositories, branches, commits, tags, files, and repository access.",
      },
      {
        q: "Is Gent the same as GitHub?",
        a: "No. Gent uses its own CLI commands and backend API paths. The website should show Gent workflows, not GitHub instructions.",
      },
      {
        q: "What does the website do?",
        a: "The website lets authenticated users create repositories, browse repository files, switch branches, inspect commits, manage tags, copy CLI remotes, and open repository settings.",
      },
    ],
  },
  {
    category: "CLI",
    icon: Terminal,
    questions: [
      {
        q: "How do I install the CLI?",
        a: "Install the package with npm install -g gent-cli, then sign in with gent login.",
      },
      {
        q: "How do I connect a local folder to a repository?",
        a: "Run gent init, add and commit your files, then set the remote with gent remote add origin using the API repository URL shown in the dashboard.",
      },
      {
        q: "Which remote URL format works with the CLI?",
        a: "Use https://gent-api.onrender.com/api/repos/<owner_id>/<repo_name>. The dashboard clone section uses this same structure.",
      },
      {
        q: "Where can I read the command list?",
        a: "Open the CLI Docs page from the top banner. It groups commands for setup, staging, history, branches, remotes, account, safety, and inspection.",
      },
    ],
  },
  {
    category: "Repositories",
    icon: Code2,
    questions: [
      {
        q: "Can I create an empty repository?",
        a: "Yes. New repositories start with the default branch. The Code tab can create the first text file and commit it without needing an upload first.",
      },
      {
        q: "What repository names are valid?",
        a: "Repository names can contain letters, numbers, dashes, and underscores. Dots and spaces are rejected by the backend.",
      },
      {
        q: "Can I delete a repository?",
        a: "Repository owners can delete a repository from repository settings by typing the repository name to confirm the action.",
      },
      {
        q: "Why does sorting matter?",
        a: "The dashboard repository list can be sorted by newest, oldest, or name without changing the repositories stored in the backend.",
      },
    ],
  },
  {
    category: "Files and Branches",
    icon: Server,
    questions: [
      {
        q: "Does the Code tab follow the selected branch?",
        a: "Yes. File browsing is tied to the selected branch commit and tree, so switching branches should show that branch's files only.",
      },
      {
        q: "Does the code viewer support formatting?",
        a: "The code viewer renders source in a monospace block with lightweight syntax highlighting for common code tokens.",
      },
      {
        q: "Can I create branches from the website?",
        a: "Branches can be created after the repository has an initial commit. Empty repositories need a first file or upload first.",
      },
    ],
  },
  {
    category: "Access",
    icon: Users,
    questions: [
      {
        q: "Who can see a private repository?",
        a: "Private repositories are available to the owner and users granted access through the backend repository member system.",
      },
      {
        q: "Can repository access be managed in the dashboard?",
        a: "Yes. The backend exposes repository member endpoints. Repository owners can add registered users by email and remove existing members.",
      },
      {
        q: "Can I remove the owner from a repository?",
        a: "No. The backend returns the owner as part of the access list, but the owner cannot be removed through the member endpoint.",
      },
    ],
  },
  {
    category: "Account",
    icon: Lock,
    questions: [
      {
        q: "How is the signed-in user shown?",
        a: "The dashboard reads the authenticated profile and displays the real name, username, or email prefix instead of a generic user label.",
      },
      {
        q: "What happens if my session expires?",
        a: "The frontend tries to refresh the access token. If refresh fails, local auth state is cleared and the app returns to sign in.",
      },
      {
        q: "Can I change my password?",
        a: "The account settings page calls the backend password-change endpoint and shows validation errors returned by the API.",
      },
    ],
  },
];

export default function FAQ() {
  const [expandedIndex, setExpandedIndex] = useState<string | null>("0-0");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredCategories = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return faqCategories;
    return faqCategories
      .map((category) => ({
        ...category,
        questions: category.questions.filter(
          (item) =>
            item.q.toLowerCase().includes(query) ||
            item.a.toLowerCase().includes(query),
        ),
      }))
      .filter((category) => category.questions.length > 0);
  }, [searchQuery]);

  return (
    <SiteShell>
      <section className="mx-auto max-w-4xl px-6 pb-10 pt-36 text-center sm:pt-44">
        <Reveal>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-brand">
            Gent FAQ
          </p>
          <h1 className="mx-auto mt-4 max-w-3xl font-display text-5xl font-bold leading-[1.05] tracking-tight sm:text-6xl">
            Questions,
            <span className="text-gradient"> answered.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-muted">
            Focused on what exists now — the CLI, backend API, dashboard,
            repositories, files, branches, members, and account flows.
          </p>
        </Reveal>

        <Reveal delay={0.1} className="relative mx-auto mt-8 max-w-xl">
          <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-faint" />
          <input
            type="search"
            placeholder="Search Gent questions…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-2xl border border-line bg-surface/50 py-3.5 pl-12 pr-4 text-fg outline-none backdrop-blur transition focus:border-brand/50 focus:ring-2 focus:ring-brand/20"
          />
        </Reveal>
      </section>

      <section className="mx-auto max-w-3xl px-6 pb-16">
        {filteredCategories.length === 0 ? (
          <div className="rounded-2xl border border-line bg-surface/40 p-8 text-center text-muted backdrop-blur">
            No FAQ entries match this search.
          </div>
        ) : (
          <div className="space-y-10">
            {filteredCategories.map((category, categoryIndex) => {
              const Icon = category.icon;
              return (
                <Reveal key={category.category} y={16}>
                  <div className="mb-4 flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand/12 ring-1 ring-brand/25">
                      <Icon className="h-5 w-5 text-brand" />
                    </span>
                    <h2 className="font-display text-2xl font-bold">
                      {category.category}
                    </h2>
                  </div>

                  <div className="space-y-3">
                    {category.questions.map((item, questionIndex) => {
                      const itemId = `${categoryIndex}-${questionIndex}`;
                      const isExpanded = expandedIndex === itemId;
                      return (
                        <div
                          key={item.q}
                          className={`overflow-hidden rounded-2xl border bg-surface/40 backdrop-blur transition-colors ${
                            isExpanded ? "border-brand/40" : "border-line"
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedIndex(isExpanded ? null : itemId)
                            }
                            className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                          >
                            <span className="font-medium">{item.q}</span>
                            <ChevronDown
                              className={`h-5 w-5 shrink-0 text-brand transition-transform duration-300 ${
                                isExpanded ? "rotate-180" : ""
                              }`}
                            />
                          </button>
                          <AnimatePresence initial={false}>
                            {isExpanded && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                              >
                                <p className="border-t border-line px-5 pb-5 pt-4 leading-7 text-muted">
                                  {item.a}
                                </p>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      );
                    })}
                  </div>
                </Reveal>
              );
            })}
          </div>
        )}
      </section>
    </SiteShell>
  );
}
