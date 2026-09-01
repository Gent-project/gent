"use client";

import Link from "next/link";
import { ArrowLeft, FolderSearch, Search } from "lucide-react";
import { useSelector } from "react-redux";

import { getDashboardTheme } from "@/app/dashboard/_components/dashboard-theme";
import { DASHBOARD_PATH } from "@/routes/path";
import { RootState } from "@/store";

export default function MissingRepositoryRoute() {
  const isDark = useSelector((state: RootState) => state.theme.isDark);
  const t = getDashboardTheme(isDark);

  return (
    <main
      className="min-h-screen px-4 py-10 sm:px-6"
      style={{
        background: t.canvasGradient,
        color: t.text,
      }}
    >
      <div className="mx-auto flex min-h-[70vh] max-w-3xl items-center justify-center">
        <section
          className="w-full rounded-lg border p-6 text-center shadow-xl sm:p-8"
          style={{
            backgroundColor: t.elevated,
            borderColor: t.border,
            boxShadow: t.shadow,
          }}
        >
          <div
            className="mx-auto flex h-14 w-14 items-center justify-center rounded-lg"
            style={{ backgroundColor: t.accentMuted, color: t.accent }}
          >
            <FolderSearch className="h-7 w-7" />
          </div>

          <h1 className="mt-5 text-2xl font-bold">
            Repository route is incomplete
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6" style={{ color: t.textMuted }}>
            Repository pages need both an owner id and a repository name. Open a
            repository from the dashboard, or use a full URL like
            /dashboard/repository/1/my-repo.
          </p>

          <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              href={DASHBOARD_PATH.ROOT}
              className="inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all"
              style={{
                background: t.accentGradient,
                color: t.successText,
              }}
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </Link>
            <Link
              href={DASHBOARD_PATH.ROOT}
              className="inline-flex items-center justify-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold transition-all"
              style={{
                borderColor: t.border,
                color: t.textSecondary,
              }}
            >
              <Search className="h-4 w-4" />
              Browse repositories
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
