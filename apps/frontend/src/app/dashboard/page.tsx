"use client";

import { useMemo, useState, useRef } from "react";
import { motion } from "framer-motion";
import { Activity, Filter, FolderGit2, GitBranch, Globe2, LockKeyhole, Plus, RefreshCw, SortAsc } from "lucide-react";
import { useDashboard } from "./_components/DashboardContext";
import RepositoryCard from "./_components/RepositoryCard";
import ActivityFeed from "./_components/ActivityFeed";
import { SkeletonCard, SkeletonActivity } from "./_components/LoadingSpinner";
import { getDashboardTheme } from "./_components/dashboard-theme";
import { useRepositories } from "@/hooks/use-repositories";
import { useDashboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { Repository } from "@/types/repository";
import WorkspacePulse from "./_components/WorkspacePulse";
import { getRepoOwner } from "@/lib/user-display";

type SortKey = "newest" | "oldest" | "name";

export default function DashboardPage() {
  const { isDark, searchQuery, selectedRepoId, openNewRepoModal } =
    useDashboard();
  const [sortBy, setSortBy] = useState<SortKey>("newest");
  const [filterType, setFilterType] = useState<"all" | "public" | "private">(
    "all",
  );
  const searchInputRef = useRef<HTMLInputElement>(null);

  const {
    data: repositories = [],
    isLoading,
    error,
    refetch,
  } = useRepositories();
  const t = getDashboardTheme(isDark);

  // Keyboard shortcuts - remove toggleTheme since it's not available in context
  useDashboardShortcuts({
    onNewRepository: openNewRepoModal,
    onSearch: () => searchInputRef.current?.focus(),
    onToggleTheme: () => {}, // Empty function as placeholder
    onRefresh: () => refetch(),
  });

  const filteredRepositories = useMemo(() => {
    let list = [...repositories];
    const q = searchQuery.trim().toLowerCase();

    if (q) {
      list = list.filter(
        (r: Repository) =>
          r.name.toLowerCase().includes(q) ||
          r.description.toLowerCase().includes(q) ||
          getRepoOwner(r).toLowerCase().includes(q),
      );
    }

    if (filterType === "public")
      list = list.filter((r: Repository) => !r.is_private);
    if (filterType === "private")
      list = list.filter((r: Repository) => r.is_private);

    if (selectedRepoId) {
      const selectedId = Number(selectedRepoId);
      const selected = list.find((r: Repository) => r.id === selectedId);
      if (selected) {
        list = [
          selected,
          ...list.filter((r: Repository) => r.id !== selectedId),
        ];
      }
    }

    switch (sortBy) {
      case "name":
        list.sort((a: Repository, b: Repository) =>
          a.name.localeCompare(b.name),
        );
        break;
      case "oldest":
        list.sort(
          (a: Repository, b: Repository) =>
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
        );
        break;
      case "newest":
        list.sort(
          (a: Repository, b: Repository) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        );
        break;
      default:
        break;
    }

    return list;
  }, [repositories, searchQuery, filterType, sortBy, selectedRepoId]);

  const stats = [
    {
      label: "Total",
      value: isLoading ? "..." : repositories.length,
      icon: FolderGit2,
      tone: t.accent,
      spark: [35, 52, 46, 68, 82],
    },
    {
      label: "Public",
      value: isLoading
        ? "..."
        : repositories.filter((r: Repository) => !r.is_private).length,
      icon: Globe2,
      tone: t.accentHover,
      spark: [42, 38, 58, 62, 74],
    },
    {
      label: "Private",
      value: isLoading
        ? "..."
        : repositories.filter((r: Repository) => r.is_private).length,
      icon: LockKeyhole,
      tone: t.accentTertiary,
      spark: [24, 40, 34, 46, 42],
    },
    {
      label: "Updated Today",
      value: isLoading
        ? "..."
        : repositories.filter((r: Repository) => {
            const today = new Date().toDateString();
            return new Date(r.updated_at).toDateString() === today;
          }).length,
      icon: Activity,
      tone: t.accent,
      spark: [18, 34, 28, 52, 70],
    },
  ];

  if (error) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div
          className="flex flex-col items-center justify-center py-16 px-6 rounded-xl border text-center"
          style={{
            backgroundColor: t.elevated,
            borderColor: t.border,
          }}
        >
          <p className="text-sm mb-4" style={{ color: t.textMuted }}>
            Failed to load repositories. Please try again.
          </p>
          <button
            onClick={() => refetch()}
            className="px-4 py-2 rounded-lg text-sm font-semibold transition-all hover:shadow-lg flex items-center gap-2"
            style={{
              background: t.accentGradient,
              color: t.successText,
            }}
          >
            <RefreshCw className="w-4 h-4" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative mx-auto max-w-[1380px] px-4 py-5 sm:px-6 sm:py-7">
      <motion.section
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="relative mb-5 overflow-hidden rounded-2xl border p-5 sm:p-6"
        style={{ background: t.elevated, borderColor: t.border }}
      >
        <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full blur-[100px]" style={{ background: `${t.accent}18` }} />
        <div className="relative flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
          <div className="max-w-2xl xl:py-2">
            <div className="mb-3 inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em]" style={{ color: t.accent }}>
              <GitBranch className="h-3.5 w-3.5" />
              Repository workspace
            </div>
            <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl" style={{ color: t.text }}>
              Your repositories
            </h1>
            <p className="mt-2 text-sm leading-6" style={{ color: t.textMuted }}>
              Browse code, follow branch activity, and manage every project from one workspace.
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => refetch()}
                disabled={isLoading}
                className="flex items-center gap-2 rounded-lg border px-3.5 py-2 text-sm font-medium transition-colors"
                style={{
                  backgroundColor: t.elevated,
                  borderColor: t.border,
                  color: t.textSecondary,
                }}
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
                Refresh data
              </button>
              <button
                type="button"
                onClick={openNewRepoModal}
                className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-transform hover:-translate-y-0.5"
                style={{ background: t.accentGradient, color: t.successText }}
              >
                <Plus className="w-4 h-4" />
                New repository
              </button>
            </div>
          </div>
          <WorkspacePulse isDark={isDark} />
        </div>
      </motion.section>

      <div className="mb-6 grid grid-cols-2 overflow-hidden rounded-2xl border lg:grid-cols-4" style={{ borderColor: t.border, background: t.elevated }}>
        {stats.map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 + index * 0.06 }}
            whileHover={{ y: -2 }}
            className={`group relative overflow-hidden p-4 sm:p-5 ${
              index < 2 ? "border-b" : ""
            } ${index % 2 === 0 ? "border-r" : ""} lg:border-b-0 ${
              index < stats.length - 1 ? "lg:border-r" : "lg:border-r-0"
            }`}
            style={{ borderColor: t.borderMuted }}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.16em]" style={{ color: t.textMuted }}>{stat.label}</p>
                <p className="mt-1.5 font-display text-2xl font-bold" style={{ color: t.text }}>{stat.value}</p>
              </div>
              <span className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ color: stat.tone, background: `${stat.tone}12` }}>
                <stat.icon className="h-4 w-4" />
              </span>
            </div>
            <div className="mt-3 flex h-5 items-end gap-1" aria-hidden>
              {stat.spark.map((height, sparkIndex) => (
                <motion.span key={sparkIndex} initial={{ height: 0 }} animate={{ height: `${height}%` }} transition={{ delay: 0.18 + index * 0.05 + sparkIndex * 0.035 }} className="w-1.5 rounded-full" style={{ background: sparkIndex === stat.spark.length - 1 ? stat.tone : `${stat.tone}35` }} />
              ))}
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        {/* Main Content */}
        <div className="min-w-0 space-y-6">
          {/* Repositories Section */}
          <div>
            <div className="mb-4 flex items-end justify-between">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.18em]" style={{ color: t.accent }}>Projects</p>
                <h2 className="mt-1 font-display text-xl font-semibold" style={{ color: t.text }}>Repository index</h2>
              </div>
              <span className="text-xs" style={{ color: t.textMuted }}>{filteredRepositories.length} visible</span>
            </div>

            {/* Toolbar */}
            <div
              className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border p-2"
              style={{
                backgroundColor: t.elevated,
                borderColor: t.border,
              }}
            >
              <Filter className="w-4 h-4 ml-1" style={{ color: t.textMuted }} />
              {(["all", "public", "private"] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setFilterType(type)}
                  className="px-3 py-1.5 text-xs font-medium rounded-md capitalize transition-colors"
                  style={{
                    backgroundColor:
                      filterType === type ? t.sidebarActive : "transparent",
                    color: filterType === type ? t.text : t.textMuted,
                  }}
                >
                  {type}
                </button>
              ))}
              <div
                className="w-px h-5 mx-1 hidden sm:block"
                style={{ backgroundColor: t.border }}
              />
              <SortAsc className="w-4 h-4" style={{ color: t.textMuted }} />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortKey)}
                className="text-xs font-medium rounded-md border px-2 py-1.5 outline-none cursor-pointer"
                style={{
                  backgroundColor: t.inputBg,
                  borderColor: t.border,
                  color: t.textSecondary,
                }}
              >
                <option value="newest">Newest</option>
                <option value="oldest">Oldest</option>
                <option value="name">Name</option>
              </select>
            </div>

            {/* Loading state */}
            {isLoading && (
              <div className="overflow-hidden rounded-2xl border" style={{ borderColor: t.border, background: t.elevated }}>
                {[...Array(3)].map((_, i) => (
                  <SkeletonCard key={i} isDark={isDark} />
                ))}
              </div>
            )}

            {/* Repository list */}
            {!isLoading && filteredRepositories.length > 0 && (
              <div className="overflow-hidden rounded-2xl border" style={{ borderColor: t.border, background: t.elevated }}>
                {filteredRepositories.map((repo: Repository, index: number) => (
                  <RepositoryCard
                    key={repo.id}
                    repo={repo}
                    isDark={isDark}
                    index={index}
                    highlighted={selectedRepoId === String(repo.id)}
                  />
                ))}
              </div>
            )}

            {/* Empty state */}
            {!isLoading && filteredRepositories.length === 0 && (
              <div
                className="flex flex-col items-center justify-center py-16 px-6 rounded-xl border text-center"
                style={{
                  backgroundColor: t.elevated,
                  borderColor: t.border,
                }}
              >
                <FolderGit2
                  className="w-12 h-12 mb-4 opacity-40"
                  style={{ color: t.textMuted }}
                />
                <h3
                  className="text-lg font-semibold mb-1"
                  style={{ color: t.text }}
                >
                  {searchQuery || filterType !== "all"
                    ? "No repositories found"
                    : "No repositories yet"}
                </h3>
                <p
                  className="text-sm max-w-sm mb-4"
                  style={{ color: t.textMuted }}
                >
                  {searchQuery
                    ? "Try a different search term or clear filters."
                    : "Create your first repository to get started with Gent."}
                </p>
                <button
                  type="button"
                  onClick={openNewRepoModal}
                  className="px-4 py-2 rounded-lg text-sm font-semibold transition-all hover:shadow-lg flex items-center gap-2"
                  style={{
                    background: t.accentGradient,
                    color: t.successText,
                  }}
                >
                  <Plus className="w-4 h-4" />
                  Create repository
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {isLoading ? <SkeletonActivity isDark={isDark} /> : <ActivityFeed />}
        </div>
      </div>
    </div>
  );
}
