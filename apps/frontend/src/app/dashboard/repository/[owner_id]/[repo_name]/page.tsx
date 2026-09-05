"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  CalendarDays,
  Check,
  ChevronRight,
  Code2,
  Copy,
  Download,
  GitBranch,
  GitCommit,
  Globe2,
  Info,
  LockKeyhole,
  Settings,
  Tag,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { useSelector } from "react-redux";
import { useRepository } from "@/hooks/use-repositories";
import { useBranches } from "@/hooks/use-branches";
import { useCommits } from "@/hooks/use-commits";
import { useTags } from "@/hooks/use-tags";
import { RootState } from "@/store";
import { getCloneUrl } from "@/hooks/use-git-operations";
import GitOperationsModal from "./_components/GitOperationsModal";
import CommitsTab from "./_components/CommitsTab";
import BranchesTab from "./_components/BranchesTab";
import TagsTab from "./_components/TagsTab";
import FileBrowserTab from "./_components/FileBrowserTab";
import { getDashboardTheme } from "@/app/dashboard/_components/dashboard-theme";
import GentiCliGuide from "@/app/dashboard/_components/GentiCliGuide";

type TabType = "code" | "commits" | "branches" | "tags";

export default function RepositoryPage() {
  const params = useParams();
  const isDark = useSelector((state: RootState) => state.theme.isDark);
  const [activeTab, setActiveTab] = useState<TabType>("code");
  const [showGitOpsModal, setShowGitOpsModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const ownerId = parseInt(params.owner_id as string);
  const repoName = params.repo_name as string;

  const { data: repository, isLoading: repoLoading, error: repoError } = useRepository(ownerId, repoName);
  const { data: branches = [], isLoading: branchesLoading } = useBranches(ownerId, repoName);
  const { data: commits = [], isLoading: commitsLoading } = useCommits(ownerId, repoName);
  const { data: tags = [], isLoading: tagsLoading } = useTags(ownerId, repoName);
  const t = getDashboardTheme(isDark);

  if (repoLoading) {
    return (
      <div className="mx-auto max-w-[1380px] animate-pulse space-y-5 px-4 py-6 sm:px-6">
        <div className="h-5 w-56 rounded" style={{ background: t.border }} />
        <div className="h-40 rounded-2xl border" style={{ background: t.elevated, borderColor: t.border }} />
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
          <div className="h-[460px] rounded-2xl border" style={{ background: t.elevated, borderColor: t.border }} />
          <div className="h-72 rounded-2xl border" style={{ background: t.elevated, borderColor: t.border }} />
        </div>
      </div>
    );
  }

  if (repoError || !repository) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <div className="rounded-2xl border p-10 text-center" style={{ background: t.elevated, borderColor: t.border }}>
          <h1 className="text-xl font-semibold" style={{ color: t.text }}>Repository not found</h1>
          <p className="mt-2 text-sm" style={{ color: t.textMuted }}>This repository does not exist or you do not have access to it.</p>
          <Link href="/dashboard" className="mt-5 inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold" style={{ background: t.accent, color: t.successText }}>
            <ArrowLeft className="h-4 w-4" /> Back to dashboard
          </Link>
        </div>
      </div>
    );
  }

  const owner = repository.owner_email.split("@")[0];
  const cloneUrl = getCloneUrl(repository.owner_id, repository.name);
  const latestCommit = commits[0];
  const formatDate = (dateString: string) => new Date(dateString).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  const tabs = [
    { id: "code" as TabType, label: "Code", icon: Code2, count: null },
    { id: "commits" as TabType, label: "Commits", icon: GitCommit, count: commits.length },
    { id: "branches" as TabType, label: "Branches", icon: GitBranch, count: branches.length },
    { id: "tags" as TabType, label: "Tags", icon: Tag, count: tags.length },
  ];

  const copyCloneUrl = async () => {
    await navigator.clipboard.writeText(cloneUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className="mx-auto max-w-[1380px] px-4 py-5 sm:px-6 sm:py-7">
      <nav className="mb-4 flex min-w-0 items-center gap-1.5 text-xs" style={{ color: t.textMuted }} aria-label="Repository breadcrumb">
        <Link href="/dashboard" className="inline-flex items-center gap-1.5 hover:underline"><ArrowLeft className="h-3.5 w-3.5" /> Repositories</Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span data-no-translate>{owner}</span>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="truncate font-medium" style={{ color: t.text }} data-no-translate>{repository.name}</span>
      </nav>

      <motion.header initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="overflow-hidden rounded-2xl border" style={{ background: t.elevated, borderColor: t.border }}>
        <div className="flex flex-col gap-5 p-5 sm:p-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ background: t.accentMuted, color: t.accent }}><Code2 className="h-4.5 w-4.5" /></span>
              <h1 className="min-w-0 text-xl font-bold tracking-tight sm:text-2xl" style={{ color: t.text }}>
                <span data-no-translate><span style={{ color: t.textMuted }}>{owner} / </span>{repository.name}</span>
              </h1>
              <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold" style={{ borderColor: t.border, color: t.textMuted }}>
                {repository.is_private ? <><LockKeyhole className="h-2.5 w-2.5" /> Private</> : <><Globe2 className="h-2.5 w-2.5" /> Public</>}
              </span>
            </div>
            <p className="mt-3 max-w-3xl text-sm leading-6" style={{ color: t.textMuted }} data-no-translate={Boolean(repository.description) || undefined}>{repository.description || "No description provided."}</p>
            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 font-mono text-[10px]" style={{ color: t.textMuted }}>
              <span className="inline-flex items-center gap-1.5" data-no-translate><GitBranch className="h-3 w-3" />{repository.default_branch}</span>
              <span className="inline-flex items-center gap-1.5" data-no-translate><UserRound className="h-3 w-3" />{owner}</span>
              <span className="inline-flex items-center gap-1.5"><CalendarDays className="h-3 w-3" />updated {formatDate(repository.updated_at)}</span>
              {latestCommit && <span className="inline-flex items-center gap-1.5"><GitCommit className="h-3 w-3" />{latestCommit.sha.slice(0, 7)}</span>}
            </div>
          </div>
          <Link href={`/dashboard/repository/${ownerId}/${repoName}/settings`} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border px-3.5 py-2 text-sm font-medium" style={{ borderColor: t.border, color: t.text, background: t.inputBg }}>
            <Settings className="h-4 w-4" /> Settings
          </Link>
        </div>

        <nav className="flex overflow-x-auto border-t px-2 sm:px-4" style={{ borderColor: t.borderMuted }} aria-label="Repository sections">
          {tabs.map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} className="relative flex shrink-0 items-center gap-2 px-3 py-3 text-sm font-medium transition-colors" style={{ color: activeTab === tab.id ? t.text : t.textMuted }}>
              <tab.icon className="h-4 w-4" />{tab.label}
              {tab.count !== null && <span className="rounded-full px-1.5 py-0.5 font-mono text-[9px]" style={{ background: t.accentMuted, color: activeTab === tab.id ? t.accent : t.textMuted }}>{tab.count}</span>}
              {activeTab === tab.id && <motion.span layoutId="repo-tab" className="absolute inset-x-2 bottom-0 h-0.5 rounded-full" style={{ background: t.accent }} />}
            </button>
          ))}
        </nav>
      </motion.header>

      <motion.div key={activeTab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-5 grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
        <section className="min-w-0 overflow-hidden rounded-2xl border" style={{ background: t.elevated, borderColor: t.border }}>
          <div className={activeTab === "code" ? "p-3 sm:p-4" : "p-5 sm:p-6"}>
            {activeTab === "code" && <FileBrowserTab ownerId={ownerId} repoName={repoName} isDark={isDark} defaultBranch={repository.default_branch} userEmail={repository.owner_email} />}
            {activeTab === "commits" && <CommitsTab commits={commits} isLoading={commitsLoading} isDark={isDark} ownerName={owner} repoName={repoName} ownerId={repository.owner_id} />}
            {activeTab === "branches" && <BranchesTab branches={branches} isLoading={branchesLoading} isDark={isDark} defaultBranch={repository.default_branch} ownerId={ownerId} repoName={repoName} userEmail={repository.owner_email} />}
            {activeTab === "tags" && <TagsTab tags={tags} isLoading={tagsLoading} isDark={isDark} ownerId={ownerId} repoName={repoName} branches={branches} userEmail={repository.owner_email} />}
          </div>
        </section>

        <aside className="space-y-4">
          <GentiCliGuide
            isDark={isDark}
            repository={repository}
            hasContent={commits.length > 0}
          />

          <section className="rounded-2xl border p-4" style={{ background: t.elevated, borderColor: t.border }}>
            <h2 className="flex items-center gap-2 text-sm font-semibold" style={{ color: t.text }}><Info className="h-4 w-4" style={{ color: t.accent }} /> About</h2>
            <p className="mt-3 text-xs leading-5" style={{ color: t.textMuted }} data-no-translate={Boolean(repository.description) || undefined}>{repository.description || "No description provided for this repository."}</p>
            <div className="mt-4 space-y-2 border-t pt-4 text-xs" style={{ borderColor: t.borderMuted, color: t.textMuted }}>
              <div className="flex justify-between gap-4"><span>Created</span><span>{formatDate(repository.created_at)}</span></div>
              <div className="flex justify-between gap-4"><span>Repository ID</span><span className="font-mono">{repository.id}</span></div>
            </div>
          </section>

          <section className="rounded-2xl border p-4" style={{ background: t.elevated, borderColor: t.border }}>
            <h2 className="text-sm font-semibold" style={{ color: t.text }}>Clone repository</h2>
            <div className="mt-3 flex overflow-hidden rounded-lg border" style={{ borderColor: t.border }}>
              <input value={cloneUrl} readOnly className="min-w-0 flex-1 px-3 py-2 font-mono text-[10px] outline-none" style={{ background: t.inputBg, color: t.textMuted }} aria-label="Clone URL" />
              <button onClick={copyCloneUrl} className="flex w-10 shrink-0 items-center justify-center border-l" style={{ borderColor: t.border, color: copied ? t.accent : t.textMuted }} aria-label="Copy clone URL">
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
            <button onClick={() => setShowGitOpsModal(true)} className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold" style={{ background: t.accent, color: t.successText }}><Download className="h-3.5 w-3.5" /> Clone & Git operations</button>
          </section>

          <section className="grid grid-cols-3 overflow-hidden rounded-2xl border" style={{ background: t.elevated, borderColor: t.border }}>
            {[{ label: "Commits", value: commits.length }, { label: "Branches", value: branches.length }, { label: "Tags", value: tags.length }].map((stat) => (
              <div key={stat.label} className="border-r px-2 py-4 text-center last:border-r-0" style={{ borderColor: t.borderMuted }}>
                <div className="text-lg font-bold" style={{ color: t.text }}>{stat.value}</div>
                <div className="mt-0.5 text-[10px]" style={{ color: t.textMuted }}>{stat.label}</div>
              </div>
            ))}
          </section>
        </aside>
      </motion.div>

      <GitOperationsModal isOpen={showGitOpsModal} onClose={() => setShowGitOpsModal(false)} ownerId={ownerId} repoName={repoName} isDark={isDark} repositoryUrl={cloneUrl} defaultBranch={repository.default_branch} />
    </div>
  );
}
