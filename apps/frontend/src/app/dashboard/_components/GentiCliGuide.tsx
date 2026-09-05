"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Check,
  Clipboard,
  Download,
  GitMerge,
  RefreshCw,
  Rocket,
  Upload,
  type LucideIcon,
} from "lucide-react";
import GentiMascot, { type GentiScene } from "@/app/components/site/GentiMascot";
import type { Repository } from "@/types/repository";
import { getDashboardTheme } from "./dashboard-theme";

type WorkflowKey = "guide" | "push" | "pull" | "merge";

interface Workflow {
  label: string;
  title: string;
  description: string;
  scene: GentiScene;
  icon: LucideIcon;
  commands: string[];
}

export default function GentiCliGuide({
  isDark,
  repository,
  hasContent,
}: {
  isDark: boolean;
  repository?: Repository;
  hasContent: boolean;
}) {
  const [activeKey, setActiveKey] = useState<WorkflowKey>("guide");
  const [copied, setCopied] = useState(false);
  const t = getDashboardTheme(isDark);
  const branch = repository?.default_branch || "main";
  const remoteUrl = repository
    ? `https://gent-api.onrender.com/api/repos/${repository.owner_id}/${repository.name}`
    : "https://gent-api.onrender.com/api/repos/<owner_id>/<repo_name>";
  const workflows: Record<WorkflowKey, Workflow> = {
    guide: hasContent
      ? {
          label: "Update",
          title: "Ship your next update",
          description: "Sync first, record your changes, then publish them safely.",
          scene: "push",
          icon: RefreshCw,
          commands: [
            `gent pull origin ${branch}`,
            "gent add .",
            'gent commit -m "Update project"',
            `gent push origin ${branch}`,
          ],
        }
      : {
          label: "First push",
          title: "Publish this repository",
          description: "Genti will initialize your folder and send its first commit here.",
          scene: "push",
          icon: Rocket,
          commands: [
            "gent init",
            `gent remote add origin ${remoteUrl}`,
            "gent add .",
            'gent commit -m "Initial commit"',
            `gent push origin ${branch}`,
          ],
        },
    push: {
      label: "Push",
      title: "Publish local commits",
      description: "Check your working tree, then upload the current branch.",
      scene: "push",
      icon: Upload,
      commands: ["gent status", `gent push origin ${branch}`],
    },
    pull: {
      label: "Pull",
      title: "Bring remote changes home",
      description: "Download the latest remote commits and merge them locally.",
      scene: "pull",
      icon: Download,
      commands: [`gent pull origin ${branch}`],
    },
    merge: {
      label: "Merge",
      title: "Combine two branches",
      description: "Merge a feature into your current branch, then publish the result.",
      scene: "merge",
      icon: GitMerge,
      commands: ["gent merge <branch>", `gent push origin ${branch}`],
    },
  };
  const workflowKeys = Object.keys(workflows) as WorkflowKey[];
  const active = workflows[activeKey];
  const commands = active.commands;

  async function copyCommands() {
    await navigator.clipboard.writeText(commands.join("\n"));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  function selectWorkflow(key: WorkflowKey) {
    setActiveKey(key);
    setCopied(false);
  }

  return (
    <section
      className="relative overflow-hidden rounded-2xl border"
      style={{ background: t.elevated, borderColor: t.border, boxShadow: t.shadow }}
      aria-labelledby="genti-guide-title"
    >
      <div
        className="pointer-events-none absolute -right-12 -top-16 h-40 w-40 rounded-full blur-3xl"
        style={{ background: `${t.accent}18` }}
      />

      <div className="relative flex items-center justify-between gap-3 border-b px-4 py-3.5" style={{ borderColor: t.borderMuted }}>
        <div>
          <p className="font-mono text-[9px] uppercase tracking-[0.18em]" style={{ color: t.accent }}>
            Repository CLI guide
          </p>
          <h2 id="genti-guide-title" className="mt-1 font-display text-base font-semibold" style={{ color: t.text }}>
            Ask Genti how it works
          </h2>
        </div>
        {repository ? (
          <span className="inline-flex max-w-[120px] items-center gap-1.5 truncate rounded-full border px-2 py-1 font-mono text-[8px]" style={{ borderColor: t.border, color: hasContent ? t.accentHover : t.accentTertiary }}>
            <motion.span animate={{ opacity: [0.35, 1, 0.35] }} transition={{ duration: 1.8, repeat: Infinity }} className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: "currentColor" }} />
            <span>{hasContent ? "Ready for updates" : "Empty repository"}</span>
          </span>
        ) : (
          <span className="rounded-full border px-2 py-1 font-mono text-[8px]" style={{ borderColor: t.border, color: t.textMuted }}>
            CLI coach
          </span>
        )}
      </div>

      <div className="grid grid-cols-4 gap-1.5 p-3" role="tablist" aria-label="Gent workflows">
        {workflowKeys.map((key) => {
          const workflow = workflows[key];
          const Icon = workflow.icon;
          const selected = activeKey === key;
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => selectWorkflow(key)}
              className="flex min-w-0 flex-col items-center gap-1.5 rounded-lg border px-1 py-2 text-[10px] font-medium transition-all"
              style={{
                background: selected ? t.sidebarActive : "transparent",
                borderColor: selected ? `${t.accent}55` : t.borderMuted,
                color: selected ? t.accent : t.textMuted,
              }}
            >
              <Icon className="h-3.5 w-3.5" />
              {workflow.label}
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={`${activeKey}-${hasContent ? "ready" : "empty"}`}
          role="tabpanel"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.2 }}
          className="px-4 pb-4"
        >
          <div className="flex items-center gap-1 overflow-hidden rounded-xl border" style={{ borderColor: t.borderMuted, background: t.inputBg }}>
            <GentiMascot scene={active.scene} className="h-[76px] w-[142px] shrink-0" title={`Genti demonstrates ${active.label}`} />
            <div className="min-w-0 pe-3">
              <h3 className="text-sm font-semibold" style={{ color: t.text }}>{active.title}</h3>
              <p className="mt-1 text-[11px] leading-4" style={{ color: t.textMuted }}>{active.description}</p>
            </div>
          </div>

          <div data-no-translate className="mt-3 overflow-hidden rounded-xl border font-mono text-[10px]" style={{ borderColor: t.border, background: isDark ? "#080713" : "#17152c" }}>
            <div className="flex items-center gap-1.5 border-b px-3 py-2" style={{ borderColor: "rgba(255,255,255,.09)", color: "rgba(255,255,255,.48)" }}>
              <span className="h-1.5 w-1.5 rounded-full bg-[#f472b6]" />
              <span className="h-1.5 w-1.5 rounded-full bg-[#e0b64d]" />
              <span className="h-1.5 w-1.5 rounded-full bg-[#22d3ee]" />
              <span className="ms-1">gent — zsh</span>
            </div>
            <div className="space-y-1.5 px-3 py-3 text-left" dir="ltr">
              {commands.map((command, index) => (
                <motion.div key={command} initial={{ opacity: 0, x: -5 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.08 }} className="flex gap-2">
                  <span style={{ color: t.accentHover }}>›</span>
                  <span className="break-all text-[#f5f3ff]">{command}</span>
                </motion.div>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={copyCommands}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors"
            style={{ borderColor: t.border, background: copied ? t.sidebarActive : "transparent", color: copied ? t.accent : t.textSecondary }}
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Clipboard className="h-3.5 w-3.5" />}
            <span aria-live="polite">{copied ? "Copied" : "Copy commands"}</span>
          </button>
        </motion.div>
      </AnimatePresence>
    </section>
  );
}
