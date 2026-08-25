"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { motion } from "framer-motion";
import {
  GitBranch,
  GitCommit,
  Tag,
  Settings,
  Star,
  Eye,
  GitFork,
  Download,
  Copy,
  Lock,
  Globe,
  Calendar,
  User,
  ArrowLeft,
  Code2,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";
import { useRepository } from "@/hooks/use-repositories";
import { useBranches } from "@/hooks/use-branches";
import { useCommits } from "@/hooks/use-commits";
import { useTags } from "@/hooks/use-tags";
import { useSelector } from "react-redux";
import { RootState } from "@/store";
import { getCloneUrl } from "@/hooks/use-git-operations";
import GitOperationsModal from "./_components/GitOperationsModal";
import CommitsTab from "./_components/CommitsTab";
import BranchesTab from "./_components/BranchesTab";
import TagsTab from "./_components/TagsTab";
import FileBrowserTab from "./_components/FileBrowserTab";
import { getDashboardTheme } from "@/app/dashboard/_components/dashboard-theme";

type TabType = "code" | "commits" | "branches" | "tags";

export default function RepositoryPage() {
  const params = useParams();
  const isDark = useSelector((state: RootState) => state.theme.isDark);
  const [activeTab, setActiveTab] = useState<TabType>("code");
  const [showGitOpsModal, setShowGitOpsModal] = useState(false);

  const ownerId = parseInt(params.owner_id as string);
  const repoName = params.repo_name as string;

  const {
    data: repository,
    isLoading: repoLoading,
    error: repoError,
  } = useRepository(ownerId, repoName);
  const { data: branches = [], isLoading: branchesLoading } = useBranches(
    ownerId,
    repoName,
  );
  const { data: commits = [], isLoading: commitsLoading } = useCommits(
    ownerId,
    repoName,
  );
  const { data: tags = [], isLoading: tagsLoading } = useTags(
    ownerId,
    repoName,
  );
  const t = getDashboardTheme(isDark);

  if (repoLoading) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-300 rounded w-1/3"></div>
          <div className="h-32 bg-gray-300 rounded"></div>
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <div className="lg:col-span-3 h-96 bg-gray-300 rounded"></div>
            <div className="h-64 bg-gray-300 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (repoError || !repository) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div
          className="rounded-lg border p-8 text-center"
          style={{
            backgroundColor: t.elevated,
            borderColor: t.border,
          }}
        >
          <h1 className="text-xl font-semibold mb-2" style={{ color: t.text }}>
            Repository not found
          </h1>
          <p style={{ color: t.textMuted }}>
            The repository you're looking for doesn't exist or you don't have
            access to it.
          </p>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 mt-4 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            style={{
              backgroundColor: t.accent,
              color: t.successText,
            }}
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const tabs = [
    { id: "code" as TabType, label: "Code", icon: Code2, count: null },
    {
      id: "commits" as TabType,
      label: "Commits",
      icon: GitCommit,
      count: commits.length,
    },
    {
      id: "branches" as TabType,
      label: "Branches",
      icon: GitBranch,
      count: branches.length,
    },
    { id: "tags" as TabType, label: "Tags", icon: Tag, count: tags.length },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <div className="flex items-center gap-2 mb-4">
          <Link
            href="/dashboard"
            className="p-2 rounded-lg transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
            style={{ color: t.textMuted }}
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <nav
            className="text-sm flex items-center gap-1"
            style={{ color: t.textMuted }}
          >
            <Link href="/dashboard" className="hover:underline">
              Dashboard
            </Link>
            <ChevronRight className="w-4 h-4" />
            <span style={{ color: t.text }}>{repository.name}</span>
          </nav>
        </div>

        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-bold" style={{ color: t.text }}>
                <span style={{ color: t.textMuted }}>
                  {repository.owner_email.split("@")[0]}/
                </span>
                {repository.name}
              </h1>
              <span
                className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full border"
                style={{
                  borderColor: t.border,
                  backgroundColor: t.surface,
                  color: t.textMuted,
                }}
              >
                {repository.is_private ? (
                  <>
                    <Lock className="w-3 h-3" />
                    Private
                  </>
                ) : (
                  <>
                    <Globe className="w-3 h-3" />
                    Public
                  </>
                )}
              </span>
            </div>

            {repository.description && (
              <p className="text-sm mb-3" style={{ color: t.textMuted }}>
                {repository.description}
              </p>
            )}

            <div
              className="flex flex-wrap items-center gap-4 text-xs"
              style={{ color: t.textMuted }}
            >
              <span className="flex items-center gap-1">
                <User className="w-3 h-3" />
                {repository.owner_email.split("@")[0]}
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                Created {formatDate(repository.created_at)}
              </span>
              <span className="flex items-center gap-1">
                <GitBranch className="w-3 h-3" />
                {repository.default_branch}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href={`/dashboard/repository/${ownerId}/${repoName}/settings`}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border transition-colors"
              style={{
                borderColor: t.border,
                backgroundColor: t.surface,
                color: t.text,
              }}
            >
              <Settings className="w-4 h-4" />
              Settings
            </Link>
          </div>
        </div>
      </motion.div>

      {/* Navigation Tabs */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="border-b mb-6"
        style={{ borderColor: t.border }}
      >
        <nav className="flex gap-6">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-3 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id ? "" : "border-transparent"
              }`}
              style={{
                borderBottomColor:
                  activeTab === tab.id ? t.accent : "transparent",
                color: activeTab === tab.id ? t.accent : t.textMuted,
              }}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
              {tab.count !== null && tab.count > 0 && (
                <span
                  className="px-1.5 py-0.5 text-xs rounded-full"
                  style={{
                    backgroundColor: t.accentMuted,
                    color: t.accent,
                  }}
                >
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </nav>
      </motion.div>

      {/* Content Area */}
      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="grid grid-cols-1 lg:grid-cols-4 gap-6"
      >
        {/* Main Content */}
        <div className="lg:col-span-3">
          <div
            className="rounded-lg border p-6"
            style={{
              backgroundColor: t.elevated,
              borderColor: t.border,
            }}
          >
            {activeTab === "code" && (
              <FileBrowserTab
                ownerId={ownerId}
                repoName={repoName}
                isDark={isDark}
                defaultBranch={repository.default_branch}
                userEmail={repository.owner_email}
              />
            )}

            {/* Commits Tab */}
            {activeTab === "commits" && (
              <CommitsTab
                commits={commits}
                isLoading={commitsLoading}
                isDark={isDark}
                ownerName={repository.owner_email.split("@")[0]}
                repoName={repoName}
                ownerId={repository.owner_id}
              />
            )}

            {/* Branches Tab */}
            {activeTab === "branches" && (
              <BranchesTab
                branches={branches}
                isLoading={branchesLoading}
                isDark={isDark}
                defaultBranch={repository.default_branch}
                ownerId={ownerId}
                repoName={repoName}
                userEmail={repository.owner_email}
              />
            )}

            {/* Tags Tab */}
            {activeTab === "tags" && (
              <TagsTab
                tags={tags}
                isLoading={tagsLoading}
                isDark={isDark}
                ownerId={ownerId}
                repoName={repoName}
                branches={branches}
                userEmail={repository.owner_email}
              />
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Clone section */}
          <div
            className="rounded-lg border p-4"
            style={{
              backgroundColor: t.elevated,
              borderColor: t.border,
            }}
          >
            <h3
              className="text-sm font-semibold mb-3"
              style={{ color: t.text }}
            >
              Clone this repository
            </h3>
            <div className="space-y-2">
              <div className="flex">
                <input
                  type="text"
                  value={getCloneUrl(repository.owner_id, repository.name)}
                  readOnly
                  className="flex-1 px-3 py-2 text-xs rounded-l-lg border"
                  style={{
                    backgroundColor: t.inputBg,
                    borderColor: t.border,
                    color: t.textSecondary,
                  }}
                />
                <button
                  onClick={() =>
                    navigator.clipboard.writeText(
                      getCloneUrl(repository.owner_id, repository.name),
                    )
                  }
                  className="px-3 py-2 border border-l-0 rounded-r-lg text-xs transition-colors"
                  style={{
                    borderColor: t.border,
                    backgroundColor: t.surface,
                    color: t.textMuted,
                  }}
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
              <button
                onClick={() => setShowGitOpsModal(true)}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium rounded-lg transition-colors"
                style={{
                  backgroundColor: t.accent,
                  color: t.successText,
                }}
              >
                <Download className="w-4 h-4" />
                Clone & Git Ops
              </button>
            </div>
          </div>

          {/* Quick stats */}
          <div
            className="rounded-lg border p-4"
            style={{
              backgroundColor: t.elevated,
              borderColor: t.border,
            }}
          >
            <h3
              className="text-sm font-semibold mb-3"
              style={{ color: t.text }}
            >
              Quick stats
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="text-center">
                <div className="text-lg font-bold" style={{ color: t.text }}>
                  {commits.length}
                </div>
                <div className="text-xs" style={{ color: t.textMuted }}>
                  Commits
                </div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold" style={{ color: t.text }}>
                  {branches.length}
                </div>
                <div className="text-xs" style={{ color: t.textMuted }}>
                  Branches
                </div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold" style={{ color: t.text }}>
                  {tags.length}
                </div>
                <div className="text-xs" style={{ color: t.textMuted }}>
                  Tags
                </div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold" style={{ color: t.text }}>
                  0
                </div>
                <div className="text-xs" style={{ color: t.textMuted }}>
                  Contributors
                </div>
              </div>
            </div>
          </div>

          {/* Repository stats */}
          <div
            className="rounded-lg border p-4"
            style={{
              backgroundColor: t.elevated,
              borderColor: t.border,
            }}
          >
            <h3
              className="text-sm font-semibold mb-3"
              style={{ color: t.text }}
            >
              Repository info
            </h3>
            <div className="space-y-2 text-xs" style={{ color: t.textMuted }}>
              <div className="flex justify-between">
                <span>Repository ID:</span>
                <span className="font-mono">{repository.id}</span>
              </div>
              <div className="flex justify-between">
                <span>Created:</span>
                <span>{formatDate(repository.created_at)}</span>
              </div>
              <div className="flex justify-between">
                <span>Updated:</span>
                <span>{formatDate(repository.updated_at)}</span>
              </div>
              <div className="flex justify-between">
                <span>Owner:</span>
                <span>{repository.owner_email.split("@")[0]}</span>
              </div>
            </div>
          </div>

          {/* Settings link */}
          <Link
            href={`/dashboard/repository/${ownerId}/${repoName}/settings`}
            className="flex items-center justify-center gap-2 w-full p-3 text-sm font-medium rounded-lg border transition-colors"
            style={{
              borderColor: t.border,
              backgroundColor: t.surface,
              color: t.text,
            }}
          >
            <Settings className="w-4 h-4" />
            Repository settings
          </Link>
        </div>
      </motion.div>

      {/* Git Operations Modal */}
      <GitOperationsModal
        isOpen={showGitOpsModal}
        onClose={() => setShowGitOpsModal(false)}
        ownerId={ownerId}
        repoName={repoName}
        isDark={isDark}
        repositoryUrl={getCloneUrl(repository.owner_id, repository.name)}
        defaultBranch={repository.default_branch}
      />
    </div>
  );
}
