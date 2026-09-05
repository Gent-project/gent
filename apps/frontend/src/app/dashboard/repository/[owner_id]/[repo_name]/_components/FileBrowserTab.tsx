"use client";

import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  File,
  Folder,
  ChevronRight,
  ArrowLeft,
  Download,
  Edit,
  Copy,
  GitCommit,
  Hash,
} from "lucide-react";
import { useTree, useBlob, type TreeEntry } from "@/hooks/use-files";
import { useCanonicalFiles, bytesToBase64 } from "@/hooks/use-canonical-files";
import { usePushPack } from "@/hooks/use-git-operations";
import { useCommits } from "@/hooks/use-commits";
import { useBranches } from "@/hooks/use-branches";
import { getDashboardTheme } from "@/app/dashboard/_components/dashboard-theme";
import {
  calculateBlobSHA,
  calculateCommitSHA,
  calculateTreeSHA,
  encodeContentToBase64,
  formatGitPerson,
  getUtf8ByteLength,
} from "@/utils/git-hash";
import FileToolbar from "./FileToolbar";
import CreateFileModal from "./CreateFileModal";
import UploadFileModal from "./UploadFileModal";

interface FileBrowserTabProps {
  ownerId: number | string;
  /** False for anonymous/read-only visitors: hides every write control. */
  canWrite?: boolean;
  repoName: string;
  isDark: boolean;
  defaultBranch: string;
  userEmail: string;
}

type BrowserEntry = TreeEntry & {
  isVirtualDirectory?: boolean;
  virtualPath?: string[];
};

const splitRepositoryPath = (value: string) =>
  value.split(/[\\/]+/).filter(Boolean);

const startsWithPath = (path: string[], prefix: string[]) =>
  prefix.every((segment, index) => path[index] === segment);

