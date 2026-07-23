"use client";

import { useMemo, useState, useRef } from "react";
import { Filter, SortAsc, FolderGit2, Plus, RefreshCw } from "lucide-react";
import { useDashboard } from "./_components/DashboardContext";
import RepositoryCard from "./_components/RepositoryCard";
import ActivityFeed from "./_components/ActivityFeed";
import { SkeletonCard, SkeletonActivity } from "./_components/LoadingSpinner";
import { getDashboardTheme } from "./_components/dashboard-theme";
import { useRepositories } from "@/hooks/use-repositories";
import { useDashboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { Repository } from "@/types/repository";

type SortKey = "updated" | "name" | "created";

export default function DashboardPage() {
  const { isDark, searchQuery, selectedRepoId, openNewRepoModal } =
    useDashboard();
  const [sortBy, setSortBy] = useState<SortKey>("updated");
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
      case "created":
        list.sort(
          (a: Repository, b: Repository) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        );
        break;
      case "updated":
      default:
        list.sort(
          (a: Repository, b: Repository) =>
            new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
        );
        break;
    }

    return list;
  }, [repositories, searchQuery, filterType, sortBy, selectedRepoId]);

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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
        <div>
          <h1
            className="text-2xl sm:text-3xl font-bold tracking-tight"
            style={{ color: t.text }}
          >
            Dashboard
          </h1>
          <p className="text-sm mt-1" style={{ color: t.textMuted }}>
            {isLoading
              ? "Loading your repositories..."
              : `Manage your ${repositories.length} repositories`}
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isLoading}
            className="px-3 py-2.5 rounded-lg text-sm font-medium transition-all hover:opacity-80 border"
            style={{
              backgroundColor: t.elevated,
              borderColor: t.border,
              color: t.textSecondary,
            }}
          >
            <RefreshCw
              className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`}
            />
          </button>
          <button
            type="button"
            onClick={openNewRepoModal}
            className="px-4 py-2.5 rounded-lg text-sm font-semibold transition-all hover:shadow-lg flex items-center gap-2"
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Stats strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              {
                label: "Total",
                value: isLoading ? "..." : repositories.length,
              },
              {
                label: "Public",
                value: isLoading
                  ? "..."
                  : repositories.filter((r: Repository) => !r.is_private)
                      .length,
              },
              {
                label: "Private",
                value: isLoading
                  ? "..."
                  : repositories.filter((r: Repository) => r.is_private).length,
              },
              {
                label: "Updated Today",
                value: isLoading
                  ? "..."
                  : repositories.filter((r: Repository) => {
                      const today = new Date().toDateString();
                      return new Date(r.updated_at).toDateString() === today;
                    }).length,
              },
            ].map((stat) => (
              <div
                key={stat.label}
                className="rounded-lg border px-4 py-3"
                style={{
                  backgroundColor: t.elevated,
                  borderColor: t.border,
                }}
              >
                <p
                  className="text-xs font-medium uppercase tracking-wide"
                  style={{ color: t.textMuted }}
                >
                  {stat.label}
                </p>
                <p
                  className="text-2xl font-bold mt-0.5"
                  style={{ color: t.text }}
                >
                  {stat.value}
                </p>
              </div>
            ))}
          </div>

          {/* Repositories Section */}
          <div>
            <h2
              className="text-xl font-semibold mb-4"
              style={{ color: t.text }}
            >
              Your Repositories
            </h2>

            {/* Toolbar */}
            <div
              className="flex flex-wrap items-center gap-2 mb-5 p-2 rounded-lg border"
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
                <option value="updated">Last updated</option>
                <option value="created">Recently created</option>
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
