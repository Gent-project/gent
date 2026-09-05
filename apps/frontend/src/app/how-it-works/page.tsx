"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  ArrowRight,
  Clock,
  Code,
  GitBranch,
  GitMerge,
  Lock,
  Users,
  X,
} from "lucide-react";

import SiteShell from "@/app/components/site/SiteShell";
import Reveal from "@/app/components/site/Reveal";
import TiltCard from "@/app/components/site/TiltCard";

interface Guide {
  id: number;
  title: string;
  description: string;
  badge: string;
  category: string;
  readTime: string;
  content: string;
}

const guides: Guide[] = [
  {
    id: 1,
    title: "Repository Management: Organize Your Code",
    description:
      "Create, manage, and explore repositories while keeping your projects organized in one place.",
    badge: "Repository",
    category: "repository",
    readTime: "5 min read",
    content: `# Repository Management: Organize Your Code
Gent provides a simple way to create and manage software repositories from one place.
## Create a Repository
Start a new project by creating a repository and providing the basic information about your project. You can define the name, description, and visibility to fit your project.
## Manage Repository Information
Repository owners can update repository information when project details change. Gent keeps management organized so users easily access their projects.
## Explore Your Repository
After creating a repository, explore its branches, files, commits, and other available information.
## Repository Ownership
Permissions are managed by role. Owners get management actions; other users get access according to the permissions granted to them.`,
  },
  {
    id: 2,
    title: "Branch Management: Work on Different Versions",
    description:
      "Create branches, switch between them, and explore different versions of your project without touching main.",
    badge: "Branches",
    category: "branches",
    readTime: "5 min read",
    content: `# Branch Management: Work on Different Versions
Branches let developers work on different versions of a project while keeping the main line organized.
## Create a Branch
Create a new branch from an existing one to work on a feature or make changes independently.
## Switch Between Branches
Select a branch and explore the files that belong to it — making it easy to work with different versions of the same repository.
## Branch Files
Each branch can contain its own version of the files. When you switch, Gent loads the corresponding tree so you explore the correct version.
## A Typical Workflow
Select a branch, create a new one when needed, make changes, commit, and compare when necessary.`,
  },
  {
    id: 3,
    title: "Authentication: Secure Access to Your Account",
    description:
      "Login, registration, password recovery, and password management for your Gent account.",
    badge: "Authentication",
    category: "authentication",
    readTime: "4 min read",
    content: `# Authentication: Secure Access to Your Account
Authentication lets users securely access their accounts and repository features.
## Create an Account
New users register through the registration form, then sign in and access their Gent workspace.
## Login
Registered users sign in with their credentials. Authentication keeps personal repositories tied to the correct user.
## Forgot & Reset Password
If a user forgets their password, Gent provides a recovery flow, and users set a new password through the reset process.
## Change Password
Authenticated users can change their current password from account settings.`,
  },
  {
    id: 4,
    title: "Collaborators: Work Together on Repositories",
    description:
      "Manage repository collaborators and control who can work with your projects.",
    badge: "Collaboration",
    category: "collaboration",
    readTime: "5 min read",
    content: `# Collaborators: Work Together on Repositories
Gent provides collaboration features that let owners manage who works with their projects.
## Add Collaborators
Owners add users as collaborators when they want other developers to work with the repository.
## Manage Access
Collaborators receive access according to the permissions provided, so owners keep control over important actions.
## Repository Ownership
The owner remains responsible for the repository; some actions are restricted to users with the required permissions.
## Working Together
Create a repository, add collaborators, branch for tasks, commit changes, then review and compare.`,
  },
  {
    id: 5,
    title: "Repository Files: Explore Your Project",
    description:
      "Browse files and folders, switch branches, and inspect the contents of your project.",
    badge: "File Browser",
    category: "files",
    readTime: "5 min read",
    content: `# Repository Files: Explore Your Project
Gent's file browser lets you explore the structure and contents of your projects.
## Browse Files and Folders
Open a repository and navigate its folders and files. The tree makes it easy to understand a project's structure without leaving the platform.
## Explore a Branch
The browser works with branches — select a branch and view the files belonging to that version.
## Open & Create Files
Select a file to inspect its contents. Users with permission can create files, which become part of the repository structure.`,
  },
  {
    id: 6,
    title: "Commits & Diff: Track and Compare Changes",
    description:
      "Explore commit history and compare changes to see exactly what was added, removed, or modified.",
    badge: "Commits",
    category: "commits",
    readTime: "6 min read",
    content: `# Commits & Diff: Track and Compare Changes
Commits provide a history of changes to a repository. Gent lets you explore that history and inspect individual commits.
## Commit History
View the history and inspect the changes for previous commits. Each commit carries identifying information about when and how a change was made.
## Commit Details
Opening a commit provides more information about the selected change, helping you understand the evolution of your project.
## Compare Changes
The diff view compares versions of the code — added and removed lines can be inspected directly.
## Development History
Combining branches, commits, and diffs gives a clearer picture of how your repository changes over time.`,
  },
];

