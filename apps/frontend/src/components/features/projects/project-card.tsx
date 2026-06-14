"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { GitBranch, Lock, Globe, ArrowUpRight, Clock } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { PATHS } from "@/lib/paths";
import { timeAgo } from "@/lib/utils";
import type { Repository } from "@/types/api";

/**
 * ProjectCard — one repository tile on the dashboard.
 *
 * Whole card is a Link so the entire surface is clickable. Hover lifts it with
 * a soft shadow and reveals an arrow icon — small affordance but feels great.
 */
export function ProjectCard({ repo, index = 0 }: { repo: Repository; index?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.4, ease: "easeOut" }}
    >
      <Link href={PATHS.app.project(repo.owner_id, repo.name)}>
        <Card interactive className="group p-5">
          <div className="flex items-start gap-3">
            <Avatar seed={`${repo.owner_id}/${repo.name}`} name={repo.name} size={40} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h3 className="truncate font-semibold text-foreground">{repo.name}</h3>
                <Badge tone={repo.is_private ? "warning" : "success"} size="sm">
                  {repo.is_private ? (
                    <>
                      <Lock className="size-3" /> Private
                    </>
                  ) : (
                    <>
                      <Globe className="size-3" /> Public
                    </>
                  )}
                </Badge>
              </div>
              <p className="text-xs text-on-surface-variant truncate">
                {repo.owner_email}
              </p>
            </div>
            <ArrowUpRight className="size-4 text-on-surface-variant opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition" />
          </div>

          <p className="mt-3 text-sm text-on-surface-variant line-clamp-2 min-h-[40px]">
            {repo.description || "No description yet."}
          </p>

          <div className="mt-4 flex items-center justify-between text-xs text-on-surface-variant">
            <span className="inline-flex items-center gap-1">
              <GitBranch className="size-3.5" /> {repo.default_branch}
            </span>
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3.5" /> {timeAgo(repo.updated_at)}
            </span>
          </div>
        </Card>
      </Link>
    </motion.div>
  );
}
