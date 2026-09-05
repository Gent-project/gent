"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Plus, FolderGit2, GitCommit, Activity, RefreshCw } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { ProjectCard } from "@/components/features/projects/project-card";
import { CreateProjectModal } from "@/components/features/projects/create-project-modal";
import { useReposList } from "@/hooks/use-repos";
import { useAuth } from "@/hooks/use-auth";
import { timeAgo } from "@/lib/utils";

/**
 * Dashboard — landing page after sign-in.
 *
 * Three regions:
 *   1. Stats strip (count of projects, public/private split, most recent push).
 *   2. Project grid (or empty state with a CTA).
 *   3. CLI hint banner (so new users know they can mirror everything from the
 *      terminal).
 */
export default function DashboardPage() {
  const { user } = useAuth();
  const { data: repos, isLoading, isError, refetch, isFetching } = useReposList();
  const [createOpen, setCreateOpen] = useState(false);

  const stats = useMemo(() => {
    const list = repos ?? [];
    const total = list.length;
    const privateCount = list.filter((r) => r.is_private).length;
    const publicCount = total - privateCount;
    const lastUpdated = list
      .map((r) => new Date(r.updated_at).getTime())
      .sort((a, b) => b - a)[0];
    return { total, privateCount, publicCount, lastUpdated };
  }, [repos]);

  const firstName = user?.first_name || user?.email?.split("@")[0] || "there";

  return (
    <AppShell
      title={`Welcome back, ${firstName}.`}
      subtitle="Here's everything Gent is tracking for you."
      actions={
        <>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw className={`size-4 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" /> New project
          </Button>
        </>
      }
    >
      {/* Stats strip */}
      <div className="grid gap-4 md:grid-cols-3 mb-8">
        <StatCard
          icon={<FolderGit2 className="size-4" />}
          label="Total projects"
          value={stats.total}
        />
        <StatCard
          icon={<GitCommit className="size-4" />}
          label="Public / Private"
          value={`${stats.publicCount} / ${stats.privateCount}`}
        />
        <StatCard
          icon={<Activity className="size-4" />}
          label="Last activity"
          value={stats.lastUpdated ? timeAgo(stats.lastUpdated) : "—"}
        />
      </div>

      {/* Project grid */}
      <section>
        <header className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold tracking-tight">Your projects</h2>
          <span className="text-xs text-on-surface-variant">
            Auto-syncs every 30 seconds
          </span>
        </header>

        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-44 rounded-2xl" />
            ))}
          </div>
        ) : isError ? (
          <Card variant="outline" className="p-6">
            <p className="text-sm text-error">
              Couldn't load projects. Check the API and try again.
            </p>
            <Button className="mt-3" size="sm" onClick={() => refetch()}>
              Retry
            </Button>
          </Card>
        ) : (repos?.length ?? 0) === 0 ? (
          <Card variant="outline">
            <EmptyState
              icon={<FolderGit2 />}
              title="No projects yet."
              description="Create one here, then clone it from your terminal with `gent clone`. Pushes will show up live."
              action={
                <Button onClick={() => setCreateOpen(true)}>
                  <Plus className="size-4" /> Create your first project
                </Button>
              }
            />
          </Card>
        ) : (
          <motion.div
            initial="hidden"
            animate="show"
            variants={{ show: { transition: { staggerChildren: 0.05 } } }}
            className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"
          >
            {repos!.map((r, i) => (
              <ProjectCard key={r.id} repo={r} index={i} />
            ))}
          </motion.div>
        )}
      </section>

      <CreateProjectModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </AppShell>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        <span className="inline-flex size-10 items-center justify-center rounded-xl bg-primary-container text-on-primary-container">
          {icon}
        </span>
        <div>
          <p className="text-xs uppercase tracking-widest text-on-surface-variant">
            {label}
          </p>
          <p className="text-xl font-bold tracking-tight">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