const filters = [
  { id: "all", label: "All", icon: Activity },
  { id: "repository", label: "Repositories", icon: GitBranch },
  { id: "branches", label: "Branches", icon: GitMerge },
  { id: "authentication", label: "Auth", icon: Lock },
  { id: "collaboration", label: "Collaborators", icon: Users },
  { id: "files", label: "Files", icon: Code },
  { id: "commits", label: "Commits", icon: GitBranch },
];

function GuideBody({ content }: { content: string }) {
  const blocks = content.trim().split("\n").filter(Boolean);
  return (
    <div className="space-y-3">
      {blocks.map((line, i) => {
        if (line.startsWith("# ")) return null;
        if (line.startsWith("## "))
          return (
            <h3 key={i} className="pt-2 font-display text-lg font-semibold text-fg">
              {line.slice(3)}
            </h3>
          );
        return (
          <p key={i} className="leading-7 text-muted">
            {line}
          </p>
        );
      })}
    </div>
  );
}

export default function HowItWorksPage() {
  const [selected, setSelected] = useState<Guide | null>(null);
  const [filter, setFilter] = useState("all");

  const visible = useMemo(
    () => (filter === "all" ? guides : guides.filter((g) => g.category === filter)),
    [filter],
  );

  return (
    <SiteShell>
      <section className="mx-auto max-w-4xl px-6 pb-10 pt-36 text-center sm:pt-44">
        <Reveal>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-brand">
            How it works
          </p>
          <h1 className="mx-auto mt-4 max-w-3xl font-display text-5xl font-bold leading-[1.05] tracking-tight sm:text-6xl">
            The mechanics of
            <span className="text-gradient"> Gent, explained.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-muted">
            Short guides to every core feature — repositories, branches, auth,
            collaborators, files, and commits.
          </p>
        </Reveal>

        <Reveal delay={0.1} className="mt-8 flex flex-wrap justify-center gap-2">
          {filters.map((f) => {
            const active = filter === f.id;
            return (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-medium transition-colors ${
                  active
                    ? "border-brand/50 bg-brand/15 text-fg"
                    : "border-line bg-surface/40 text-muted hover:text-fg"
                }`}
              >
                <f.icon className="h-3.5 w-3.5" />
                {f.label}
              </button>
            );
          })}
        </Reveal>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-24">
        <motion.div layout className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence mode="popLayout">
            {visible.map((guide, i) => (
              <motion.div
                key={guide.id}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.4, delay: (i % 3) * 0.05 }}
              >
                <TiltCard
                  intensity={7}
                  glare={false}
                  onClick={() => setSelected(guide)}
                  className="group flex h-full cursor-pointer flex-col rounded-2xl border border-line bg-surface/40 p-6 backdrop-blur transition-colors hover:border-brand/40"
                >
                  <div className="flex items-center justify-between">
                    <span className="rounded-full bg-brand/12 px-3 py-1 font-mono text-[11px] font-bold text-brand">
                      {guide.badge}
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs text-faint">
                      <Clock className="h-3.5 w-3.5" />
                      {guide.readTime}
                    </span>
                  </div>
                  <h3 className="mt-4 font-display text-xl font-semibold leading-snug">
                    {guide.title}
                  </h3>
                  <p className="mt-2 flex-1 text-sm leading-6 text-muted">
                    {guide.description}
                  </p>
                  <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-brand transition-transform group-hover:translate-x-1">
                    Read guide <ArrowRight className="h-4 w-4" />
                  </span>
                </TiltCard>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      </section>

      {/* modal */}
      <AnimatePresence>
        {selected && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelected(null)}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 20 }}
              transition={{ type: "spring", stiffness: 260, damping: 26 }}
              onClick={(e) => e.stopPropagation()}
              className="scrollbar-thin glass-strong glow-ring relative max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-3xl p-8"
            >
              <button
                onClick={() => setSelected(null)}
                className="absolute right-5 top-5 rounded-lg p-2 text-muted transition-colors hover:bg-brand/10 hover:text-fg"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
              <span className="rounded-full bg-brand/12 px-3 py-1 font-mono text-[11px] font-bold text-brand">
                {selected.badge}
              </span>
              <h2 className="mt-4 font-display text-3xl font-bold leading-tight">
                {selected.title}
              </h2>
              <div className="mt-6">
                <GuideBody content={selected.content} />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </SiteShell>
  );
}
