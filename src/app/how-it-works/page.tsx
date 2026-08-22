"use client";

import { useState, useSyncExternalStore } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSelector } from "react-redux";
import { RootState } from "@/store";
import SharedNavigation from "@/app/components/SharedNavigation";
import SharedFooter from "@/app/components/SharedFooter";
import {
  X,
  Calendar,
  Clock,
  ArrowRight,
  Tag,
  GitBranch,
  Rocket,
  Users,
  Shield,
  Code,
  Activity,
  Lock,
  GitMerge,
  Layers,
} from "lucide-react";

interface BlogPost {
  id: number;
  title: string;
  description: string;
  badge: string;
  category: string;
  date: string;
  readTime: string;
  image: string;
  content: string;
  author: {
    name: string;
    role: string;
  };
}

const blogPosts: BlogPost[] = [
  {
    id: 1,
    title: "Repository Management: Organize Your Code",
    description:
      "Create, manage, and explore repositories while keeping your projects organized in one place.",
    badge: "Repository",
    category: "repository",
    date: "Aug 20, 2026",
    readTime: "5 min read",
    image: "/api/placeholder/800/400",
    author: {
      name: "Gent Team",
      role: "Development Team",
    },
    content: `
# Repository Management: Organize Your Code

Gent provides a simple way to create and manage software repositories from one place.

## Create a Repository

Start a new project by creating a repository and providing the basic information about your project.

You can define the repository name, description, and visibility according to your project needs.

## Manage Repository Information

Repository owners can update repository information when project details change.

Gent keeps repository management organized so that users can easily access their projects.

## Explore Your Repository

After creating a repository, you can explore its branches, files, commits, and other available repository information.

## Repository Ownership

Repository permissions are managed according to the user's role. Owners have access to repository management actions while other users have access according to the permissions granted to them.

## Getting Started

Create a repository, add your project files, create branches, and start tracking your changes with commits.

Gent brings the essential repository management features together in one platform.
    `,
  },

  {
    id: 2,
    title: "Branch Management: Work on Different Versions",
    description:
      "Create branches, switch between them, and explore different versions of your project without changing the main branch.",
    badge: "Branches",
    category: "branches",
    date: "Aug 19, 2026",
    readTime: "5 min read",
    image: "/api/placeholder/800/400",
    author: {
      name: "Gent Team",
      role: "Development Team",
    },
    content: `
# Branch Management: Work on Different Versions

Branches allow developers to work on different versions of a project while keeping the main development line organized.

## Create a Branch

Create a new branch from an existing branch when you want to work on a new feature or make changes independently.

## Switch Between Branches

Gent allows you to select a branch and explore the files that belong to that branch.

This makes it easier to work with different versions of the same repository.

## Branch Files

Each branch can contain its own version of the repository files.

When you switch branches, Gent loads the corresponding repository tree so you can explore the correct version of the project.

## Keep Your Work Organized

Using branches helps separate different development tasks and makes it easier to track changes before they become part of the main development line.

## Working With Branches

A typical workflow can be:

1. Select an existing branch.
2. Create a new branch when needed.
3. Make changes to your project.
4. Create commits for your changes.
5. Compare changes when necessary.

Branch management helps keep development organized and makes working with multiple versions of a project easier.
    `,
  },

  {
    id: 3,
    title: "Authentication: Secure Access to Your Account",
    description:
      "Manage your Gent account with login, registration, password recovery, and password management features.",
    badge: "Authentication",
    category: "authentication",
    date: "Aug 18, 2026",
    readTime: "4 min read",
    image: "/api/placeholder/800/400",
    author: {
      name: "Gent Team",
      role: "Development Team",
    },
    content: `
# Authentication: Secure Access to Your Account

Authentication is an essential part of Gent. It allows users to securely access their accounts and repository features.

## Create an Account

New users can register by providing their account information through the registration form.

After creating an account, users can sign in and access their Gent workspace.

## Login

Registered users can sign in to Gent using their account credentials.

Authentication keeps access to personal repositories and account features associated with the correct user.

## Forgot Password

If a user forgets their password, Gent provides a password recovery flow that allows the user to start the recovery process.

## Reset Password

Users can set a new password through the password reset process.

## Change Password

Authenticated users can change their current password from their account settings.

## Account Access

Authentication ensures that repository actions and account-related features are associated with the authenticated user.

Gent provides the essential authentication flows needed to manage access to your account.
    `,
  },

  {
    id: 4,
    title: "Collaborators: Work Together on Repositories",
    description:
      "Manage repository collaborators and control who can work with your projects.",
    badge: "Collaboration",
    category: "collaboration",
    date: "Aug 17, 2026",
    readTime: "5 min read",
    image: "/api/placeholder/800/400",
    author: {
      name: "Gent Team",
      role: "Development Team",
    },
    content: `
# Collaborators: Work Together on Repositories

Software development is often a collaborative process. Gent provides repository collaboration features that allow repository owners to manage other users who can work with their projects.

## Add Collaborators

Repository owners can add users as collaborators when they want other developers to work with the repository.

## Manage Access

Collaborators receive access according to the permissions provided by the repository.

This allows repository owners to keep control over important repository management actions.

## Repository Ownership

The owner remains responsible for the repository and can manage its collaborators.

Some repository actions are restricted to users who have the required permissions.

## Working Together

A collaborative workflow can include:

1. Create a repository.
2. Add collaborators.
3. Create branches for different tasks.
4. Make changes and create commits.
5. Review and compare changes.

Collaborators make it easier for multiple developers to work on the same repository while keeping repository access organized.
    `,
  },

  {
    id: 5,
    title: "Repository Files: Explore Your Project",
    description:
      "Browse repository files and folders, switch branches, and inspect the contents of your project.",
    badge: "File Browser",
    category: "files",
    date: "Aug 16, 2026",
    readTime: "5 min read",
    image: "/api/placeholder/800/400",
    author: {
      name: "Gent Team",
      role: "Development Team",
    },
    content: `
# Repository Files: Explore Your Project

Gent provides a repository file browser that allows users to explore the structure and contents of their projects.

## Browse Files and Folders

Open a repository and navigate through its folders and files from the repository browser.

The file tree makes it easier to understand the structure of a project without leaving the platform.

## Explore a Branch

The repository browser works with branches, allowing you to select a branch and view the files that belong to that version.

## Open Files

Select a file to inspect its contents directly from the repository.

This makes it easier to review source code and project configuration files.

## Create Files

Users with the required permissions can create files inside the repository.

New files become part of the repository structure and can be tracked through the repository's development workflow.

## Navigate Your Project

The repository browser brings files, folders, and branches together so developers can quickly find the part of the project they need.

Gent makes exploring a repository simple and accessible directly from the web interface.
    `,
  },

  {
    id: 6,
    title: "Commits & Diff: Track and Compare Changes",
    description:
      "Explore commit history and compare changes to understand exactly what was added, removed, or modified.",
    badge: "Commits",
    category: "commits",
    date: "Aug 15, 2026",
    readTime: "6 min read",
    image: "/api/placeholder/800/400",
    author: {
      name: "Gent Team",
      role: "Development Team",
    },
    content: `
# Commits & Diff: Track and Compare Changes

Commits provide a history of changes made to a repository. Gent allows users to explore this history and inspect individual commits.

## Commit History

Repository users can view the commit history and inspect the changes associated with previous commits.

Each commit has identifying information that helps developers understand when and how a change was made.

## Commit Details

Opening a commit provides more information about the selected change.

Developers can use the commit information to understand the evolution of their project.

## Compare Changes

The diff view makes it possible to compare changes between versions of the code.

Added lines and removed lines can be inspected directly so developers can understand what changed.

## Review Changes

Diffs are useful when reviewing modifications before continuing development.

They help developers quickly identify:

- Added code
- Removed code
- Modified files
- Changes between versions

## Development History

Combining branches, commits, and diff views gives developers a clearer picture of how their repository changes over time.

Gent makes repository history easier to explore and understand.
    `,
  },
];

