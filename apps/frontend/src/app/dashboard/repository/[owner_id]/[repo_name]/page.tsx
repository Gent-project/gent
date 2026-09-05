"use client";

import { useParams } from "next/navigation";
import RepositoryView from "@/components/repository/RepositoryView";
import { DASHBOARD_PATH } from "@/routes/path";

export default function RepositoryPage() {
  const params = useParams();
  const ownerId = parseInt(params.owner_id as string);
  const repoName = params.repo_name as string;

  return (
    <RepositoryView
      owner={ownerId}
      repoName={repoName}
      backHref={DASHBOARD_PATH.ROOT}
      backLabel="Repositories"
    />
  );
}
