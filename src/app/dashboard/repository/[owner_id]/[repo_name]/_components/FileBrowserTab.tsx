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
} from "lucide-react";
import { useTree, useBlob, type TreeEntry } from "@/hooks/use-files";
import { usePushPack } from "@/hooks/use-git-operations";
import { useCommits } from "@/hooks/use-commits";
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
  ownerId: number;
  repoName: string;
  isDark: boolean;
  defaultBranch: string;
  userEmail: string;
}

export default function FileBrowserTab({
  ownerId,
  repoName,
  isDark,
  defaultBranch,
  userEmail,
}: FileBrowserTabProps) {
  const [currentPath, setCurrentPath] = useState<string[]>([]);
  const [treePath, setTreePath] = useState<Array<{ name: string; sha: string }>>(
    [],
  );
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

  // Get the latest commit and its tree SHA from the backend.
  const { data: commits = [], isLoading: commitsLoading } = useCommits(
    ownerId,
    repoName,
  );
  const latestCommit = useMemo(() => {
    return [...commits].sort((a, b) => {
      const aTime = new Date(a.committed_at || a.created_at || 0).getTime();
      const bTime = new Date(b.committed_at || b.created_at || 0).getTime();
      return bTime - aTime;
    })[0] ?? null;
  }, [commits]);
  const latestTreeSha = latestCommit?.tree_sha ?? null;
  const activeTreeSha = treePath[treePath.length - 1]?.sha ?? latestTreeSha ?? "";

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

  console.log("[FileBrowserTab] Latest commit:", latestCommit);
  console.log("[FileBrowserTab] Current tree SHA:", activeTreeSha);
  console.log("[FileBrowserTab] Tree response:", tree);
  console.log("[FileBrowserTab] Tree entries:", tree?.entries);

  const currentEntries = useMemo(() => {
    if (!tree?.entries) return [];
    return tree.entries;
  }, [tree?.entries]);

  console.log("[FileBrowserTab] Rendered files:", currentEntries);

  const selectedEntry = useMemo(() => {
    if (!tree?.entries || !selectedFile) return null;
    return tree.entries.find((entry) => entry.sha === selectedFile) ?? null;
  }, [selectedFile, tree?.entries]);

  const handleItemClick = (item: TreeEntry) => {
    if (item.type === "tree") {
      const nextTreePath = [...treePath, { name: item.name, sha: item.sha }];
      setTreePath(nextTreePath);
      setCurrentPath(nextTreePath.map((entry) => entry.name));
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
    } else if (treePath.length > 0) {
      const nextTreePath = treePath.slice(0, -1);
      setTreePath(nextTreePath);
      setCurrentPath(nextTreePath.map((entry) => entry.name));
    } else if (currentPath.length > 0) {
      setCurrentPath(currentPath.slice(0, -1));
    }
  };

  const handleDownloadFile = () => {
    if (!fileBlob || !selectedEntry) return;

    const fileName = selectedEntry.name || selectedEntry.path || "download.txt";
    const blob = new Blob([fileBlob.content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName.split("/").pop() || "download.txt";
    link.click();
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
    setEditContent(fileBlob?.content || "");
    setEditError("");
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedEntry || !tree?.entries) return;

    setIsSavingEdit(true);
    setEditError("");

    try {
      const safeUserEmail = userEmail?.trim() || "user@example.com";
      const resolvedAuthorName =
        safeUserEmail.split("@")[0].replace(/[._-]+/g, " ").trim() || "User";
      const authorString = formatGitPerson(resolvedAuthorName, safeUserEmail, new Date());
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
        parentSHAs: latestCommit ? [latestCommit.sha] : [],
        author: authorString,
        committer: authorString,
        message: `Update ${selectedEntry.name}`,
      });
      const base64Content = encodeContentToBase64(normalizedContent);
      const contentSize = getUtf8ByteLength(normalizedContent);

      const pack = {
        branch: defaultBranch,
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
            parent: latestCommit ? latestCommit.sha : null,
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
        branch_updates: [{ name: defaultBranch, commit_sha: commitSha }],
        tags: {},
      };

      await pushPack.mutateAsync({ ownerId, repoName, pack });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["commits", ownerId, repoName] }),
        queryClient.invalidateQueries({ queryKey: ["branches", ownerId, repoName] }),
        queryClient.invalidateQueries({ queryKey: ["tree", ownerId, repoName] }),
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

  // Show loading only when actually loading commits or tree (not when empty)
  if (
    (commitsLoading || treeLoading) &&
    viewMode === "tree" &&
    latestTreeSha !== null
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
  if (!latestTreeSha || !tree || !tree.entries || tree.entries.length === 0) {
    return (
      <>
        <div className="space-y-4">
          <FileToolbar
            currentPath={currentPath}
            repoName={repoName}
            isDark={isDark}
            onCreate={() => setShowCreateModal(true)}
            onUpload={() => setShowUploadModal(true)}
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
              Use Git CLI to create your first commit and push to this
              repository.
            </p>

            {/* Git CLI Instructions */}
            <div
              className="max-w-2xl mx-auto text-left p-4 rounded-lg border"
              style={{
                backgroundColor: t.surface,
                borderColor: t.border,
              }}
            >
              <h4
                className="text-sm font-semibold mb-3"
                style={{ color: t.text }}
              >
                Quick start with Git CLI:
              </h4>
              <div
                className="p-3 rounded font-mono text-xs space-y-1"
                style={{
                  backgroundColor: t.inputBg,
                  color: t.text,
                }}
              >
                <div>echo &#34;# {repoName}&#34; &gt;&gt; README.md</div>
                <div>git init</div>
                <div>git add README.md</div>
                <div>git commit -m &#34;Initial commit&#34;</div>
                <div>git branch -M {defaultBranch}</div>
                <div>
                  git remote add origin https://gent.dev/
                  {userEmail.split("@")[0]}/{repoName}.git
                </div>
                <div>git push -u origin {defaultBranch}</div>
              </div>
              <button
                onClick={() => {
                  const commands = `echo "# ${repoName}" >> README.md
git init
git add README.md
git commit -m "Initial commit"
git branch -M ${defaultBranch}
git remote add origin https://gent.dev/${userEmail.split("@")[0]}/${repoName}.git
git push -u origin ${defaultBranch}`;
                  navigator.clipboard.writeText(commands);
                }}
                className="mt-3 px-3 py-2 text-xs rounded-lg transition-colors"
                style={{
                  backgroundColor: t.accent,
                  color: t.successText,
                }}
              >
                Copy commands
              </button>
            </div>
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
          />

          {/* File header */}
          <div className="flex items-center justify-between">
            <button
              onClick={handleBackClick}
              className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
              style={{ color: t.textMuted }}
            >
              <ArrowLeft className="w-4 h-4" />
              Back to files
            </button>

            <div className="flex items-center gap-2">
              <button
                onClick={handleDownloadFile}
                className="p-2 rounded-lg transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
                style={{ color: t.textMuted }}
                title="Download file"
              >
                <Download className="w-4 h-4" />
              </button>
              <button
                onClick={handleCopyFile}
                className="p-2 rounded-lg transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
                style={{ color: t.textMuted }}
                title="Copy content"
              >
                <Copy className="w-4 h-4" />
              </button>
              <button
                onClick={handleEditFile}
                className="p-2 rounded-lg transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
                style={{ color: t.textMuted }}
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
            <div>
              {/* File info */}
              <div
                className="flex items-center justify-between p-3 border-b"
                style={{
                  backgroundColor: t.surface,
                  borderColor: t.border,
                }}
              >
                <div className="text-sm" style={{ color: t.textMuted }}>
                  {formatFileSize(fileBlob.size)} •{" "}
                  {getFileLanguage(selectedFile || "")}
                </div>
                <div className="text-sm" style={{ color: t.textMuted }}>
                  {fileBlob.encoding}
                </div>
              </div>

              {/* File content */}
              <div
                className="p-4 overflow-auto max-h-96"
                style={{
                  backgroundColor: t.surface,
                  fontFamily:
                    'ui-monospace, SFMono-Regular, "SF Mono", Monaco, Consolas, monospace',
                }}
              >
                <pre className="text-sm" style={{ color: t.text }}>
                  <code>{fileBlob.content}</code>
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
        />

        {/* Back button for directories */}
        {currentPath.length > 0 && (
          <button
            onClick={handleBackClick}
            className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
            style={{ color: t.textMuted }}
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
        )}

        {/* File/folder list */}
        <div className="space-y-1">
          {currentEntries.map((item, index) => (
            <motion.div
              key={item.sha}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              onClick={() => handleItemClick(item)}
              className="flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              {item.type === "tree" ? (
                <Folder className="w-5 h-5 text-blue-500 shrink-0" />
              ) : (
                <File
                  className="w-5 h-5 shrink-0"
                  style={{ color: t.textMuted }}
                />
              )}

              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm" style={{ color: t.text }}>
                  {item.name}
                </div>
              </div>

              <div
                className="flex items-center gap-3 text-xs"
                style={{ color: t.textMuted }}
              >
                <span className="hidden sm:inline">
                  {item.sha.substring(0, 7)}
                </span>
                <ChevronRight className="w-4 h-4" />
              </div>
            </motion.div>
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