export default function FileBrowserTab({
  ownerId,
  repoName,
  isDark,
  defaultBranch,
  userEmail,
  canWrite = false,
}: FileBrowserTabProps) {
  const [currentPath, setCurrentPath] = useState<string[]>([]);
  const [selectedBranch, setSelectedBranch] = useState(defaultBranch);
  const [treePath, setTreePath] = useState<
    Array<{ name: string; sha: string }>
  >([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"tree" | "file">("tree");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editContent, setEditContent] = useState("");
  const [editError, setEditError] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  useEffect(() => {
    const resetPath = () => {
      setCurrentPath([]);
      setTreePath([]);
    };
    window.addEventListener("repo:reset-path", resetPath);
    return () => window.removeEventListener("repo:reset-path", resetPath);
  }, []);

  const t = getDashboardTheme(isDark);
  const queryClient = useQueryClient();
  const pushPack = usePushPack();
  const canonicalFiles = useCanonicalFiles(ownerId, repoName);

  // Get the latest commit and its tree SHA from the backend.
  const { data: commits = [], isLoading: commitsLoading } = useCommits(
    ownerId,
    repoName,
  );
  const { data: branches = [], isLoading: branchesLoading } = useBranches(
    ownerId,
    repoName,
  );
  const selectedBranchData = useMemo(() => {
    return branches.find((branch) => branch.name === selectedBranch) ?? null;
  }, [branches, selectedBranch]);

  const selectedBranchCommit = useMemo(() => {
    if (!selectedBranchData?.commit_sha) return null;

    return (
      commits.find((commit) => commit.sha === selectedBranchData.commit_sha) ??
      null
    );
  }, [commits, selectedBranchData]);

  const selectedBranchTreeSha = selectedBranchCommit?.tree_sha ?? null;

  const activeTreeSha =
    treePath[treePath.length - 1]?.sha ?? selectedBranchTreeSha ?? "";
  useEffect(() => {
    setCurrentPath([]);
    setTreePath([]);
    setSelectedFile(null);
    setViewMode("tree");
  }, [selectedBranch]);
  // Get the current directory tree using the active tree SHA.
  const { data: tree, isLoading: treeLoading } = useTree(
    ownerId,
    repoName,
    activeTreeSha,
    { enabled: !!activeTreeSha },
  );

  // Get file content if a file is selected
  const { data: fileBlob, isLoading: fileLoading } = useBlob(
    ownerId,
    repoName,
    selectedFile || "",
  );

  // console.log("[FileBrowserTab] Latest commit:", latestCommit);
  // console.log("[FileBrowserTab] Current tree SHA:", activeTreeSha);
  // console.log("[FileBrowserTab] Tree response:", tree);
  // console.log("[FileBrowserTab] Tree entries:", tree?.entries);

  const currentEntries = useMemo<BrowserEntry[]>(() => {
    if (!tree?.entries) return [];

    const virtualSegments = currentPath.slice(treePath.length);
    const visibleEntries = new Map<string, BrowserEntry>();

    tree.entries.forEach((entry) => {
      const sourcePath = splitRepositoryPath(entry.path || entry.name);
      let relativePath = sourcePath;

      if (currentPath.length > 0 && startsWithPath(sourcePath, currentPath)) {
        relativePath = sourcePath.slice(currentPath.length);
      } else if (
        virtualSegments.length > 0 &&
        startsWithPath(sourcePath, virtualSegments)
      ) {
        relativePath = sourcePath.slice(virtualSegments.length);
      } else if (virtualSegments.length > 0) {
        return;
      }

      if (relativePath.length === 0) return;

      const name = relativePath[0];
      if (relativePath.length > 1) {
        const virtualPath = [...currentPath, name];
        const key = `tree:${virtualPath.join("/")}`;
        if (!visibleEntries.has(key)) {
          visibleEntries.set(key, {
            mode: "040000",
            name,
            path: virtualPath.join("/"),
            hash: key,
            sha: key,
            type: "tree",
            isVirtualDirectory: true,
            virtualPath,
          });
        }
        return;
      }

      visibleEntries.set(`${entry.type}:${entry.sha}:${name}`, {
        ...entry,
        name,
      });
    });

    return [...visibleEntries.values()].sort((a, b) => {
      if (a.type !== b.type) return a.type === "tree" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }, [currentPath, tree?.entries, treePath.length]);

  const selectedEntry = useMemo(() => {
    if (!tree?.entries || !selectedFile) return null;
    return tree.entries.find((entry) => entry.sha === selectedFile) ?? null;
  }, [selectedFile, tree?.entries]);

  const handleItemClick = (item: BrowserEntry) => {
    if (item.type === "tree") {
      if (item.isVirtualDirectory) {
        setCurrentPath(item.virtualPath ?? [...currentPath, item.name]);
        setViewMode("tree");
        setSelectedFile(null);
        return;
      }

      const nextTreePath = [...treePath, { name: item.name, sha: item.sha }];
      setTreePath(nextTreePath);
      setCurrentPath([...currentPath, item.name]);
      setViewMode("tree");
      setSelectedFile(null);
    } else {
      setSelectedFile(item.sha);
      setViewMode("file");
    }
  };

  const handleBackClick = () => {
    if (viewMode === "file") {
      setViewMode("tree");
      setSelectedFile(null);
    } else if (currentPath.length > treePath.length) {
      setCurrentPath(currentPath.slice(0, -1));
    } else if (treePath.length > 0) {
      const nextTreePath = treePath.slice(0, -1);
      setTreePath(nextTreePath);
      setCurrentPath(currentPath.slice(0, -1));
    } else if (currentPath.length > 0) {
      setCurrentPath(currentPath.slice(0, -1));
    }
  };

  const decodeFileContent = (content: string, encoding?: string) => {
    if (encoding?.toLowerCase() === "base64") {
      const binary = atob(content);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      return bytes;
    }

    return new TextEncoder().encode(content);
  };

  const getDownloadMimeType = (fileName: string) => {
    const ext = fileName.split(".").pop()?.toLowerCase();
    const mimeTypes: Record<string, string> = {
      css: "text/css;charset=utf-8",
      csv: "text/csv;charset=utf-8",
      html: "text/html;charset=utf-8",
      js: "text/javascript;charset=utf-8",
      json: "application/json;charset=utf-8",
      md: "text/markdown;charset=utf-8",
      pdf: "application/pdf",
      png: "image/png",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      gif: "image/gif",
      svg: "image/svg+xml;charset=utf-8",
      ts: "text/typescript;charset=utf-8",
      tsx: "text/typescript;charset=utf-8",
      txt: "text/plain;charset=utf-8",
      xml: "application/xml;charset=utf-8",
      yml: "application/yaml;charset=utf-8",
      yaml: "application/yaml;charset=utf-8",
      zip: "application/zip",
    };
    return mimeTypes[ext || ""] || "application/octet-stream";
  };

  const handleDownloadFile = () => {
    if (!fileBlob || !selectedEntry) return;

    const fileName =
      splitRepositoryPath(selectedEntry.path || selectedEntry.name).at(-1) ||
      "download";
    const bytes = decodeFileContent(fileBlob.content, fileBlob.encoding);
    const blob = new Blob([bytes], { type: getDownloadMimeType(fileName) });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const handleCopyFile = async () => {
    if (!fileBlob) return;
    try {
      await navigator.clipboard.writeText(fileBlob.content);
    } catch {
      setEditError("Unable to copy file content.");
    }
  };

  const handleEditFile = () => {
    if (fileBlob?.encoding === "base64") return;
    setEditContent(fileBlob?.content || "");
    setEditError("");
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedEntry || !tree?.entries) return;

    setIsSavingEdit(true);
    setEditError("");

    try {
      if (!canonicalFiles.ready) throw new Error("Repository is still loading");
      if (canonicalFiles.canonical) {
        await canonicalFiles.mutateAsync({ branch: selectedBranch,
          expected_head: selectedBranchData?.commit_sha || null,
          message: `Update ${selectedEntry.name}`,
          files: [{ path: [...currentPath, selectedEntry.name].join("/"),
            data: bytesToBase64(new TextEncoder().encode(editContent)) }] });
        setViewMode("tree"); setSelectedFile(null); setTreePath([]); setCurrentPath([]);
        setIsEditModalOpen(false); setEditContent("");
        return;
      }
      const safeUserEmail = userEmail?.trim() || "user@example.com";
      const resolvedAuthorName =
        safeUserEmail
          .split("@")[0]
          .replace(/[._-]+/g, " ")
          .trim() || "User";
      const authorString = formatGitPerson(
        resolvedAuthorName,
        safeUserEmail,
        new Date(),
      );
      const normalizedContent = editContent.replace(/\r\n/g, "\n");
      const newBlobSha = await calculateBlobSHA(normalizedContent);
      const nextTreeEntries = [...tree.entries]
        .filter((entry) => entry.sha !== selectedEntry.sha)
        .concat({
          mode: "100644",
          name: selectedEntry.name,
          path: selectedEntry.path || selectedEntry.name,
          sha: newBlobSha,
          hash: newBlobSha,
          type: "blob" as const,
        });
      const nextTreeSha = await calculateTreeSHA(
        nextTreeEntries.map((entry) => ({
          mode: entry.mode,
          name: entry.name,
          sha: entry.sha,
        })),
      );
      const commitSha = await calculateCommitSHA({
        treeSHA: nextTreeSha,
        parentSHAs: selectedBranchCommit ? [selectedBranchCommit.sha] : [],
        author: authorString,
        committer: authorString,
        message: `Update ${selectedEntry.name}`,
      });
      const base64Content = encodeContentToBase64(normalizedContent);
      const contentSize = getUtf8ByteLength(normalizedContent);

      const pack = {
        branch: selectedBranch,
        force: false,
        commits: [
          {
            hash: commitSha,
            message: `Update ${selectedEntry.name}`,
            author: {
              name: resolvedAuthorName,
              email: safeUserEmail,
            },
            timestamp: new Date().toISOString(),
            parent: selectedBranchCommit ? selectedBranchCommit.sha : null,
            mergeParent: null,
            treeHash: nextTreeSha,
            tree: nextTreeEntries.map((entry) => ({
              mode: entry.mode,
              name: entry.name,
              path: entry.path || entry.name,
              hash: entry.sha,
              sha: entry.sha,
              type: entry.type || "blob",
            })),
            files: nextTreeEntries.map((entry) => ({
              path: entry.path || entry.name,
              hash: entry.sha,
            })),
            stats: {},
          },
        ],
        objects: [
          {
            hash: newBlobSha,
            size: contentSize,
            type: "blob" as const,
            data: base64Content,
          },
        ],
        branch_updates: [
          {
            name: selectedBranch,
            commit_sha: commitSha,
          },
        ],
        tags: {},
      };

      await pushPack.mutateAsync({ ownerId, repoName, pack });
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
      setSelectedFile(newBlobSha);
      setIsEditModalOpen(false);
      setEditContent("");
      setEditError("");
    } catch {
      setEditError("Unable to save the updated file.");
    } finally {
      setIsSavingEdit(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  const getFileLanguage = (filename: string) => {
    const ext = filename.split(".").pop()?.toLowerCase();
    const langMap: Record<string, string> = {
      js: "javascript",
      jsx: "javascript",
      ts: "typescript",
      tsx: "typescript",
      py: "python",
      java: "java",
      cpp: "cpp",
      c: "c",
      css: "css",
      html: "html",
      json: "json",
      xml: "xml",
      yaml: "yaml",
      yml: "yaml",
      md: "markdown",
      txt: "text",
    };
    return langMap[ext || ""] || "text";
  };

  const renderHighlightedCode = (content: string, language: string) => {
    const patterns =
      language === "json"
        ? /("(?:\\.|[^"\\])*"(?=\s*:)|"(?:\\.|[^"\\])*"|\b(?:true|false|null)\b|-?\b\d+(?:\.\d+)?\b)/g
        : /("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|\b(?:const|let|var|function|return|if|else|for|while|class|interface|type|import|from|export|async|await|try|catch|new|true|false|null|undefined)\b|\/\/.*|#.*|\/\*[\s\S]*?\*\/|-?\b\d+(?:\.\d+)?\b)/g;

    const colorFor = (token: string) => {
      if (/^["'`]/.test(token)) return isDark ? "#86efac" : "#15803d";
      if (/^(\/\/|#|\/\*)/.test(token)) return isDark ? "#94a3b8" : "#64748b";
      if (/^-?\d/.test(token)) return isDark ? "#fbbf24" : "#b45309";
      if (/^(true|false|null|undefined)$/.test(token)) {
        return isDark ? "#f9a8d4" : "#be185d";
      }
      if (/^".*"$/.test(token) && language === "json") {
        return isDark ? "#93c5fd" : "#1d4ed8";
      }
      return isDark ? "#c4b5fd" : "#7c3aed";
    };

    return content.split("\n").map((line, lineIndex) => {
      const parts: React.ReactNode[] = [];
      let lastIndex = 0;

      for (const match of line.matchAll(patterns)) {
        const token = match[0];
        const index = match.index ?? 0;
        if (index > lastIndex) {
          parts.push(line.slice(lastIndex, index));
        }
        parts.push(
          <span key={`${lineIndex}-${index}`} style={{ color: colorFor(token) }}>
            {token}
          </span>,
        );
        lastIndex = index + token.length;
      }

      if (lastIndex < line.length) {
        parts.push(line.slice(lastIndex));
      }

      return (
        <span key={lineIndex}>
          {parts}
          {lineIndex < content.split("\n").length - 1 ? "\n" : ""}
        </span>
      );
    });
  };

  // Show loading only when actually loading commits or tree (not when empty)
  if (
    (commitsLoading || treeLoading) &&
    viewMode === "tree" &&
    selectedBranchTreeSha !== null
  ) {
    return (
      <>
        <div className="space-y-4">
          <FileToolbar
            currentPath={currentPath}
            repoName={repoName}
            isDark={isDark}
            onCreate={() => setShowCreateModal(true)}
            onUpload={() => setShowUploadModal(true)}
            canWrite={canWrite}
            branches={branches}
            selectedBranch={selectedBranch}
            defaultBranch={defaultBranch}
            onBranchChange={setSelectedBranch}
          />

          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 animate-pulse">
                <div className="w-5 h-5 bg-gray-300 rounded"></div>
                <div className="h-4 bg-gray-300 rounded flex-1"></div>
                <div className="w-20 h-4 bg-gray-300 rounded"></div>
              </div>
            ))}
          </div>
        </div>

        <CreateFileModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          ownerId={ownerId}
          repoName={repoName}
          isDark={isDark}
          defaultBranch={defaultBranch}
          userEmail={userEmail}
          currentPath={currentPath}
          currentTreeSha={activeTreeSha}
        />
        <UploadFileModal
          isOpen={showUploadModal}
          onClose={() => setShowUploadModal(false)}
          ownerId={ownerId}
          repoName={repoName}
          isDark={isDark}
          defaultBranch={defaultBranch}
          userEmail={userEmail}
          currentPath={currentPath}
        />
      </>
    );
  }

  // Empty repository view - show immediately if no tree is available yet
  if (
    !selectedBranchTreeSha ||
    !tree ||
    !tree.entries ||
    tree.entries.length === 0
  ) {
    return (
      <>
        <div className="space-y-4">
          <FileToolbar
            currentPath={currentPath}
            repoName={repoName}
            isDark={isDark}
            onCreate={() => setShowCreateModal(true)}
            onUpload={() => setShowUploadModal(true)}
            canWrite={canWrite}
            branches={branches}
            selectedBranch={selectedBranch}
            defaultBranch={defaultBranch}
            onBranchChange={setSelectedBranch}
          />

          <div className="text-center py-12">
            <Folder
              className="w-16 h-16 mx-auto mb-4 opacity-40"
              style={{ color: t.textMuted }}
            />
            <h3
              className="text-lg font-semibold mb-2"
              style={{ color: t.text }}
            >
              This repository is empty
            </h3>
            <p className="text-sm mb-6" style={{ color: t.textMuted }}>
              Create the first file here, upload files, or use the Gent CLI to
              push an existing project.
            </p>

            <p className="mx-auto max-w-md text-xs leading-5" style={{ color: t.textMuted }}>
              Genti will guide your first push from the repository panel.
            </p>
          </div>
        </div>

        <CreateFileModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          ownerId={ownerId}
          repoName={repoName}
          isDark={isDark}
          defaultBranch={defaultBranch}
          userEmail={userEmail}
          currentPath={currentPath}
          currentTreeSha={activeTreeSha}
        />
        <UploadFileModal
          isOpen={showUploadModal}
          onClose={() => setShowUploadModal(false)}
          ownerId={ownerId}
          repoName={repoName}
          isDark={isDark}
          defaultBranch={defaultBranch}
          userEmail={userEmail}
          currentPath={currentPath}
        />
      </>
    );
  }

  // File view
  if (viewMode === "file" && selectedFile) {
    return (
      <>
        <div className="space-y-4">
          <FileToolbar
            currentPath={currentPath}
            repoName={repoName}
            isDark={isDark}
            onCreate={() => setShowCreateModal(true)}
            onUpload={() => setShowUploadModal(true)}
            canWrite={canWrite}
            branches={branches}
            selectedBranch={selectedBranch}
            defaultBranch={defaultBranch}
            onBranchChange={setSelectedBranch}
          />

          {/* File header */}
          <div className="flex items-center justify-between rounded-xl border px-3 py-2" style={{ borderColor: t.border, background: t.inputBg }}>
            <button
              onClick={handleBackClick}
              className="flex items-center gap-2 text-sm transition-colors"
              style={{ color: t.textMuted }}
            >
              <ArrowLeft className="w-4 h-4" />
              Back to files
            </button>

            <div className="flex items-center gap-2">
              <button
                onClick={handleDownloadFile}
                className="rounded-lg border p-2 transition-colors"
                style={{ color: t.textMuted, borderColor: t.border }}
                title="Download file"
              >
                <Download className="w-4 h-4" />
              </button>
              <button
                onClick={handleCopyFile}
                disabled={fileBlob?.encoding === "base64"}
                className="rounded-lg border p-2 transition-colors"
                style={{ color: t.textMuted, borderColor: t.border }}
                title="Copy content"
              >
                <Copy className="w-4 h-4" />
              </button>
              <button
                onClick={handleEditFile}
                disabled={fileBlob?.encoding === "base64"}
                className="rounded-lg border p-2 transition-colors"
                style={{ color: t.textMuted, borderColor: t.border }}
                title="Edit file"
              >
                <Edit className="w-4 h-4" />
              </button>
            </div>
          </div>

          {fileLoading ? (
            <div className="animate-pulse">
              <div className="h-64 bg-gray-300 rounded"></div>
            </div>
          ) : fileBlob ? (
            <div className="overflow-hidden rounded-xl border" style={{ borderColor: t.border }}>
              {/* File info */}
              <div
                className="flex items-center justify-between border-b px-4 py-3"
                style={{
                  backgroundColor: t.surface,
                  borderColor: t.border,
                }}
              >
                <div className="text-sm" style={{ color: t.textMuted }}>
                  {formatFileSize(fileBlob.size)} •{" "}
                  {getFileLanguage(selectedEntry?.name || "")}
                </div>
                <div className="text-sm" style={{ color: t.textMuted }}>
                  {fileBlob.encoding}
                </div>
              </div>

              {/* File content */}
              <div
                className="max-h-[620px] overflow-auto p-4"
                style={{
                  backgroundColor: t.surface,
                  fontFamily:
                    'ui-monospace, SFMono-Regular, "SF Mono", Monaco, Consolas, monospace',
                }}
              >
                <pre className="text-sm whitespace-pre-wrap" style={{ color: t.text }}>
                  <code>
                    {fileBlob.encoding === "base64" ? "Binary file. Download to view." : renderHighlightedCode(
                      fileBlob.content,
                      getFileLanguage(selectedEntry?.name || ""),
                    )}
                  </code>
                </pre>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <File
                className="w-12 h-12 mx-auto mb-2 opacity-40"
                style={{ color: t.textMuted }}
              />
              <p className="text-sm" style={{ color: t.textMuted }}>
                Unable to load file content
              </p>
            </div>
          )}
        </div>

        <CreateFileModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          ownerId={ownerId}
          repoName={repoName}
          isDark={isDark}
          defaultBranch={defaultBranch}
          userEmail={userEmail}
          currentPath={currentPath}
          currentTreeSha={activeTreeSha}
        />
        <UploadFileModal
          isOpen={showUploadModal}
          onClose={() => setShowUploadModal(false)}
          ownerId={ownerId}
          repoName={repoName}
          isDark={isDark}
          defaultBranch={defaultBranch}
          userEmail={userEmail}
          currentPath={currentPath}
        />
        {isEditModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
            <div
              className="w-full max-w-2xl rounded-lg border p-4 shadow-xl"
              style={{
                backgroundColor: t.surface,
                borderColor: t.border,
              }}
            >
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-lg font-semibold" style={{ color: t.text }}>
                  Edit file
                </h3>
                <button
                  onClick={() => setIsEditModalOpen(false)}
                  className="rounded-lg p-2 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
                  style={{ color: t.textMuted }}
                >
                  ✕
                </button>
              </div>

              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="min-h-64 w-full rounded-lg border p-3 text-sm"
                style={{
                  backgroundColor: t.inputBg,
                  color: t.text,
                  borderColor: t.border,
                }}
              />

              {editError ? (
                <p className="mt-2 text-sm" style={{ color: "#ef4444" }}>
                  {editError}
                </p>
              ) : null}

              <div className="mt-4 flex justify-end gap-2">
                <button
                  onClick={() => setIsEditModalOpen(false)}
                  className="rounded-lg px-3 py-2 text-sm transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
                  style={{ color: t.textMuted }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEdit}
                  disabled={isSavingEdit}
                  className="rounded-lg px-3 py-2 text-sm transition-colors disabled:opacity-60"
                  style={{
                    backgroundColor: t.accent,
                    color: t.successText,
                  }}
                >
                  {isSavingEdit ? "Saving..." : "Save changes"}
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  // Directory tree view
  return (
    <>
      <div className="space-y-4">
        <FileToolbar
          currentPath={currentPath}
          repoName={repoName}
          isDark={isDark}
          onCreate={() => setShowCreateModal(true)}
          onUpload={() => setShowUploadModal(true)}
          canWrite={canWrite}
          branches={branches}
          selectedBranch={selectedBranch}
          defaultBranch={defaultBranch}
          onBranchChange={setSelectedBranch}
        />

        <div className="overflow-hidden rounded-xl border" style={{ borderColor: t.border }}>
          <div className="flex flex-col gap-2 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between" style={{ borderColor: t.border, background: t.inputBg }}>
            <div className="flex min-w-0 items-center gap-2">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full" style={{ background: t.accentMuted, color: t.accent }}>
                <GitCommit className="h-3.5 w-3.5" />
              </span>
              <span className="truncate text-xs font-medium" style={{ color: t.text }} data-no-translate={Boolean(selectedBranchCommit?.message) || undefined}>
                {selectedBranchCommit?.message || "Repository tree"}
              </span>
            </div>
            {selectedBranchCommit && (
              <span className="inline-flex shrink-0 items-center gap-1.5 font-mono text-[10px]" style={{ color: t.textMuted }}>
                <Hash className="h-3 w-3" />{selectedBranchCommit.sha.slice(0, 7)}
              </span>
            )}
          </div>

          <div className="grid grid-cols-[minmax(0,1fr)_110px] border-b px-4 py-2 font-mono text-[9px] uppercase tracking-[0.14em] sm:grid-cols-[minmax(0,1fr)_120px_100px]" style={{ borderColor: t.borderMuted, color: t.textMuted }}>
            <span>Name</span><span>Object</span><span className="hidden sm:block">Type</span>
          </div>

          {currentPath.length > 0 && (
            <button onClick={handleBackClick} className="grid w-full grid-cols-[minmax(0,1fr)_110px] items-center border-b px-4 py-3 text-left text-sm transition-colors sm:grid-cols-[minmax(0,1fr)_120px_100px]" style={{ borderColor: t.borderMuted, color: t.textMuted }}>
              <span className="flex items-center gap-3"><ArrowLeft className="h-4 w-4" /><span className="font-medium">..</span></span>
              <span className="font-mono text-[10px]">parent</span><span className="hidden text-xs sm:block">Directory</span>
            </button>
          )}

          {currentEntries.map((item, index) => (
            <motion.button
              key={item.sha}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: Math.min(index, 10) * 0.025 }}
              onClick={() => handleItemClick(item)}
              className="group grid w-full grid-cols-[minmax(0,1fr)_110px] items-center border-b px-4 py-3 text-left transition-colors last:border-b-0 sm:grid-cols-[minmax(0,1fr)_120px_100px]"
              style={{ borderColor: t.borderMuted }}
            >
              <span className="flex min-w-0 items-center gap-3">
                {item.type === "tree" ? <Folder className="h-4.5 w-4.5 shrink-0" style={{ color: t.accent }} /> : <File className="h-4.5 w-4.5 shrink-0" style={{ color: t.textMuted }} />}
                <span className="truncate text-sm font-medium group-hover:underline" style={{ color: t.text }} data-no-translate>{item.name}</span>
              </span>
              <span className="flex items-center justify-between gap-2 font-mono text-[10px]" style={{ color: t.textMuted }}>
                {item.isVirtualDirectory ? "—" : item.sha.substring(0, 7)}<ChevronRight className="h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-100" />
              </span>
              <span className="hidden text-xs capitalize sm:block" style={{ color: t.textMuted }}>{item.type === "tree" ? "Directory" : "File"}</span>
            </motion.button>
          ))}
        </div>
      </div>

      <CreateFileModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        ownerId={ownerId}
        repoName={repoName}
        isDark={isDark}
        defaultBranch={selectedBranch}
        userEmail={userEmail}
        currentPath={currentPath}
        currentTreeSha={activeTreeSha}
      />
      <UploadFileModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        ownerId={ownerId}
        repoName={repoName}
        isDark={isDark}
        defaultBranch={selectedBranch}
        userEmail={userEmail}
        currentPath={currentPath}
      />
    </>
  );
}
