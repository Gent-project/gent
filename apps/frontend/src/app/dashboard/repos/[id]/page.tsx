"use client";

import {
  ArrowLeft,
  Star,
  Lock,
  Globe,
  GitBranch,
  Settings,
  Tag,
  Plus,
} from "lucide-react";
import { useDashboard } from "../../_components/DashboardContext";
import { getDashboardTheme } from "../../_components/dashboard-theme";
import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import axios from "@/lib/axios";

interface Repository {
  id: number;
  owner_id: number;
  owner_email: string;
  name: string;
  description: string;
  is_private: boolean;
  default_branch: string;
  created_at: string;
  updated_at: string;
}
export default function RepositoryDetailPage() {
  const { isDark } = useDashboard();
  const theme = getDashboardTheme(isDark);
  const [repoData, setRepoData] = useState<Repository | null>(null);
  const [loading, setLoading] = useState(true);

  const params = useParams();
  const repoId = params.id as string;
  useEffect(() => {
    const fetchRepo = async () => {
      try {
        console.log("Fetching repo:", repoId);
        const response = await axios.get(`/repos/${repoId}/dev/`);
        console.log("Response:", response);
        console.log("Data:", response.data);
        setRepoData(response.data);
      } catch (error) {
        console.error(error);
      }
    };

    fetchRepo();
  }, [repoId]);
  console.log(repoId);
  console.log(repoData);

  const placeholder = "-";

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p
            className="text-sm uppercase tracking-[0.3em] mb-2"
            style={{ color: theme.accent }}
          >
            Repository details
          </p>
          <h1 className="text-3xl font-semibold" style={{ color: theme.text }}>
            {repoData?.name}
          </h1>
          <p
            className="mt-3 max-w-2xl text-sm leading-7"
            style={{ color: theme.textMuted }}
          >
            {repoData?.description}
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors"
            style={{
              borderColor: theme.border,
              color: theme.textSecondary,
              backgroundColor: theme.surface,
            }}
          >
            <ArrowLeft className="w-4 h-4" /> Edit Repository
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors"
            style={{
              borderColor: theme.border,
              color: theme.textSecondary,
              backgroundColor: theme.surface,
            }}
          >
            Delete Repository
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium"
            style={{
              background: theme.accentGradient,
              color: theme.successText,
            }}
          >
            Clone
          </button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 mb-8 ">
        {[
          { label: "Repository ID", value: repoData?.id },
          { label: "Owner ID", value: repoData?.owner_id },
          { label: "Default Branch", value: repoData?.default_branch },
          {
            label: "Visibility",
            value: repoData?.is_private ? "Private" : "Public",
          },
          { label: "Created Date", value: repoData?.created_at },
          { label: "Last Updated", value: repoData?.updated_at },
        ].map((item) => (
          <div
            key={item.label}
            className="rounded-3xl border p-5 "
            style={{
              backgroundColor: theme.elevated,
              borderColor: theme.border,
            }}
          >
            <p
              className="text-xs uppercase tracking-[0.25em] mb-2 "
              style={{ color: theme.textMuted }}
            >
              {item.label}
            </p>
            <p className="text-sm font-semibold" style={{ color: theme.text }}>
              {item.value}
            </p>
          </div>
        ))}
      </div>

      <div className="mb-8 border-b border-muted/20 pb-4">
        <nav
          className="flex flex-wrap gap-3 text-sm font-semibold"
          aria-label="Repository sections"
        >
          {[
            { label: "Overview", active: true },
            { label: "Branches", active: false },
            { label: "Commits", active: false },
            { label: "Tags", active: false },
            { label: "Settings", active: false },
          ].map((tab) => (
            <button
              key={tab.label}
              type="button"
              className={`rounded-full px-4 py-2 transition ${tab.active ? "border bg-slate-900/10" : "border border-transparent hover:bg-slate-800/10"}`}
              style={{
                borderColor: tab.active ? theme.accent : "transparent",
                color: tab.active ? theme.text : theme.textSecondary,
                backgroundColor: tab.active ? theme.surface : "transparent",
              }}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.9fr_1fr]">
        <div className="space-y-6">
          <section
            className="rounded-3xl border p-6"
            style={{
              backgroundColor: theme.elevated,
              borderColor: theme.border,
            }}
          >
            <h2
              className="text-base font-semibold mb-4"
              style={{ color: theme.text }}
            >
              Repository information
            </h2>
            <div className="space-y-4 text-sm">
              {[
                { label: "Name", value: repoData?.name },
                { label: "Description", value: repoData?.description },
                {
                  label: "Visibility",
                  value: repoData?.is_private ? "Private" : "Public",
                },
                { label: "Default Branch", value: repoData?.default_branch },
                { label: "Owner", value: repoData?.owner_email },
                { label: "Created Date", value: repoData?.created_at },
                { label: "Last Updated", value: repoData?.updated_at },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-9">
                  <span style={{ color: theme.textMuted }}>{item.label}</span>
                  <span style={{ color: theme.text }}>{item.value}</span>
                </div>
              ))}
            </div>
          </section>

          <section
            className="rounded-3xl border p-6"
            style={{
              backgroundColor: theme.elevated,
              borderColor: theme.border,
            }}
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
              <div>
                <p
                  className="text-sm font-semibold uppercase tracking-[0.25em] mb-1"
                  style={{ color: theme.textMuted }}
                >
                  Activity
                </p>
                <h2
                  className="text-xl font-semibold"
                  style={{ color: theme.text }}
                >
                  Repository activity
                </h2>
              </div>
              <span
                className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold"
                style={{
                  borderColor: theme.border,
                  color: theme.textSecondary,
                }}
              >
                <GitBranch className="w-3.5 h-3.5" /> {placeholder}
              </span>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {[
                { label: "Visibility", value: placeholder, icon: Globe },
                { label: "Language", value: placeholder },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-2xl border p-4"
                  style={{
                    borderColor: theme.border,
                    backgroundColor: theme.canvas,
                  }}
                >
                  <p
                    className="text-xs uppercase tracking-[0.25em] mb-2"
                    style={{ color: theme.textMuted }}
                  >
                    {item.label}
                  </p>
                  <div
                    className="flex items-center gap-2 text-sm font-semibold"
                    style={{ color: theme.text }}
                  >
                    {item.icon ? <item.icon className="w-4 h-4" /> : null}
                    {item.value}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              {[
                { label: "Stars", value: placeholder },
                { label: "Forks", value: placeholder },
                { label: "Updated", value: placeholder },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-2xl border p-4"
                  style={{
                    borderColor: theme.border,
                    backgroundColor: theme.surface,
                  }}
                >
                  <p
                    className="text-xs uppercase tracking-[0.25em] mb-2"
                    style={{ color: theme.textMuted }}
                  >
                    {item.label}
                  </p>
                  <p
                    className="text-2xl font-semibold"
                    style={{ color: theme.text }}
                  >
                    {item.value}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section
            className="rounded-3xl border p-6"
            style={{
              backgroundColor: theme.elevated,
              borderColor: theme.border,
            }}
          >
            <h2
              className="text-base font-semibold mb-4"
              style={{ color: theme.text }}
            >
              Owner information
            </h2>
            <div className="space-y-4 text-sm">
              {[
                { label: "Owner ID", value: placeholder },
                { label: "Owner Email", value: placeholder },
              ].map((item) => (
                <div
                  key={item.label}
                  className="flex items-center justify-between gap-4"
                >
                  <span style={{ color: theme.textMuted }}>{item.label}</span>
                  <span style={{ color: theme.text }}>{item.value}</span>
                </div>
              ))}
            </div>
          </section>
        </div>

        <aside className="space-y-6">
          <section
            className="rounded-3xl border p-6"
            style={{
              backgroundColor: theme.elevated,
              borderColor: theme.border,
            }}
          >
            <h2
              className="text-base font-semibold mb-4"
              style={{ color: theme.text }}
            >
              Quick actions
            </h2>
            <div className="space-y-3">
              {[
                { label: "Create Branch", icon: Plus },
                { label: "Create Commit", icon: Star },
                { label: "Create Tag", icon: Tag },
                { label: "Repository Settings", icon: Settings },
              ].map((action) => {
                const Icon = action.icon;
                return (
                  <button
                    key={action.label}
                    type="button"
                    className="w-full inline-flex items-center justify-between rounded-2xl border px-4 py-3 text-sm font-semibold transition-colors"
                    style={{
                      borderColor: theme.border,
                      color: theme.text,
                      backgroundColor: theme.surface,
                    }}
                  >
                    <span className="inline-flex items-center gap-2">
                      <Icon className="w-4 h-4" /> {action.label}
                    </span>
                    <span
                      className="text-xs"
                      style={{ color: theme.textMuted }}
                    >
                      →
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