export default function HowItWorksPage() {
  const isDark = useSelector((state: RootState) => state.theme.isDark);
  const isHydrated = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const [selectedPost, setSelectedPost] = useState<BlogPost | null>(null);
  const [selectedFilter, setSelectedFilter] = useState<string>("all");

  const cleanContent = (content: string): string => {
    return content
      .replace(/^#{1,6}\s+/gm, "")
      .replace(/^[-*+]\s+/gm, "")
      .replace(/^\d+\.\s+/gm, "")
      .replace(/\*\*(.*?)\*\*/g, "$1")
      .replace(/__(.*?)__/g, "$1")
      .replace(/`(.*?)`/g, "$1")
      .trim();
  };
  const filters = [
    { id: "all", label: "All Features", icon: Activity },
    { id: "repository", label: "Repositories", icon: GitBranch },
    { id: "branches", label: "Branches", icon: GitMerge },
    { id: "authentication", label: "Authentication", icon: Lock },
    { id: "collaboration", label: "Collaborators", icon: Users },
    { id: "files", label: "Files", icon: Code },
    { id: "commits", label: "Commits & Diff", icon: GitBranch },
  ];

  const filteredPosts =
    selectedFilter === "all"
      ? blogPosts
      : blogPosts.filter((post) => post.category === selectedFilter);

  // UI mockup component for each category
  const getUIComponent = (category: string) => {
    const baseClasses = `w-full h-full rounded-lg p-4 ${
      isDark ? "bg-[#0f1419]" : "bg-gray-900"
    }`;

    switch (category) {
      case "repository":
        return (
          <div className={baseClasses}>
            <div className="space-y-3">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <GitBranch className="w-4 h-4 text-[#7dd3fc]" />
                  <span className="text-sm text-[#7dd3fc] font-mono">
                    gent-platform
                  </span>
                </div>

                <span className="text-xs text-gray-400">Public</span>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2 p-2 rounded bg-white/5">
                  <Code className="w-4 h-4 text-[#7dd3fc]" />
                  <span className="text-xs text-gray-300">
                    Repository Files
                  </span>
                </div>

                <div className="flex items-center gap-2 p-2 rounded bg-white/5">
                  <GitBranch className="w-4 h-4 text-purple-400" />
                  <span className="text-xs text-gray-300">Branches</span>
                </div>

                <div className="flex items-center gap-2 p-2 rounded bg-white/5">
                  <GitMerge className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs text-gray-300">Commits</span>
                </div>
              </div>

              <div className="mt-4 p-3 rounded bg-[#7dd3fc]/10 border border-[#7dd3fc]/20">
                <div className="text-xs text-[#7dd3fc] mb-1">Repository</div>

                <div className="text-xs text-gray-400 font-mono">
                  gent-platform
                </div>
              </div>
            </div>
          </div>
        );

      case "branches":
        return (
          <div className={baseClasses}>
            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-4">
                <GitBranch className="w-4 h-4 text-[#7dd3fc]" />
                <span className="text-sm text-[#7dd3fc] font-mono">
                  Branches
                </span>
              </div>

              <div className="space-y-2">
                {[
                  { name: "main", active: true },
                  { name: "frontend", active: false },
                  { name: "feature/auth", active: false },
                  { name: "feature/diff", active: false },
                ].map((branch) => (
                  <div
                    key={branch.name}
                    className={`flex items-center gap-3 p-2 rounded ${
                      branch.active
                        ? "bg-[#7dd3fc]/10 border border-[#7dd3fc]/20"
                        : "bg-white/5"
                    }`}
                  >
                    <GitBranch
                      className={`w-3 h-3 ${
                        branch.active ? "text-[#7dd3fc]" : "text-gray-500"
                      }`}
                    />

                    <span
                      className={`text-xs ${
                        branch.active ? "text-[#7dd3fc]" : "text-gray-300"
                      }`}
                    >
                      {branch.name}
                    </span>

                    {branch.active && (
                      <span className="ml-auto text-[10px] text-[#7dd3fc]">
                        Current
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        );

      case "authentication":
        return (
          <div className={baseClasses}>
            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-4">
                <Lock className="w-4 h-4 text-[#7dd3fc]" />
                <span className="text-sm text-[#7dd3fc] font-mono">
                  Account Access
                </span>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-3 p-3 rounded bg-emerald-500/10 border border-emerald-500/20">
                  <div className="w-2 h-2 rounded-full bg-emerald-400" />

                  <div>
                    <div className="text-xs text-emerald-400 font-semibold">
                      Signed In
                    </div>

                    <div className="text-xs text-gray-500">
                      Account authenticated
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="p-3 rounded bg-white/5">
                    <Lock className="w-4 h-4 text-[#7dd3fc] mb-2" />
                    <div className="text-xs text-gray-300">Change Password</div>
                  </div>

                  <div className="p-3 rounded bg-white/5">
                    <Shield className="w-4 h-4 text-purple-400 mb-2" />
                    <div className="text-xs text-gray-300">
                      Password Recovery
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      case "collaboration":
        return (
          <div className={baseClasses}>
            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-4">
                <Users className="w-4 h-4 text-[#7dd3fc]" />
                <span className="text-sm text-[#7dd3fc] font-mono">
                  Collaborators
                </span>
              </div>

              <div className="space-y-2">
                {[
                  {
                    name: "Repository Owner",
                    role: "Owner",
                    icon: Shield,
                  },
                  {
                    name: "Collaborator",
                    role: "Member",
                    icon: Users,
                  },
                  {
                    name: "Developer",
                    role: "Member",
                    icon: Code,
                  },
                ].map((member) => {
                  const Icon = member.icon;

                  return (
                    <div
                      key={member.name}
                      className="flex items-center gap-3 p-2 rounded bg-white/5"
                    >
                      <div className="w-7 h-7 rounded-full bg-[#7dd3fc]/10 flex items-center justify-center">
                        <Icon className="w-3 h-3 text-[#7dd3fc]" />
                      </div>

                      <div className="flex-1">
                        <div className="text-xs text-gray-300">
                          {member.name}
                        </div>

                        <div className="text-[10px] text-gray-500">
                          {member.role}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );

      case "files":
        return (
          <div className={baseClasses}>
            <div className="space-y-3">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Code className="w-4 h-4 text-[#7dd3fc]" />

                  <span className="text-sm text-[#7dd3fc] font-mono">
                    Repository Files
                  </span>
                </div>

                <span className="text-xs text-gray-500">main</span>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2 p-2 rounded bg-white/5">
                  <Layers className="w-3 h-3 text-[#7dd3fc]" />
                  <span className="text-xs text-gray-300">src</span>
                </div>

                <div className="flex items-center gap-2 p-2 rounded bg-white/5">
                  <Layers className="w-3 h-3 text-purple-400" />
                  <span className="text-xs text-gray-300">components</span>
                </div>

                <div className="flex items-center gap-2 p-2 rounded bg-white/5">
                  <Code className="w-3 h-3 text-emerald-400" />
                  <span className="text-xs text-gray-300">package.json</span>
                </div>

                <div className="flex items-center gap-2 p-2 rounded bg-white/5">
                  <Code className="w-3 h-3 text-[#7dd3fc]" />
                  <span className="text-xs text-gray-300">README.md</span>
                </div>
              </div>
            </div>
          </div>
        );

      case "commits":
        return (
          <div className={baseClasses}>
            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-4">
                <GitMerge className="w-4 h-4 text-[#7dd3fc]" />

                <span className="text-sm text-[#7dd3fc] font-mono">
                  Commit History
                </span>
              </div>

              <div className="space-y-2">
                <div className="p-3 rounded bg-white/5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-gray-300">
                      Update repository settings
                    </span>

                    <span className="text-[10px] text-gray-500 font-mono">
                      a83f21c
                    </span>
                  </div>

                  <div className="flex gap-3 text-[10px]">
                    <span className="text-emerald-400">+24 additions</span>

                    <span className="text-red-400">-8 deletions</span>
                  </div>
                </div>

                <div className="p-3 rounded bg-white/5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-gray-300">
                      Add repository files
                    </span>

                    <span className="text-[10px] text-gray-500 font-mono">
                      7c91d42
                    </span>
                  </div>

                  <div className="text-[10px] text-gray-500">
                    Files changed: 3
                  </div>
                </div>

                <div className="flex items-center justify-center gap-2 p-2 rounded bg-[#7dd3fc]/10 border border-[#7dd3fc]/20">
                  <GitMerge className="w-3 h-3 text-[#7dd3fc]" />

                  <span className="text-xs text-[#7dd3fc]">
                    Compare changes
                  </span>
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return (
          <div className={baseClasses}>
            <div className="w-full h-full flex items-center justify-center">
              <GitBranch
                className={`w-16 h-16 ${
                  isDark ? "text-[#7dd3fc]/20" : "text-gray-400"
                }`}
              />
            </div>
          </div>
        );
    }
  };

  if (!isHydrated) return null;

  return (
    <div
      className={`min-h-screen transition-colors duration-300 ${
        isDark
          ? "bg-gradient-to-br from-[#0f1419] via-[#1a1f2e] to-[#151b28]"
          : "bg-gradient-to-br from-[#bed19e] via-[#a8c88a] to-[#9bc07a]"
      }`}
    >
      <SharedNavigation />

      {/* Hero Section */}
      <motion.section
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6 }}
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-32 mt-20"
      >
        <div className="text-center max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border mb-6 ${
              isDark
                ? "bg-[#7dd3fc]/10 border-[#7dd3fc]/20 text-[#7dd3fc]"
                : "bg-white/30 border-white/50 text-[#2d3e2d]"
            }`}
          >
            <Rocket className="w-4 h-4" />
            <span className="text-sm font-semibold">Learn How Gent Works</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className={`text-5xl md:text-6xl font-bold mb-6 ${
              isDark ? "text-white" : "text-[#2d3e2d]"
            }`}
          >
            Transform Your{" "}
            <span className={isDark ? "text-[#7dd3fc]" : "text-white"}>
              Development Workflow
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className={`text-xl mb-8 ${
              isDark ? "text-gray-300" : "text-[#2d3e2d]/80"
            }`}
          >
            Discover best practices, insights, and strategies from industry
            leaders. Learn how top engineering teams build, deploy, and scale
            with confidence.
          </motion.p>

          {/* Animated Icons */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="flex justify-center gap-8 mt-12"
          >
            {[GitBranch, Code, Users, Lock, GitMerge, Layers].map(
              (Icon, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.7 + index * 0.1 }}
                  whileHover={{ scale: 1.2, rotate: 10 }}
                  className={`p-4 rounded-full ${
                    isDark
                      ? "bg-white/10 text-[#7dd3fc]"
                      : "bg-white/30 text-[#2d3e2d]"
                  }`}
                >
                  <Icon className="w-6 h-6" />
                </motion.div>
              ),
            )}
          </motion.div>
        </div>
      </motion.section>

      {/* Blog Posts Grid */}
      <motion.section
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20"
      >
        {/* Filter Bar */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="flex flex-wrap items-center justify-center gap-3 mb-12"
        >
          {filters.map((filter) => {
            const Icon = filter.icon;
            const isActive = selectedFilter === filter.id;

            return (
              <motion.button
                key={filter.id}
                onClick={() => setSelectedFilter(filter.id)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold border transition-all ${
                  isActive
                    ? isDark
                      ? "bg-[#7dd3fc] text-[#0f1419] border-[#7dd3fc] shadow-lg shadow-[#7dd3fc]/30"
                      : "bg-[#5A7863] text-white border-[#5A7863] shadow-lg"
                    : isDark
                      ? "bg-white/5 text-gray-300 border-white/10 hover:bg-white/10 hover:border-white/20"
                      : "bg-white/30 text-[#2d3e2d] border-white/50 hover:bg-white/50"
                }`}
              >
                <Icon className="w-4 h-4" />
                {filter.label}
              </motion.button>
            );
          })}
        </motion.div>

        {/* Posts Grid */}
        <AnimatePresence mode="wait">
          <motion.div
            key={selectedFilter}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="grid md:grid-cols-2 gap-8"
          >
            {filteredPosts.map((post, index) => (
              <motion.div
                key={post.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                onClick={() => setSelectedPost(post)}
                className={`cursor-pointer rounded-2xl overflow-hidden border transition-all group ${
                  isDark
                    ? "bg-[#1a1f2e]/50 border-[#7dd3fc]/10 hover:border-[#7dd3fc]/30 hover:shadow-2xl hover:shadow-[#7dd3fc]/20"
                    : "bg-white/50 border-white/50 hover:border-white hover:shadow-2xl"
                }`}
                whileHover={{ y: -5 }}
              >
                {/* Badge */}
                <div className="p-6 pb-0">
                  <span
                    className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                      isDark
                        ? "bg-[#7dd3fc]/20 text-[#7dd3fc]"
                        : "bg-[#5A7863]/20 text-[#5A7863]"
                    }`}
                  >
                    <Tag className="w-3 h-3 inline mr-1" />
                    {post.badge}
                  </span>
                </div>

                {/* Image/UI Mockup */}
                <div
                  className={`m-6 rounded-xl overflow-hidden aspect-video ${
                    isDark ? "bg-[#0f1419]" : "bg-gray-200"
                  }`}
                >
                  {getUIComponent(post.category)}
                </div>

                {/* Content */}
                <div className="p-6 pt-0">
                  <h3
                    className={`text-2xl font-bold mb-3 ${
                      isDark ? "text-white" : "text-[#2d3e2d]"
                    }`}
                  >
                    {post.title}
                  </h3>

                  <p
                    className={`text-sm mb-4 line-clamp-2 ${
                      isDark ? "text-gray-400" : "text-[#4a5f4a]"
                    }`}
                  >
                    {post.description}
                  </p>

                  <div
                    className={`flex items-center justify-between text-xs ${
                      isDark ? "text-gray-500" : "text-gray-600"
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {post.date}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {post.readTime}
                      </span>
                    </div>

                    <button
                      className={`flex items-center gap-1 font-semibold transition-all group-hover:gap-2 ${
                        isDark ? "text-[#7dd3fc]" : "text-[#5A7863]"
                      }`}
                    >
                      Explore Article
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </AnimatePresence>
      </motion.section>

      {/* Blog Post Modal */}
      <AnimatePresence>
        {selectedPost && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
            onClick={() => setSelectedPost(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className={`relative w-full max-w-4xl max-h-[90vh] rounded-2xl overflow-hidden border shadow-2xl ${
                isDark
                  ? "bg-[#1a1f2e] border-[#7dd3fc]/20"
                  : "bg-white border-gray-200"
              }`}
            >
              {/* Close Button */}
              <button
                onClick={() => setSelectedPost(null)}
                className={`absolute top-4 right-4 z-10 p-2 rounded-lg transition-all ${
                  isDark
                    ? "bg-white/10 hover:bg-white/20 text-white"
                    : "bg-black/10 hover:bg-black/20 text-gray-900"
                }`}
              >
                <X className="w-5 h-5" />
              </button>

              {/* Modal Content */}
              <div className="overflow-y-auto max-h-[90vh] p-8">
                <span
                  className={`inline-block px-3 py-1 rounded-full text-xs font-semibold mb-4 ${
                    isDark
                      ? "bg-[#7dd3fc]/20 text-[#7dd3fc]"
                      : "bg-[#5A7863]/20 text-[#5A7863]"
                  }`}
                >
                  {selectedPost.badge}
                </span>

                <h2
                  className={`text-4xl font-bold mb-4 ${
                    isDark ? "text-white" : "text-gray-900"
                  }`}
                >
                  {selectedPost.title}
                </h2>

                <div
                  className={`flex items-center gap-4 mb-6 pb-6 border-b ${
                    isDark
                      ? "text-gray-400 border-white/10"
                      : "text-gray-600 border-gray-200"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    {selectedPost.date}
                  </span>
                  <span className="flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    {selectedPost.readTime}
                  </span>
                  <span className="ml-auto">
                    By <strong>{selectedPost.author.name}</strong>,{" "}
                    {selectedPost.author.role}
                  </span>
                </div>

                <div
                  className={`prose max-w-none ${isDark ? "prose-invert" : ""}`}
                >
                  {cleanContent(selectedPost.content)
                    .split("\n")
                    .filter((paragraph: string) => paragraph.trim() !== "")
                    .map((paragraph: string, index: number) => (
                      <p
                        key={index}
                        className={`mb-4 ${
                          isDark ? "text-gray-300" : "text-gray-700"
                        }`}
                      >
                        {paragraph}
                      </p>
                    ))}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <SharedFooter />
    </div>
  );
}
