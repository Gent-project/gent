"use client";

import { useMemo, useState, useRef } from "react";
import { motion } from "framer-motion";
import { Activity, Filter, FolderGit2, Globe2, LockKeyhole, Plus, RefreshCw, SortAsc } from "lucide-react";
import { useDashboard } from "./_components/DashboardContext";
import RepositoryCard from "./_components/RepositoryCard";
import ActivityFeed from "./_components/ActivityFeed";
import { SkeletonCard, SkeletonActivity } from "./_components/LoadingSpinner";
import { getDashboardTheme } from "./_components/dashboard-theme";
import { useRepositories } from "@/hooks/use-repositories";
import { useDashboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { Repository } from "@/types/repository";

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
          r.owner_email.toLowerCase().includes(q),
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
    },
    {
      label: "Public",
      value: isLoading
        ? "..."
        : repositories.filter((r: Repository) => !r.is_private).length,
      icon: Globe2,
      tone: isDark ? "#22d3ee" : "#0891b2",
    },
    {
      label: "Private",
      value: isLoading
        ? "..."
        : repositories.filter((r: Repository) => r.is_private).length,
      icon: LockKeyhole,
      tone: isDark ? "#f472b6" : "#db2777",
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
      tone: isDark ? "#c4b5fd" : "#7c3aed",
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
    <div className="relative mx-auto max-w-[1500px] px-4 py-6 sm:px-6 sm:py-8">
      <motion.section
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="relative mb-5 overflow-hidden rounded-[2rem] border p-6 backdrop-blur-2xl sm:p-8"
        style={{ background: t.elevated, borderColor: t.border, boxShadow: t.shadow }}
      >
        <div className="pointer-events-none absolute -right-20 -top-28 h-80 w-80 rounded-full blur-[90px]" style={{ background: `${t.accent}30` }} />
        <motion.div
          aria-hidden
          animate={{ rotate: 360 }}
          transition={{ duration: 26, repeat: Infinity, ease: "linear" }}
          className="pointer-events-none absolute right-8 top-1/2 hidden h-48 w-48 -translate-y-1/2 rounded-full border lg:block"
          style={{ borderColor: t.border }}
        >
          <span className="absolute left-1/2 top-0 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ background: t.accent, boxShadow: `0 0 24px ${t.accent}` }} />
          <span className="absolute bottom-4 right-5 h-2 w-2 rounded-full" style={{ background: isDark ? "#22d3ee" : "#0891b2" }} />
        </motion.div>
        <div className="relative max-w-3xl">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.18em]" style={{ borderColor: t.border, color: t.accent, background: t.accentMuted }}>
            <span className="h-1.5 w-1.5 animate-pulse rounded-full" style={{ background: t.accent }} />
            Live workspace
          </div>
          <h1 className="font-display text-3xl font-bold tracking-tight sm:text-5xl" style={{ color: t.text }}>
            Your development control room.
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 sm:text-base" style={{ color: t.textMuted }}>
            Repositories, access, branches, and recent activity in one connected workspace.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isLoading}
            className="flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-all hover:-translate-y-0.5"
            style={{
              backgroundColor: t.elevated,
              borderColor: t.border,
              color: t.textSecondary,
            }}
          >
            <RefreshCw
              className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`}
            />
            Refresh data
          </button>
          <button
            type="button"
            onClick={openNewRepoModal}
            className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold shadow-lg transition-all hover:-translate-y-0.5 hover:scale-[1.02]"
            style={{
              background: t.accentGradient,
              color: t.successText,
            }}
          >
            <Plus className="w-4 h-4" />
            New repository
          </button>
        </div>
        </div>
      </motion.section>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 + index * 0.06 }}
            whileHover={{ y: -5, rotateX: 2, rotateY: index % 2 ? -2 : 2 }}
            className="scene group relative overflow-hidden rounded-2xl border p-4 backdrop-blur-xl sm:p-5"
            style={{ background: t.elevated, borderColor: t.border, boxShadow: t.shadow }}
          >
            <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full opacity-20 blur-2xl" style={{ background: stat.tone }} />
            <div className="flex items-start justify-between">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.16em]" style={{ color: t.textMuted }}>{stat.label}</p>
                <p className="mt-2 font-display text-3xl font-bold" style={{ color: t.text }}>{stat.value}</p>
              </div>
              <span className="flex h-10 w-10 items-center justify-center rounded-xl border" style={{ color: stat.tone, borderColor: `${stat.tone}45`, background: `${stat.tone}14` }}>
                <stat.icon className="h-5 w-5" />
              </span>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Repositories Section */}
          <div>
            <div className="mb-4 flex items-end justify-between">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.18em]" style={{ color: t.accent }}>Repository space</p>
                <h2 className="mt-1 font-display text-2xl font-semibold" style={{ color: t.text }}>Your Repositories</h2>
              </div>
              <span className="text-xs" style={{ color: t.textMuted }}>{filteredRepositories.length} visible</span>
            </div>

            {/* Toolbar */}
            <div
              className="mb-5 flex flex-wrap items-center gap-2 rounded-2xl border p-2.5 backdrop-blur-xl"
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
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <SkeletonCard key={i} isDark={isDark} />
                ))}
              </div>
            )}

            {/* Repository list */}
            {!isLoading && filteredRepositories.length > 0 && (
              <div className="space-y-3">
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
        <div className="lg:col-span-1 space-y-6">
          {isLoading ? <SkeletonActivity isDark={isDark} /> : <ActivityFeed />}
        </div>
      </div>
    </div>
  );
}
