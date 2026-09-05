"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { X, UploadCloud, FileUp } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useCanonicalFiles, bytesToBase64 } from "@/hooks/use-canonical-files";
import { usePushPack } from "@/hooks/use-git-operations";
import { useBranches } from "@/hooks/use-branches";
import { useCommits } from "@/hooks/use-commits";
import { getDashboardTheme } from "@/app/dashboard/_components/dashboard-theme";
import {
  calculateBlobSHA,
  calculateTreeSHA,
  calculateCommitSHA,
  encodeContentToBase64,
  formatGitPerson,
  getUtf8ByteLength,
} from "@/utils/git-hash";

interface UploadFileModalProps {
  isOpen: boolean;
  onClose: () => void;
  ownerId: number;
  repoName: string;
  isDark: boolean;
  defaultBranch: string;
  userEmail: string;
  currentPath: string[];
}

export default function UploadFileModal({
  isOpen,
  onClose,
  ownerId,
  repoName,
  isDark,
  defaultBranch,
  userEmail,
  currentPath,
}: UploadFileModalProps) {
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);
  const [commitMessage, setCommitMessage] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const pushPack = usePushPack();
  const canonicalFiles = useCanonicalFiles(ownerId, repoName);
  const queryClient = useQueryClient();
  const { data: commits = [] } = useCommits(ownerId, repoName);
  const { data: branches = [] } = useBranches(ownerId, repoName);
  const latestCommit = commits.length > 0 ? commits[0] : null;
  const t = getDashboardTheme(isDark);

  useEffect(() => {
    if (!isOpen) {
      setSelectedFiles(null);
      setCommitMessage("");
      setError("");
      setSuccess(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleUploadFiles = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess(false);

    if (!selectedFiles || selectedFiles.length === 0) {
      setError("Please select files to upload");
      return;
    }

    if (!commitMessage.trim()) {
      setError("Commit message is required");
      return;
    }

    try {
      if (!canonicalFiles.ready) throw new Error("Repository is still loading");
      if (canonicalFiles.canonical) {
        const files = await Promise.all(Array.from(selectedFiles).map(async file => ({
          path: [...currentPath, file.name].join("/"),
          data: bytesToBase64(new Uint8Array(await file.arrayBuffer())),
        })));
        await canonicalFiles.mutateAsync({ branch: defaultBranch,
          expected_head: branches.find(branch => branch.name === defaultBranch)?.commit_sha || null,
          message: commitMessage.trim(), files });
        setSuccess(true);
        setTimeout(onClose, 1600);
        return;
      }
      const now = new Date();
      const resolvedAuthorName = userEmail
        ? userEmail.split("@")[0].replace(/[._-]+/g, " ")
        : "User";
      const authorString = formatGitPerson(resolvedAuthorName, userEmail, now);

      const fileData: Array<{
        name: string;
        content: string;
        sha: string;
        size: number;
        base64: string;
      }> = [];

      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        const content = await file.text();
        const blobSHA = await calculateBlobSHA(content);
        const base64Content = encodeContentToBase64(content);
        const contentSize = getUtf8ByteLength(content);
        const relativePath = [...currentPath, file.name].join("/");

        fileData.push({
          name: relativePath,
          content,
          sha: blobSHA,
          size: contentSize,
          base64: base64Content,
        });
      }

      const treeEntries = fileData.map((file) => ({
        mode: "100644",
        name: file.name,
        sha: file.sha,
      }));

      const treeSHA = await calculateTreeSHA(treeEntries);
      const commitSHA = await calculateCommitSHA({
        treeSHA,
        parentSHAs: latestCommit ? [latestCommit.sha] : [],
        author: authorString,
        committer: authorString,
        message: commitMessage.trim(),
      });

      const pack = {
        branch: defaultBranch,
        force: false,
        commits: [
          {
            hash: commitSHA,
            message: commitMessage.trim(),
            author: {
              name: resolvedAuthorName,
              email: userEmail,
            },
            timestamp: now.toISOString(),
            parent: latestCommit ? latestCommit.sha : null,
            mergeParent: null,
            treeHash: treeSHA,
            tree: treeEntries.map((entry) => ({
              mode: entry.mode,
              name: entry.name,
              path: entry.name,
              hash: entry.sha,
              sha: entry.sha,
              type: "blob" as const,
            })),
            files: treeEntries.map((entry) => ({
              path: entry.name,
              hash: entry.sha,
            })),
            stats: {},
          },
        ],
        objects: fileData.map((file) => ({
          hash: file.sha,
          size: file.size,
          type: "blob" as const,
          data: file.base64,
        })),
        branch_updates: [{ name: defaultBranch, commit_sha: commitSHA }],
        tags: {},
      };

      await pushPack.mutateAsync({ ownerId, repoName, pack });
      setSuccess(true);
      queryClient.invalidateQueries({
        queryKey: ["commits", ownerId, repoName],
      });
      queryClient.invalidateQueries({
        queryKey: ["branches", ownerId, repoName],
      });
      queryClient.invalidateQueries({ queryKey: ["tree", ownerId, repoName] });

      setTimeout(() => {
        setSuccess(false);
        onClose();
      }, 1600);
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to upload files");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative w-full max-w-2xl rounded-lg border"
        style={{ backgroundColor: t.elevated, borderColor: t.border }}
      >
        <div
          className="flex items-center justify-between border-b px-4 py-3"
          style={{ borderColor: t.border }}
        >
          <div className="flex items-center gap-2">
            <UploadCloud className="w-4 h-4" style={{ color: t.accent }} />
            <h3 className="text-sm font-semibold" style={{ color: t.text }}>
              Upload files
            </h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <X className="w-4 h-4" style={{ color: t.textMuted }} />
          </button>
        </div>

        <form onSubmit={handleUploadFiles} className="space-y-4 p-4">
          <div
            className="rounded-lg border border-dashed p-6 text-center"
            style={{ borderColor: t.border }}
          >
            <FileUp
              className="mx-auto mb-3 w-10 h-10"
              style={{ color: t.textMuted }}
            />
            <div className="mb-2 text-sm" style={{ color: t.text }}>
              Drag files here or choose files below
            </div>
            <input
              type="file"
              multiple
              onChange={(e) => setSelectedFiles(e.target.files)}
              className="mt-2 text-sm"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm" style={{ color: t.text }}>
              Commit message
            </label>
            <input
              value={commitMessage}
              onChange={(e) => setCommitMessage(e.target.value)}
              className="w-full rounded-lg border px-3 py-2 text-sm"
              style={{
                backgroundColor: t.inputBg,
                borderColor: t.border,
                color: t.text,
              }}
              placeholder="Upload files"
            />
          </div>

          <div
            className="rounded-lg border px-3 py-2 text-sm"
            style={{ borderColor: t.border, backgroundColor: t.surface }}
          >
            <div className="font-medium" style={{ color: t.text }}>
              Author identity
            </div>
            <div className="mt-1" style={{ color: t.textMuted }}>
              Changes will be committed using the repository owner identity.
            </div>
          </div>

          {error ? (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-500">
              {error}
            </div>
          ) : null}
          {success ? (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-500">
              Files uploaded successfully.
            </div>
          ) : null}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border px-3 py-2 text-sm"
              style={{ borderColor: t.border, color: t.text }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg px-3 py-2 text-sm"
              style={{ backgroundColor: t.accent, color: t.successText }}
            >
              Upload
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
