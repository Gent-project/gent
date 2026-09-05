"use client";

import { useParams } from "next/navigation";
import { useSelector } from "react-redux";
import { getStoredToken } from "@/lib/auth-session";
import RepositoryView from "@/components/repository/RepositoryView";
import { AUTH_PATH, DASHBOARD_PATH } from "@/routes/path";
import { RootState } from "@/store";

export default function RepositoryPage() {
  const params = useParams();
  const token = useSelector((state: RootState) => state.auth.token);
  const ownerId = parseInt(params.owner_id as string);
  const repoName = params.repo_name as string;

  // Guests reach this route for public repositories (see DashboardProvider),
  // so send them home rather than to a dashboard they cannot open, and offer
  // a sign-in link that returns here when the repository is not readable.
  const isSignedIn = Boolean(token || getStoredToken());
  const returnTo = `/dashboard/repository/${ownerId}/${repoName}`;

  return (
    <RepositoryView
      owner={ownerId}
      repoName={repoName}
      backHref={isSignedIn ? DASHBOARD_PATH.ROOT : "/"}
      backLabel={isSignedIn ? "Repositories" : "Home"}
      notFoundHref={
        isSignedIn
          ? undefined
          : `${AUTH_PATH.LOGIN}?next=${encodeURIComponent(returnTo)}`
      }
      notFoundLabel={isSignedIn ? undefined : "Sign in to check access"}
      isPublic={!isSignedIn}
    />
  );
}
