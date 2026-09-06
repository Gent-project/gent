"use client";

import Link from "next/link";
import { createContext, useContext, useState, useEffect, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useDispatch, useSelector } from "react-redux";
import axios from "@/lib/axios";
import { RootState } from "@/store";
import { toggleTheme } from "@/store/slices/theme-slice";
import { useProfile } from "@/hooks/use-auth-profile";
import { getStoredToken } from "@/lib/auth-session";
import { hydrateAuth } from "@/store/slices/auth-slice";
import { AUTH_PATH } from "@/routes/path";
import API_ROUTES from "@/constant/api-routes";
import DashboardSidebar from "./DashboardSidebar";
import DashboardTopBar from "./DashboardTopBar";
import NewRepositoryModal from "./NewRepositoryModal";
import { getDashboardTheme } from "./dashboard-theme";
import type { MockRepository } from "../_data/mock-repos";

type DashboardContextValue = {
  isDark: boolean;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  selectedRepoId: string | null;
  setSelectedRepoId: (id: string | null) => void;
  openNewRepoModal: () => void;
  repositories: MockRepository[];
  reposLoading: boolean;
};

const DashboardCtx = createContext<DashboardContextValue | null>(null);

export function useDashboard() {
  const ctx = useContext(DashboardCtx);
  if (!ctx)
    throw new Error("useDashboard must be used within DashboardProvider");
  return ctx;
}

