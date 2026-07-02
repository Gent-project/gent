"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { X, Upload, File, Plus, Save, AlertCircle } from "lucide-react";
import { useCreateBlob, useCreateTree } from "@/hooks/use-files";
import { useCreateCommit, useCommits } from "@/hooks/use-commits";
import { getDashboardTheme } from "@/app/dashboard/_components/dashboard-theme";

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

  const queryClient = useQueryClient();
  const createBlob = useCreateBlob();
  const createTree = useCreateTree();
  const createCommit = useCreateCommit();
  const { data: commits = [] } = useCommits(ownerId, repoName);
  const parentShas = commits.length > 0 ? [commits[0].sha] : [];
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
      // Create blob first
      const blob = await createBlob.mutateAsync({
        ownerId,
        repoName,
        data: {
          content: fileContent,
          encoding: "utf-8",
        },
      });
      console.log("BLOB RESPONSE:", blob);
      const blobSha = blob?.sha;
      if (!blobSha) {
        throw new Error("Blob SHA not found");
      }

      const tree = await createTree.mutateAsync({
        ownerId,
        repoName,
        data: {
          entries: [
            {
              mode: "100644",
              name: fileName.trim(),
              sha: blobSha,
              type: "blob",
            },
          ],
        },
      });
      const treeSha = tree?.sha;
      if (!treeSha) {
        throw new Error("Tree SHA not found");
      }

      // Then create commit with this tree
      const commitData: any = {
        message: commitMessage.trim(),
        tree_sha: treeSha,
        sha: treeSha,
        author_name: authorName.trim(),
        author_email: userEmail,
        branch: defaultBranch,
      };
      if (parentShas.length > 0) {
        commitData.parent_shas = parentShas;
      }
      const commitResponse = await createCommit.mutateAsync({
        ownerId,
        repoName,
        data: commitData,
      });
      console.log("COMMIT RESPONSE:", commitResponse, commitData);

      // Refresh repository data after commit
      queryClient.invalidateQueries({
        queryKey: ["commits", ownerId, repoName],
      });
      queryClient.invalidateQueries({ queryKey: ["tree", ownerId, repoName] });
      queryClient.invalidateQueries({ queryKey: ["blob", ownerId, repoName] });

      // Reset form
      setFileName("");
      setFileContent("");
      setCommitMessage("");
      setAuthorName("");
      setError("");
      onClose();
    } catch (err: any) {
      console.error("Create file error:", err);
      setError(
        err?.response?.data?.message || err?.message || "Failed to create file",
      );
    }
  };

  const handleUploadFiles = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

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
      const blobs = [];

      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        const content = await file.text();

        const blob = await createBlob.mutateAsync({
          ownerId,
          repoName,
          data: {
            content,
            encoding: "utf-8",
          },
        });
        blobs.push(blob);
      }

      const tree = await createTree.mutateAsync({
        ownerId,
        repoName,
        data: {
          entries: blobs.map((blob, index) => ({
            mode: "100644",
            name: selectedFiles?.[index]?.name ?? `file-${index}`,
            sha: blob.sha,
            type: "blob",
          })),
        },
      });
      const treeSha = tree?.sha;
      if (!treeSha) {
        throw new Error("Tree SHA not found");
      }

      // Create commit with all blobs (simplified)

      if (blobs.length > 0) {
        const commitData: any = {
          message: commitMessage.trim(),
          tree_sha: treeSha,
          sha: treeSha,
          author_name: authorName.trim(),
          author_email: userEmail,
          branch: defaultBranch,
        };
        if (parentShas.length > 0) {
          commitData.parent_shas = parentShas;
        }
        const commitResponse = await createCommit.mutateAsync({
          ownerId,
          repoName,
          data: commitData,
        });
        console.log("COMMIT RESPONSE:", commitResponse, commitData);
      }

      queryClient.invalidateQueries({
        queryKey: ["commits", ownerId, repoName],
      });
      queryClient.invalidateQueries({ queryKey: ["tree", ownerId, repoName] });
      queryClient.invalidateQueries({ queryKey: ["blob", ownerId, repoName] });

      setSelectedFiles(null);
      setCommitMessage("");
      setAuthorName("");
      setError("");
      onClose();
    } catch (err: any) {
      console.error("Upload files error:", err);
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to upload files",
      );
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
              disabled={createBlob.isPending || createCommit.isPending}
              className="flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              style={{
                backgroundColor: t.accent,
                color: t.successText,
              }}
            >
              {createBlob.isPending || createCommit.isPending
                ? mode === "create"
                  ? "Creating..."
                  : "Uploading..."
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
