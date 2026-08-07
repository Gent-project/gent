"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { X, FileText, Plus } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import axios from "@/lib/axios";
import { usePushPack } from "@/hooks/use-git-operations";
import { useCommits } from "@/hooks/use-commits";
import { useTree } from "@/hooks/use-files";
import { getDashboardTheme } from "@/app/dashboard/_components/dashboard-theme";
import {
  calculateBlobSHA,
  calculateTreeSHA,
  calculateCommitSHA,
  encodeContentToBase64,
  formatGitPerson,
  getUtf8ByteLength,
} from "@/utils/git-hash";

interface CreateFileModalProps {
  isOpen: boolean;
  onClose: () => void;
  ownerId: number;
  repoName: string;
  isDark: boolean;
  defaultBranch: string;
  userEmail: string;
  currentPath: string[];
  currentTreeSha: string | null;
}

export default function CreateFileModal({
  isOpen,
  onClose,
  ownerId,
  repoName,
  isDark,
  defaultBranch,
  userEmail,
  currentPath,
  currentTreeSha,
}: CreateFileModalProps) {
  const [fileName, setFileName] = useState("");
  const [fileContent, setFileContent] = useState("");
  const [commitMessage, setCommitMessage] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const pushPack = usePushPack();
  const queryClient = useQueryClient();
  const { data: commits = [] } = useCommits(ownerId, repoName);
  const { data: currentTree } = useTree(ownerId, repoName, currentTreeSha || "", {
    enabled: !!currentTreeSha,
  });
  const latestCommit = useMemo(() => {
    return [...commits].sort((a, b) => {
      const aTime = new Date(a.committed_at || a.created_at || 0).getTime();
      const bTime = new Date(b.committed_at || b.created_at || 0).getTime();
      return bTime - aTime;
    })[0] ?? null;
  }, [commits]);
  const t = getDashboardTheme(isDark);

  const resetForm = () => {
    setFileName("");
    setFileContent("");
    setCommitMessage("");
    setError("");
    setSuccess(false);
  };

  if (!isOpen) return null;

  const handleCreateFile = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess(false);

    if (!fileName.trim()) {
      setError("File name is required");
      return;
    }

    if (!fileContent.trim()) {
      setError("File content cannot be empty");
      return;
    }

    if (!commitMessage.trim()) {
      setError("Commit message is required");
      return;
    }

    try {
      const now = new Date();
      const safeUserEmail = userEmail?.trim() || "user@example.com";
      const resolvedAuthorName =
        safeUserEmail
          .split("@")[0]
          .replace(/[._-]+/g, " ")
          .trim() || "User";
      const authorString = formatGitPerson(
        resolvedAuthorName,
        safeUserEmail,
        now,
      );
      const normalizedFileName = fileName.trim();
      const normalizedContent = fileContent.replace(/\r\n/g, "\n");
      const blobSHA = await calculateBlobSHA(normalizedContent);
      const freshTreeResponse = currentTreeSha
        ? await axios.get(`/repos/${ownerId}/${repoName}/tree/${currentTreeSha}/`)
        : null;
      const freshTreeEntries = freshTreeResponse?.data?.entries ?? currentTree?.entries ?? [];
      const existingEntries = freshTreeEntries.filter(
        (entry: { name: string }) => entry.name !== normalizedFileName,
      );
      const treeEntries = [
        ...existingEntries,
        {
          mode: "100644",
          name: normalizedFileName,
          sha: blobSHA,
        },
      ];
      console.log("[CreateFileModal] Latest commit:", latestCommit);
      console.log("[CreateFileModal] Current tree SHA:", currentTreeSha);
      console.log("[CreateFileModal] Tree response:", freshTreeResponse?.data);
      console.log("[CreateFileModal] Tree entries:", freshTreeEntries);
      console.log("[CreateFileModal] Rendered files:", treeEntries);
      console.log({
        fileName: normalizedFileName,
      });
      const treeSHA = await calculateTreeSHA(treeEntries);
      const commitSHA = await calculateCommitSHA({
        treeSHA,
        parentSHAs: latestCommit ? [latestCommit.sha] : [],
        author: authorString,
        committer: authorString,
        message: commitMessage.trim(),
      });
      const base64Content = encodeContentToBase64(normalizedContent);
      const contentSize = getUtf8ByteLength(normalizedContent);
      console.log("fileContent:", JSON.stringify(normalizedContent));
      console.log("blobHash:", blobSHA);
      console.log("base64:", base64Content);
      console.log("treeSHA:", treeSHA);
      console.log("commitSHA:", commitSHA);
      console.log("treeEntries:", treeEntries);
      const pack = {
        branch: defaultBranch,
        force: false,
        commits: [
          {
            hash: commitSHA,
            message: commitMessage.trim(),
            author: {
              name: resolvedAuthorName,
              email: safeUserEmail,
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

        objects: [
          {
            hash: blobSHA,
            size: contentSize,
            type: "blob" as const,
            data: encodeContentToBase64(normalizedContent),
          },
        ],
        branch_updates: [{ name: defaultBranch, commit_sha: commitSHA }],
        tags: {},
      };

      await pushPack.mutateAsync({ ownerId, repoName, pack });
      setSuccess(true);
      resetForm();
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["commits", ownerId, repoName],
        }),
        queryClient.invalidateQueries({
          queryKey: ["branches", ownerId, repoName],
        }),
        queryClient.invalidateQueries({
          queryKey: ["tree", ownerId, repoName],
        }),
      ]);

      setTimeout(() => {
        setSuccess(false);
        onClose();
      }, 1600);
    } catch (err: unknown) {
      const errorMessage =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: { message?: string } } }).response
              ?.data?.message || "Failed to create file"
          : "Failed to create file";

      setError(errorMessage);
    }
  };

  return (
    <div className="fixed inset-0 z-50  flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="
relative
w-full
max-w-2xl
max-h-[90vh]
overflow-hidden
rounded-lg
border
"
        style={{ backgroundColor: t.elevated, borderColor: t.border }}
      >
        <div
          className="flex items-center justify-between border-b px-4 py-3"
          style={{ borderColor: t.border }}
        >
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4" style={{ color: t.accent }} />
            <h3 className="text-sm font-semibold" style={{ color: t.text }}>
              Create new file
            </h3>
          </div>
          <button
            onClick={() => {
              resetForm();
              onClose();
            }}
            className="rounded-lg p-2 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <X className="w-4 h-4" style={{ color: t.textMuted }} />
          </button>
        </div>

        <form
          onSubmit={handleCreateFile}
          className="max-h-[75vh] overflow-y-auto space-y-4 p-4"
        >
          <div
            className="rounded-lg border p-3"
            style={{ borderColor: t.border, backgroundColor: t.surface }}
          >
            <div
              className="mb-2 text-xs font-medium uppercase"
              style={{ color: t.textMuted }}
            >
              File path
            </div>
            <div className="text-sm" style={{ color: t.text }}>
              {currentPath.length > 0 ? `${currentPath.join("/")}/` : ""}
              <span className="font-semibold">{fileName || "filename"}</span>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm" style={{ color: t.text }}>
              File name
            </label>
            <input
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
              className="w-full rounded-lg border px-3 py-2 text-sm"
              style={{
                backgroundColor: t.inputBg,
                borderColor: t.border,
                color: t.text,
              }}
              placeholder="README.md"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm" style={{ color: t.text }}>
              Content
            </label>
            <textarea
              value={fileContent}
              onChange={(e) => setFileContent(e.target.value)}
              rows={12}
              className="w-full rounded-lg border px-3 py-2 text-sm font-mono"
              style={{
                backgroundColor: t.inputBg,
                borderColor: t.border,
                color: t.text,
              }}
              placeholder="Write your file content here..."
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
              placeholder="Create config file"
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
              File created successfully.
            </div>
          ) : null}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                resetForm();
                onClose();
              }}
              className="rounded-lg border px-3 py-2 text-sm"
              style={{ borderColor: t.border, color: t.text }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm"
              style={{ backgroundColor: t.accent, color: t.successText }}
            >
              <Plus className="w-4 h-4" />
              Commit changes
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