export function DashboardProvider({ children }: { children: React.ReactNode }) {
  const dispatch = useDispatch();
  const router = useRouter();
  const pathname = usePathname();
  const isDark = useSelector((state: RootState) => state.theme.isDark);
  const token = useSelector((state: RootState) => state.auth.token);
  const [authChecked, setAuthChecked] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRepoId, setSelectedRepoId] = useState<string | null>(null);
  const [newRepoOpen, setNewRepoOpen] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [repositories, setRepositories] = useState<MockRepository[]>([]);
  const [reposLoading, setReposLoading] = useState(true);
  const [repoCreateLoading, setRepoCreateLoading] = useState(false);

  const t = getDashboardTheme(isDark);

  useEffect(() => {
    dispatch(hydrateAuth());
    setAuthChecked(true);
  }, [dispatch]);

  const hasToken = !!token || !!getStoredToken();
  const isRepositoryReadRoute = /^\/dashboard\/repository\/[^/]+\/[^/]+\/?$/.test(pathname);
  const loginHref = `${AUTH_PATH.LOGIN}?next=${encodeURIComponent(pathname)}`;
  const isRepositoryFallbackRoute =
    pathname === "/dashboard/repository" ||
    /^\/dashboard\/repository\/[^/]+$/.test(pathname);

  useEffect(() => {
    if (!authChecked) return;
    if (isRepositoryFallbackRoute) return;
    if (!hasToken) {
      setRepositories([]);
      setReposLoading(false);
      if (!isRepositoryReadRoute) router.replace(loginHref);
      return;
    }

    let active = true;
    const loadRepos = async () => {
      setReposLoading(true);
      try {
        const { data } = await axios.get(API_ROUTES.REPOS.LIST);
        if (!active) return;
        if (!Array.isArray(data)) {
          setRepositories([]);
          return;
        }

        setRepositories(
          data.map((repo: any) => ({
            id: String(repo.id ?? repo.owner_email ?? repo.name ?? ""),
            name: String(repo.name ?? ""),
            owner:
              typeof repo.owner === "string" && repo.owner
                ? repo.owner
                : typeof repo.owner_email === "string"
                  ? repo.owner_email.split("@")[0]
                  : "unknown",
            description: String(repo.description ?? ""),
            isPrivate: Boolean(repo.is_private),
            stars: typeof repo.stars === "number" ? repo.stars : 0,
            forks: typeof repo.forks === "number" ? repo.forks : 0,
            language: String(repo.language ?? "Unknown"),
            languageColor: String(repo.language_color ?? "#94a3b8"),
            updatedAt: repo.updated_at
              ? new Date(repo.updated_at).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                })
              : "",
            defaultBranch: String(repo.default_branch ?? "main"),
          })),
        );
      } catch (error) {
        console.error("Failed to load repositories:", error);
        setRepositories([]);
      } finally {
        if (active) setReposLoading(false);
      }
    };

    loadRepos();

    return () => {
      active = false;
    };
  }, [authChecked, hasToken, isRepositoryFallbackRoute, isRepositoryReadRoute, loginHref, router]);

  const handleCreateRepository = async (repo: {
    name: string;
    description: string;
    isPrivate: boolean;
  }): Promise<void> => {
    if (!repo.name.trim()) throw new Error("Repository name is required");

    setRepoCreateLoading(true);
    try {
      const { data } = await axios.post(API_ROUTES.REPOS.CREATE, {
        name: repo.name,
        description: repo.description,
        is_private: repo.isPrivate,
      });

      const createdRepo: MockRepository = {
        id: String(data.id ?? data.owner_email ?? data.name ?? ""),
        name: String(data.name ?? repo.name),
        owner:
          typeof data.owner === "string" && data.owner
            ? data.owner
            : typeof data.owner_email === "string"
              ? data.owner_email.split("@")[0]
              : "unknown",
        description: String(data.description ?? repo.description ?? ""),
        isPrivate: Boolean(data.is_private),
        stars: 0,
        forks: 0,
        language: "Unknown",
        languageColor: "#94a3b8",
        updatedAt: data.updated_at
          ? new Date(data.updated_at).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
            })
          : "",
        defaultBranch: String(data.default_branch ?? "main"),
      };

      setRepositories((current) => [createdRepo, ...current]);
      setSelectedRepoId(createdRepo.id);
    } finally {
      setRepoCreateLoading(false);
    }
  };

  useProfile(authChecked && hasToken);

  const filteredCount = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return repositories.length;
    return repositories.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q),
    ).length;
  }, [searchQuery, repositories]);

  if (!authChecked) return null;
  if (isRepositoryFallbackRoute && !hasToken) return <>{children}</>;
  if (!hasToken) {
    if (!isRepositoryReadRoute) return null;
    return (
      <div className="min-h-screen" style={{ background: t.canvas, color: t.text }}>
        <header className="flex flex-wrap items-center justify-between gap-4 border-b px-6 py-4" style={{ borderColor: t.border }}>
          <Link href="/" className="text-xl font-bold">Gent</Link>
          <div className="flex items-center gap-4 text-sm">
            <span>Public repository</span>
            <Link href={loginHref} className="rounded-lg border px-4 py-2" style={{ borderColor: t.border }}>Sign in</Link>
            <Link href="/auth/signup" className="rounded-lg px-4 py-2" style={{ background: t.accent, color: t.successText }}>Sign up</Link>
          </div>
        </header>
        <main>{children}</main>
      </div>
    );
  }

  return (
    <DashboardCtx.Provider
      value={{
        isDark,
        searchQuery,
        setSearchQuery,
        selectedRepoId,
        setSelectedRepoId,
        openNewRepoModal: () => setNewRepoOpen(true),
        repositories,
        reposLoading,
      }}
    >
      <div
        className="relative isolate flex min-h-screen overflow-hidden transition-colors duration-500"
        style={{
          background: t.canvasGradient,
          color: t.text,
        }}
      >
        <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
          <div className="grid-bg absolute inset-0 opacity-20" />
          <div
            className="absolute -left-40 -top-56 h-[32rem] w-[32rem] rounded-full blur-[140px]"
            style={{ background: `${t.accent}10` }}
          />
          <div
            className="absolute -right-52 top-1/3 h-[30rem] w-[30rem] rounded-full blur-[150px]"
            style={{ background: `${t.accent}08` }}
          />
        </div>
        <DashboardSidebar
          isDark={isDark}
          onToggleTheme={() => dispatch(toggleTheme())}
          onNewRepo={() => setNewRepoOpen(true)}
          mobileOpen={mobileSidebarOpen}
          onMobileClose={() => setMobileSidebarOpen(false)}
        />

        <div className="relative z-10 flex min-h-screen min-w-0 flex-1 flex-col">
          <DashboardTopBar
            isDark={isDark}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onNewRepo={() => setNewRepoOpen(true)}
            onToggleTheme={() => dispatch(toggleTheme())}
            onMenuOpen={() => setMobileSidebarOpen(true)}
            repoCount={filteredCount}
          />
          <main className="flex-1 overflow-auto">{children}</main>
        </div>

        <NewRepositoryModal
          isOpen={newRepoOpen}
          onClose={() => setNewRepoOpen(false)}
          isDark={isDark}
          onCreate={handleCreateRepository}
        />
      </div>
    </DashboardCtx.Provider>
  );
}
