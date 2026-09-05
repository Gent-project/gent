"use client";

import { notFound, useParams } from "next/navigation";

import SiteShell from "@/app/components/site/SiteShell";
import RepositoryView from "@/components/repository/RepositoryView";
import { isReservedSlug } from "@/routes/reserved";
import { PUBLIC_PATH } from "@/routes/path";

export default function PublicRepositoryPage() {
  const params = useParams();
  const username = params.username as string;
  const repoName = params.repo_name as string;

  if (isReservedSlug(username)) notFound();

  return (
    <SiteShell footer={false}>
      <div className="pt-24">
        <RepositoryView
          owner={username}
          repoName={repoName}
          backHref={PUBLIC_PATH.EXPLORE}
          backLabel="Explore"
          isPublic
        />
      </div>
    </SiteShell>
  );
}
