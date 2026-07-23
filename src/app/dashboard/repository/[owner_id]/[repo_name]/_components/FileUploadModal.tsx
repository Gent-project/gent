"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { X, Upload, AlertCircle, CheckCircle, Plus } from "lucide-react";
import { usePushPack } from "@/hooks/use-git-operations";
import { useCommits } from "@/hooks/use-commits";
import { getDashboardTheme } from "@/app/dashboard/_components/dashboard-theme";
import { useQueryClient } from "@tanstack/react-query";
import {
  calculateBlobSHA,
  calculateTreeSHA,
  calculateCommitSHA,
  formatGitPerson,
} from "@/utils/git-hash";

interface FileUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  ownerId: number;
  repoName: string;
  isDark: boolean;
  defaultBranch: string;
  userEmail: string;
  mode: "upload" | "create";
}

export default function FileUploadModal({
  isOpen,
  onClose,
  ownerId,
  repoName,
  isDark,
  defaultBranch,
  userEmail,
  mode,
}: FileUploadModalProps) {
  const [fileName, setFileName] = useState("");
  const [fileContent, setFileContent] = useState("");
  const [commitMessage, setCommitMessage] = useState("");
  const [authorName, setAuthorName] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const pushPack = usePushPack();
  const queryClient = useQueryClient();

  // Get latest commit for parent
  const { data: commits = [] } = useCommits(ownerId, repoName);
  const latestCommit = commits.length > 0 ? commits[0] : null;

  const t = getDashboardTheme(isDark);

  console.log("FileUploadModal render: isOpen=", isOpen, "mode=", mode);

  if (!isOpen) return null;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedFiles(e.target.files);
    setError("");
  };

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

    if (!authorName.trim()) {
      setError("Author name is required");
      return;
    }

    try {
      const now = new Date();
      const authorString = formatGitPerson(authorName.trim(), userEmail, now);

      // Step 1: Calculate blob SHA
      const blobSHA = await calculateBlobSHA(fileContent);
      console.log("Blob SHA:", blobSHA);

      // Step 2: Build tree entries (include existing files if any + new file)
      const treeEntries = [
        {
          mode: "100644", // Regular file
          name: fileName.trim(),
          sha: blobSHA,
        },
      ];

      // Step 3: Calculate tree SHA
      const treeSHA = await calculateTreeSHA(treeEntries);
      console.log("Tree SHA:", treeSHA);

      // Step 4: Calculate commit SHA
      const commitSHA = await calculateCommitSHA({
        treeSHA: treeSHA,
        parentSHAs: latestCommit ? [latestCommit.sha] : [],
        author: authorString,
        committer: authorString,
        message: commitMessage.trim(),
      });
      console.log("Commit SHA:", commitSHA);

      // Step 5: Encode content as base64
      const base64Content = btoa(unescape(encodeURIComponent(fileContent)));

      // Step 6: Build Git pack
      const pack = {
        branch: defaultBranch,
        force: false,
        commits: [
          {
            hash: commitSHA,
            message: commitMessage.trim(),
            author: {
              name: authorName.trim(),
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
        objects: [
          {
            hash: blobSHA,
            type: "blob" as const,
            data: base64Content,
          },
        ],
        branch_updates: [
          {
            name: defaultBranch,
            commit_sha: commitSHA,
          },
        ],
        tags: {},
      };

      console.log("Pushing pack:", JSON.stringify(pack, null, 2));

      await pushPack.mutateAsync({
        ownerId,
        repoName,
        pack,
      });

      setSuccess(true);

      // Invalidate queries
      queryClient.invalidateQueries({
        queryKey: ["commits", ownerId, repoName],
      });
      queryClient.invalidateQueries({
        queryKey: ["branches", ownerId, repoName],
      });
      queryClient.invalidateQueries({ queryKey: ["tree", ownerId, repoName] });

      setTimeout(() => {
        setFileName("");
        setFileContent("");
        setCommitMessage("");
        setAuthorName("");
        setError("");
        setSuccess(false);
        onClose();
      }, 2000);
    } catch (err: any) {
      const errorData = err.response?.data;
      let errorMsg = "Failed to create file";

      if (errorData) {
        console.error(
          "Full error response:",
          JSON.stringify(errorData, null, 2),
        );

        if (typeof errorData === "string") {
          errorMsg = errorData;
        } else if (errorData.error) {
          errorMsg = errorData.error;
        } else if (errorData.message) {
          errorMsg = errorData.message;
        }
      }

      setError(errorMsg);
      console.error("Create file error:", errorData);
    }
  };

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

    if (!authorName.trim()) {
      setError("Author name is required");
      return;
    }

    try {
      const now = new Date();
      const authorString = formatGitPerson(authorName.trim(), userEmail, now);

      // Step 1: Process all files and calculate blob SHAs
      const fileData: Array<{
        name: string;
        content: string;
        sha: string;
        base64: string;
      }> = [];

      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        const content = await file.text();
        const blobSHA = await calculateBlobSHA(content);
        const base64Content = btoa(unescape(encodeURIComponent(content)));

        fileData.push({
          name: file.name,
          content,
          sha: blobSHA,
          base64: base64Content,
        });
      }

      console.log(
        "Processed files:",
        fileData.map((f) => ({ name: f.name, sha: f.sha })),
      );

      // Step 2: Build tree entries
      const treeEntries = fileData.map((file) => ({
        mode: "100644",
        name: file.name,
        sha: file.sha,
      }));

      // Step 3: Calculate tree SHA
      const treeSHA = await calculateTreeSHA(treeEntries);
      console.log("Tree SHA:", treeSHA);

      // Step 4: Calculate commit SHA
      const commitSHA = await calculateCommitSHA({
        treeSHA: treeSHA,
        parentSHAs: latestCommit ? [latestCommit.sha] : [],
        author: authorString,
        committer: authorString,
        message: commitMessage.trim(),
      });
      console.log("Commit SHA:", commitSHA);

      // Step 5: Build Git pack
      const pack = {
        branch: defaultBranch,
        force: false,
        commits: [
          {
            hash: commitSHA,
            message: commitMessage.trim(),
            author: {
              name: authorName.trim(),
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
          type: "blob" as const,
          data: file.base64,
        })),
        branch_updates: [
          {
            name: defaultBranch,
            commit_sha: commitSHA,
          },
        ],
        tags: {},
      };

      console.log("Pushing pack with", fileData.length, "files");

      await pushPack.mutateAsync({
        ownerId,
        repoName,
        pack,
      });

      setSuccess(true);

      // Invalidate queries
      queryClient.invalidateQueries({
        queryKey: ["commits", ownerId, repoName],
      });
      queryClient.invalidateQueries({
        queryKey: ["branches", ownerId, repoName],
      });
      queryClient.invalidateQueries({ queryKey: ["tree", ownerId, repoName] });

      setTimeout(() => {
        setSelectedFiles(null);
        setCommitMessage("");
        setAuthorName("");
        setError("");
        setSuccess(false);
        onClose();
      }, 2000);
    } catch (err: any) {
      const errorData = err.response?.data;
      let errorMsg = "Failed to upload files";

      if (errorData) {
        console.error(
          "Full error response:",
          JSON.stringify(errorData, null, 2),
        );

        if (typeof errorData === "string") {
          errorMsg = errorData;
        } else if (errorData.error) {
          errorMsg = errorData.error;
        } else if (errorData.message) {
          errorMsg = errorData.message;
        }
      }

      setError(errorMsg);
      console.error("Upload files error:", errorData);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-lg border"
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
            {mode === "create" ? (
              <Plus className="w-5 h-5" style={{ color: t.accent }} />
            ) : (
              <Upload className="w-5 h-5" style={{ color: t.accent }} />
            )}
            <h3 className="text-lg font-semibold" style={{ color: t.text }}>
              {mode === "create" ? "Create new file" : "Upload files"}
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
        <form
          onSubmit={mode === "create" ? handleCreateFile : handleUploadFiles}
          className="p-6 space-y-4  max-h-[70vh] overflow-y-auto"
        >
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 text-sm">
            <p style={{ color: t.text }} className="font-semibold mb-1">
              📝 Web-based file upload
            </p>
            <p style={{ color: t.textMuted }} className="text-xs">
              This feature uses the Git Push API with proper SHA-1 hashing. Make
              sure you have at least one commit in the repository before
              uploading files.
            </p>
          </div>
          {mode === "create" ? (
            <>
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
                  autoFocus
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
                  rows={6}
                  className="w-full px-3 py-2 text-sm rounded-lg border font-mono focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  style={{
                    backgroundColor: t.inputBg,
                    borderColor: error ? "#ef4444" : t.border,
                    color: t.text,
                  }}
                />
              </div>
            </>
          ) : (
            <>
              {/* File upload */}
              <div>
                <label
                  className="block text-sm font-medium mb-2"
                  style={{ color: t.text }}
                >
                  Select files
                </label>
                <input
                  type="file"
                  multiple
                  onChange={handleFileSelect}
                  className="w-full px-3 py-2 text-sm rounded-lg border"
                  style={{
                    backgroundColor: t.inputBg,
                    borderColor: error ? "#ef4444" : t.border,
                    color: t.text,
                  }}
                />
                {selectedFiles && selectedFiles.length > 0 && (
                  <div className="mt-2 text-xs" style={{ color: t.textMuted }}>
                    {selectedFiles.length} file(s) selected
                  </div>
                )}
              </div>
            </>
          )}

          {/* Commit info */}
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

          <div>
            <label
              className="block text-sm font-medium mb-2"
              style={{ color: t.text }}
            >
              Commit message
            </label>
            <textarea
              value={commitMessage}
              onChange={(e) => {
                setCommitMessage(e.target.value);
                setError("");
              }}
              placeholder={mode === "create" ? "Add new file" : "Upload files"}
              rows={3}
              className="w-full px-3 py-2 text-sm rounded-lg border focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
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
              {mode === "create"
                ? "File created successfully!"
                : "Files uploaded successfully!"}
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
              className="flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              style={{
                backgroundColor: t.accent,
                color: t.successText,
              }}
            >
              {pushPack.isPending
                ? mode === "create"
                  ? "Creating..."
                  : "Uploading..."
                : success
                  ? "Success!"
                  : mode === "create"
                    ? "Create file"
                    : "Upload files"}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
