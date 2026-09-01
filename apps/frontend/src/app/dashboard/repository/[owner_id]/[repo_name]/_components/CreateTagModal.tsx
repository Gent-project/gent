"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { X, Tag, AlertCircle } from "lucide-react";
import { useCreateTag } from "@/hooks/use-tags";
import { getDashboardTheme } from "@/app/dashboard/_components/dashboard-theme";

interface CreateTagModalProps {
  isOpen: boolean;
  onClose: () => void;
  ownerId: number;
  repoName: string;
  isDark: boolean;
  branches: Array<{ name: string; commit_sha: string }>;
  userEmail: string;
}

export default function CreateTagModal({
  isOpen,
  onClose,
  ownerId,
  repoName,
  isDark,
  branches,
  userEmail,
}: CreateTagModalProps) {
  const [tagName, setTagName] = useState("");
  const [message, setMessage] = useState("");
  const [sourceBranch, setSourceBranch] = useState(branches[0]?.name || "main");
  const [isAnnotated, setIsAnnotated] = useState(true);
  const [taggerName, setTaggerName] = useState("");
  const [error, setError] = useState("");

  const createTag = useCreateTag();
  const t = getDashboardTheme(isDark);

  if (!isOpen) return null;

  // Check if repository is empty (no branches/commits)
  const isRepoEmpty = !branches || branches.length === 0;

  const validateTagName = (name: string) => {
    if (!name.trim()) return "Tag name is required";
    if (name.includes(" ")) return "Tag name cannot contain spaces";
    if (name.includes("..")) return 'Tag name cannot contain ".."';
    if (name.length > 100) return "Tag name is too long";
    return "";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (isRepoEmpty) {
      setError(
        "Cannot create tags in an empty repository. Create your first commit first.",
      );
      return;
    }

    const validationError = validateTagName(tagName);
    if (validationError) {
      setError(validationError);
      return;
    }

    const sourceBranchData = branches.find((b) => b.name === sourceBranch);
    if (!sourceBranchData) {
      setError("Source branch not found");
      return;
    }

    // Check if branch has a valid commit SHA
    if (
      !sourceBranchData.commit_sha ||
      sourceBranchData.commit_sha ===
        "0000000000000000000000000000000000000000000000000000000000000000" ||
      sourceBranchData.commit_sha.length === 0
    ) {
      setError("Selected branch has no commits yet. Push some commits first.");
      return;
    }

    if (isAnnotated && !message.trim()) {
      setError("Message is required for annotated tags");
      return;
    }

    if (isAnnotated && !taggerName.trim()) {
      setError("Tagger name is required for annotated tags");
      return;
    }

    try {
      await createTag.mutateAsync({
        ownerId,
        repoName,
        data: {
          name: tagName.trim(),
          commit_sha: sourceBranchData.commit_sha,
          message: message.trim() || tagName.trim(),
          annotated: isAnnotated,
          tagger_name: taggerName.trim() || "Unknown",
          tagger_email: userEmail,
        },
      });

      setTagName("");
      setMessage("");
      setTaggerName("");
      setError("");
      onClose();
    } catch (err: any) {
      const errorMsg =
        err.response?.data?.error ||
        err.response?.data?.message ||
        "Failed to create tag";
      setError(errorMsg);
      console.error("Create tag error:", err.response?.data);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative w-full max-w-md rounded-lg border p-6"
        style={{
          backgroundColor: t.elevated,
          borderColor: t.border,
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Tag className="w-5 h-5" style={{ color: t.accent }} />
            <h3 className="text-lg font-semibold" style={{ color: t.text }}>
              Create a new tag
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

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Tag name */}
          <div>
            <label
              className="block text-sm font-medium mb-2"
              style={{ color: t.text }}
            >
              Tag name
            </label>
            <input
              type="text"
              value={tagName}
              onChange={(e) => {
                setTagName(e.target.value);
                setError("");
              }}
              placeholder="v1.0.0"
              className="w-full px-3 py-2 text-sm rounded-lg border focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              style={{
                backgroundColor: t.inputBg,
                borderColor: error ? "#ef4444" : t.border,
                color: t.text,
              }}
              autoFocus
            />
          </div>

          {/* Source branch */}
          <div>
            <label
              className="block text-sm font-medium mb-2"
              style={{ color: t.text }}
            >
              Target branch
            </label>
            {isRepoEmpty ? (
              <div
                className="w-full px-3 py-2 text-sm rounded-lg border"
                style={{
                  backgroundColor: t.inputBg,
                  borderColor: t.border,
                  color: t.textMuted,
                }}
              >
                No branches available
              </div>
            ) : (
              <select
                value={sourceBranch}
                onChange={(e) => setSourceBranch(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                style={{
                  backgroundColor: t.inputBg,
                  borderColor: t.border,
                  color: t.text,
                }}
              >
                {branches.map((branch) => (
                  <option key={branch.name} value={branch.name}>
                    {branch.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Tag type */}
          <div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={isAnnotated}
                onChange={(e) => setIsAnnotated(e.target.checked)}
                className="rounded border-gray-300"
              />
              <span className="text-sm font-medium" style={{ color: t.text }}>
                Annotated tag
              </span>
            </label>
            <p className="text-xs mt-1" style={{ color: t.textMuted }}>
              Recommended for releases. Contains metadata about the tagger and
              message.
            </p>
          </div>

          {/* Conditional fields for annotated tags */}
          {isAnnotated && (
            <>
              <div>
                <label
                  className="block text-sm font-medium mb-2"
                  style={{ color: t.text }}
                >
                  Tagger name
                </label>
                <input
                  type="text"
                  value={taggerName}
                  onChange={(e) => setTaggerName(e.target.value)}
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
                  Message
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Release notes or tag message..."
                  rows={3}
                  className="w-full px-3 py-2 text-sm rounded-lg border focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  style={{
                    backgroundColor: t.inputBg,
                    borderColor: t.border,
                    color: t.text,
                  }}
                />
              </div>
            </>
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
              disabled={createTag.isPending || !tagName.trim() || isRepoEmpty}
              className="flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                backgroundColor: t.accent,
                color: t.successText,
              }}
            >
              {createTag.isPending ? "Creating..." : "Create tag"}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
