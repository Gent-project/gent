"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
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
import { useSelector } from "react-redux";

import SharedFooter from "@/app/components/SharedFooter";
import SharedNavigation from "@/app/components/SharedNavigation";
import { RootState } from "@/store";

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
  const isDark = useSelector((state: RootState) => state.theme.isDark);
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

  const page = isDark
    ? "bg-[#0f1419] text-white"
    : "bg-[#f8faf3] text-[#223022]";
  const muted = isDark ? "text-white/65" : "text-[#4a5f4a]";
  const panel = isDark
    ? "border-white/10 bg-white/[0.04]"
    : "border-[#5A7863]/15 bg-white";
  const input = isDark
    ? "border-white/10 bg-white/10 text-white placeholder:text-white/45"
    : "border-[#5A7863]/20 bg-white text-[#223022] placeholder:text-[#5A7863]/55";
  const accent = isDark ? "text-[#7dd3fc]" : "text-[#5A7863]";

  return (
    <div className={`min-h-screen ${page}`}>
      <SharedNavigation />

      <main className="pt-24">
        <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="max-w-3xl"
          >
            <p className={`text-sm font-semibold uppercase ${accent}`}>
              Gent FAQ
            </p>
            <h1 className="mt-3 text-4xl font-bold tracking-normal sm:text-5xl">
              Answers for the current Gent website.
            </h1>
            <p className={`mt-4 max-w-2xl text-lg leading-8 ${muted}`}>
              Focused on what exists now: the CLI, backend API, dashboard,
              repositories, files, branches, members, and account flows.
            </p>
          </motion.div>

          <div className="relative mt-8 max-w-2xl">
            <Search
              className={`absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 ${muted}`}
            />
            <input
              type="search"
              placeholder="Search Gent questions"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className={`w-full rounded-lg border py-3 pl-12 pr-4 outline-none transition focus:ring-2 focus:ring-[#5A7863]/25 ${input}`}
            />
          </div>
        </section>

        <section className="mx-auto max-w-4xl px-4 pb-16 sm:px-6 lg:px-8">
          {filteredCategories.length === 0 ? (
            <div className={`rounded-lg border p-6 text-center ${panel}`}>
              <p className={muted}>No FAQ entries match this search.</p>
            </div>
          ) : (
            <div className="space-y-10">
              {filteredCategories.map((category, categoryIndex) => {
                const Icon = category.icon;

                return (
                  <motion.div
                    key={category.category}
                    initial={{ opacity: 0, y: 12 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.25 }}
                  >
                    <div className="mb-4 flex items-center gap-3">
                      <span
                        className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                          isDark ? "bg-white/10" : "bg-white"
                        }`}
                      >
                        <Icon className={`h-5 w-5 ${accent}`} />
                      </span>
                      <h2 className="text-2xl font-bold">
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
                            className={`overflow-hidden rounded-lg border ${panel}`}
                          >
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedIndex(isExpanded ? null : itemId)
                              }
                              className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                            >
                              <span className="text-base font-semibold">
                                {item.q}
                              </span>
                              <ChevronDown
                                className={`h-5 w-5 shrink-0 transition ${
                                  isExpanded ? "rotate-180" : ""
                                } ${accent}`}
                              />
                            </button>

                            {isExpanded ? (
                              <div
                                className={`border-t px-5 pb-5 pt-4 leading-7 ${
                                  isDark
                                    ? "border-white/10 text-white/75"
                                    : "border-[#5A7863]/15 text-[#3b4e3b]"
                                }`}
                              >
                                {item.a}
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </section>
      </main>

      <SharedFooter />
    </div>
  );
}
