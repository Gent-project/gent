"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { X, Upload, AlertCircle, CheckCircle } from "lucide-react";
import { usePushPack } from "@/hooks/use-git-operations";
import { getDashboardTheme } from "@/app/dashboard/_components/dashboard-theme";
import { useQueryClient } from "@tanstack/react-query";
import {
  calculateBlobSHA,
  calculateCommitSHA,
  calculateTreeSHA,
  encodeContentToBase64,
  formatGitPerson,
  getUtf8ByteLength,
} from "@/utils/git-hash";

interface InitialCommitModalProps {
  isOpen: boolean;
  onClose: () => void;
  ownerId: number;
  repoName: string;
  isDark: boolean;
  defaultBranch: string;
  userEmail: string;
}

export default function InitialCommitModal({
  isOpen,
  onClose,
  ownerId,
  repoName,
  isDark,
  defaultBranch,
  userEmail,
}: InitialCommitModalProps) {
  const [fileName, setFileName] = useState("README.md");
  const [fileContent, setFileContent] = useState(
    `# ${repoName}\n\nThis is the initial commit for ${repoName}.`,
  );
  const [commitMessage, setCommitMessage] = useState("Initial commit");
  const [authorName, setAuthorName] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const pushPack = usePushPack();
  const queryClient = useQueryClient();
  const t = getDashboardTheme(isDark);

  if (!isOpen) return null;

  const handleCreateInitialCommit = async (e: React.FormEvent) => {
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

    if (!authorName.trim()) {
      setError("Author name is required");
      return;
    }

    try {
      const timestamp = new Date().toISOString();
      const authorString = formatGitPerson(
        authorName.trim(),
        userEmail,
        new Date(timestamp),
      );

      // Generate real Git SHA-1 hashes
      const blobHash = await calculateBlobSHA(fileContent);
      const treeHash = await calculateTreeSHA([
        {
          mode: "100644",
          name: fileName.trim(),
          sha: blobHash,
        },
      ]);
      const commitHash = await calculateCommitSHA({
        treeSHA: treeHash,
        parentSHAs: [],
        author: authorString,
        committer: authorString,
        message: commitMessage.trim(),
      });

      // Encode content as base64
      const base64Content = encodeContentToBase64(fileContent);
      const contentSize = getUtf8ByteLength(fileContent);

      // Build simplified git pack - only include blob in objects
      // Backend likely generates tree and commit internally
      const pack = {
        branch: defaultBranch,
        force: true,
        commits: [
          {
            hash: commitHash,
            message: commitMessage.trim(),
            author: {
              name: authorName.trim(),
              email: userEmail,
            },
            timestamp: timestamp,
            parent: null, // null for initial commit
            mergeParent: null,
            treeHash: treeHash,
            tree: [
              {
                mode: "100644",
                name: fileName.trim(),
                path: fileName.trim(),
                hash: blobHash,
                sha: blobHash,
                type: "blob" as const,
              },
            ],
            files: [
              {
                path: fileName.trim(),
                hash: blobHash,
              },
            ],
            stats: {},
          },
        ],
        objects: [
          {
            hash: blobHash,
            size: contentSize,
            type: "blob" as const,
            data: base64Content,
          },
        ],
        branch_updates: [
          {
            name: defaultBranch,
            commit_sha: commitHash,
          },
        ],
        tags: {},
      };

      console.log(
        "Pushing initial commit pack:",
        JSON.stringify(pack, null, 2),
      );

      await pushPack.mutateAsync({
        ownerId,
        repoName,
        pack,
      });

      setSuccess(true);

      // Invalidate all queries to refresh data
      queryClient.invalidateQueries({
        queryKey: ["commits", ownerId, repoName],
      });
      queryClient.invalidateQueries({
        queryKey: ["branches", ownerId, repoName],
      });
      queryClient.invalidateQueries({ queryKey: ["tree", ownerId, repoName] });
      queryClient.invalidateQueries({
        queryKey: ["repository", ownerId, repoName],
      });

      setTimeout(() => {
        setFileName("README.md");
        setFileContent(
          `# ${repoName}\n\nThis is the initial commit for ${repoName}.`,
        );
        setCommitMessage("Initial commit");
        setAuthorName("");
        setError("");
        setSuccess(false);
        onClose();
      }, 2000);
    } catch (err: any) {
      const errorData = err.response?.data;
      let errorMsg = "Failed to create initial commit";

      if (errorData) {
        console.error(
          "Full error response:",
          JSON.stringify(errorData, null, 2),
        );

        // Extract more detailed error message
        if (typeof errorData === "string") {
          errorMsg = errorData;
        } else if (errorData.error) {
          errorMsg = errorData.error;
        } else if (errorData.message) {
          errorMsg = errorData.message;
        } else if (errorData.commits || errorData.objects) {
          errorMsg = `Validation error: ${JSON.stringify(errorData)}`;
        }
      }

      setError(errorMsg);
      console.error("Initial commit error:", errorData);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative w-full max-w-2xl rounded-lg border"
        style={{
          backgroundColor: t.elevated,
          borderColor: t.border,
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between p-6 border-b"
          style={{ borderColor: t.border }}
        >
          <div className="flex items-center gap-2">
            <Upload className="w-5 h-5" style={{ color: t.accent }} />
            <h3 className="text-lg font-semibold" style={{ color: t.text }}>
              Create Initial Commit
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
            style={{ color: t.textMuted }}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleCreateInitialCommit} className="p-6 space-y-4">
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 text-sm">
            <p style={{ color: t.text }} className="mb-2">
              <strong>Note:</strong> This feature uses the Gent Push API to
              create the initial commit.
            </p>
            <p style={{ color: t.textMuted }} className="text-xs">
              If you encounter errors, you can use the Gent CLI commands
              instead:
              <br />
              <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">
                gent clone → gent add → gent commit → gent push
              </code>
            </p>
          </div>

          {/* File name */}
          <div>
            <label
              className="block text-sm font-medium mb-2"
              style={{ color: t.text }}
            >
              File name
            </label>
            <input
              type="text"
              value={fileName}
              onChange={(e) => {
                setFileName(e.target.value);
                setError("");
              }}
              placeholder="README.md"
              className="w-full px-3 py-2 text-sm rounded-lg border focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              style={{
                backgroundColor: t.inputBg,
                borderColor: error ? "#ef4444" : t.border,
                color: t.text,
              }}
            />
          </div>

          {/* File content */}
          <div>
            <label
              className="block text-sm font-medium mb-2"
              style={{ color: t.text }}
            >
              File content
            </label>
            <textarea
              value={fileContent}
              onChange={(e) => {
                setFileContent(e.target.value);
                setError("");
              }}
              placeholder="Enter file content..."
              rows={8}
              className="w-full px-3 py-2 text-sm rounded-lg border font-mono focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              style={{
                backgroundColor: t.inputBg,
                borderColor: error ? "#ef4444" : t.border,
                color: t.text,
              }}
            />
          </div>

          {/* Author info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label
                className="block text-sm font-medium mb-2"
                style={{ color: t.text }}
              >
                Author name
              </label>
              <input
                type="text"
                value={authorName}
                onChange={(e) => {
                  setAuthorName(e.target.value);
                  setError("");
                }}
                placeholder="Your name"
                className="w-full px-3 py-2 text-sm rounded-lg border focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                style={{
                  backgroundColor: t.inputBg,
                  borderColor: t.border,
                  color: t.text,
                }}
              />
            </div>

            <div>
              <label
                className="block text-sm font-medium mb-2"
                style={{ color: t.text }}
              >
                Branch
              </label>
              <input
                type="text"
                value={defaultBranch}
                disabled
                className="w-full px-3 py-2 text-sm rounded-lg border opacity-60"
                style={{
                  backgroundColor: t.inputBg,
                  borderColor: t.border,
                  color: t.textMuted,
                }}
              />
            </div>
          </div>

          {/* Commit message */}
          <div>
            <label
              className="block text-sm font-medium mb-2"
              style={{ color: t.text }}
            >
              Commit message
            </label>
            <input
              type="text"
              value={commitMessage}
              onChange={(e) => {
                setCommitMessage(e.target.value);
                setError("");
              }}
              placeholder="Initial commit"
              className="w-full px-3 py-2 text-sm rounded-lg border focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              style={{
                backgroundColor: t.inputBg,
                borderColor: t.border,
                color: t.text,
              }}
            />
          </div>

          {/* Success message */}
          {success && (
            <div
              className="flex items-center gap-2 p-3 text-sm rounded-lg"
              style={{
                backgroundColor: isDark ? "#dcfce7" : "#dcfce7",
                color: "#166534",
              }}
            >
              <CheckCircle className="w-4 h-4 flex-shrink-0" />
              Initial commit created successfully! Refreshing repository...
            </div>
          )}

          {/* Error message */}
          {error && (
            <div
              className="flex items-center gap-2 p-3 text-sm rounded-lg"
              style={{
                backgroundColor: isDark ? "#fef2f2" : "#fef2f2",
                color: "#dc2626",
              }}
            >
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={pushPack.isPending}
              className="flex-1 px-4 py-2 text-sm rounded-lg border transition-colors"
              style={{
                borderColor: t.border,
                color: t.text,
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pushPack.isPending || success}
              className="flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                backgroundColor: t.accent,
                color: t.successText,
              }}
            >
              {pushPack.isPending
                ? "Creating..."
                : success
                  ? "Success!"
                  : "Create Initial Commit"}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
