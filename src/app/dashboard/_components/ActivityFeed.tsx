"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  GitBranch,
  GitCommit,
  Tag,
  Upload,
  Download,
  Plus,
  Clock,
  User,
  ExternalLink,
} from "lucide-react";
import { useActivities } from "@/hooks/use-activities";
import { getDashboardTheme } from "./dashboard-theme";
import { useSelector } from "react-redux";
import { RootState } from "@/store";

export default function ActivityFeed() {
  const isDark = useSelector((state: RootState) => state.theme.isDark);
  const { data: activities = [], isLoading, isError } = useActivities();
  const t = getDashboardTheme(isDark);

  const getActivityIcon = (type: string) => {
    switch (type) {
      case "push":
        return <Upload className="w-4 h-4" style={{ color: t.accent }} />;
      case "pull_request":
        return <Download className="w-4 h-4" style={{ color: t.accent }} />;
      case "branch_created":
        return <GitBranch className="w-4 h-4" style={{ color: "#10b981" }} />;
      case "tag_created":
        return <Tag className="w-4 h-4" style={{ color: "#f59e0b" }} />;
      case "repository_created":
        return <Plus className="w-4 h-4" style={{ color: "#06b6d4" }} />;
      default:
        return <GitCommit className="w-4 h-4" style={{ color: t.textMuted }} />;
    }
  };

  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return `${diffInSeconds}s ago`;
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400)
      return `${Math.floor(diffInSeconds / 3600)}h ago`;
    if (diffInSeconds < 2592000)
      return `${Math.floor(diffInSeconds / 86400)}d ago`;
    if (diffInSeconds < 31536000)
      return `${Math.floor(diffInSeconds / 2592000)}mo ago`;
    return `${Math.floor(diffInSeconds / 31536000)}y ago`;
  };

  if (isLoading) {
    return (
      <div
        className="rounded-lg border p-6"
        style={{
          backgroundColor: t.elevated,
          borderColor: t.border,
        }}
      >
        <h3 className="text-lg font-semibold mb-4" style={{ color: t.text }}>
          Recent Activity
        </h3>
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 animate-pulse">
              <div className="w-8 h-8 bg-gray-300 rounded-full"></div>
              <div className="flex-1">
                <div className="h-4 bg-gray-300 rounded mb-1"></div>
                <div className="h-3 bg-gray-300 rounded w-2/3"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div
        className="rounded-lg border p-6 text-center"
        style={{
          backgroundColor: t.elevated,
          borderColor: t.border,
        }}
      >
        <h3 className="text-lg font-semibold mb-2" style={{ color: t.text }}>
          Recent Activity
        </h3>
        <p className="text-sm" style={{ color: t.textMuted }}>
          Unable to load recent activity right now.
        </p>
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div
        className="rounded-lg border p-6 text-center"
        style={{
          backgroundColor: t.elevated,
          borderColor: t.border,
        }}
      >
        <h3 className="text-lg font-semibold mb-2" style={{ color: t.text }}>
          Recent Activity
        </h3>
        <Clock
          className="w-12 h-12 mx-auto mb-3 opacity-40"
          style={{ color: t.textMuted }}
        />
        <p className="text-sm" style={{ color: t.textMuted }}>
          No recent activity to show. Start by creating a repository or making
          some commits.
        </p>
      </div>
    );
  }

  return (
    <div
      className="rounded-lg border p-6"
      style={{
        backgroundColor: t.elevated,
        borderColor: t.border,
      }}
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold" style={{ color: t.text }}>
          Recent Activity
        </h3>
      </div>

      <div className="space-y-3">
        {activities.slice(0, 10).map((activity, index) => (
          <motion.div
            key={activity.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.05 }}
            className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
          >
            <div
              className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center"
              style={{ backgroundColor: t.surface }}
            >
              {getActivityIcon(activity.type)}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium text-sm" style={{ color: t.text }}>
                  {activity.title}
                </span>
                {activity.repository && (
                  <span
                    className="px-2 py-0.5 text-xs rounded-full"
                    style={{
                      backgroundColor: t.accentMuted,
                      color: t.accent,
                    }}
                  >
                    {activity.repository.name}
                  </span>
                )}
              </div>

              <p className="text-xs mb-1" style={{ color: t.textMuted }}>
                {activity.message}
              </p>

              <div
                className="flex items-center gap-3 text-xs"
                style={{ color: t.textMuted }}
              >
                {activity.actor && (
                  <span className="flex items-center gap-1">
                    <User className="w-3 h-3" />
                    {activity.actor.name}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {formatRelativeTime(
                    activity.created_at || activity.createdAt || "",
                  )}
                </span>
                {activity.url && (
                  <Link
                    href={activity.url}
                    className="flex items-center gap-1 hover:underline"
                  >
                    <ExternalLink className="w-3 h-3" />
                    View
                  </Link>
                )}
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
