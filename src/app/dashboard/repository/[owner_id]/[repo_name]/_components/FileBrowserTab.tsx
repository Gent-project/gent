"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  File,
  Folder,
  ChevronRight,
  ArrowLeft,
  Download,
  Edit,
  Copy,
  Plus,
  Upload,
} from "lucide-react";
import { useTree, useBlob } from "@/hooks/use-files";
import { useCommits } from "@/hooks/use-commits";
import { getDashboardTheme } from "@/app/dashboard/_components/dashboard-theme";
import FileUploadModal from "./FileUploadModal";

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
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"tree" | "file">("tree");
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadMode, setUploadMode] = useState<"upload" | "create">("create");

  // Debug: Log when modal state changes
  useEffect(() => {
    console.log(
      "FileBrowserTab: showUploadModal changed to:",
      showUploadModal,
      "mode:",
      uploadMode,
    );
  }, [showUploadModal, uploadMode]);

  const t = getDashboardTheme(isDark);

  // Get latest commit SHA for the default branch
  const { data: commits = [], isLoading: commitsLoading } = useCommits(
    ownerId,
    repoName,
  );
  const latestCommitSha = commits.length > 0 ? commits[0].sha : null;

  // Get current directory tree - ONLY if we have commits
  const { data: tree, isLoading: treeLoading } = useTree(
    ownerId,
    repoName,
    latestCommitSha || "HEAD",
    { enabled: !!latestCommitSha }, // Disable query if no commits
  );

  // Get file content if a file is selected
  const { data: fileBlob, isLoading: fileLoading } = useBlob(
    ownerId,
    repoName,
    selectedFile || "",
  );

  const handleItemClick = (item: any) => {
    if (item.type === "tree") {
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
    } else if (currentPath.length > 0) {
      setCurrentPath(currentPath.slice(0, -1));
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
    latestCommitSha !== null
  ) {
    return (
      <>
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 animate-pulse">
              <div className="w-5 h-5 bg-gray-300 rounded"></div>
              <div className="h-4 bg-gray-300 rounded flex-1"></div>
              <div className="w-20 h-4 bg-gray-300 rounded"></div>
            </div>
          ))}
        </div>

        {/* File Upload Modal - must be present in ALL views */}
        <FileUploadModal
          isOpen={showUploadModal}
          onClose={() => setShowUploadModal(false)}
          ownerId={ownerId}
          repoName={repoName}
          isDark={isDark}
          defaultBranch={defaultBranch}
          userEmail={userEmail}
          mode={uploadMode}
        />
      </>
    );
  }

  // Empty repository view - show immediately if no commits
  if (!latestCommitSha || !tree || !tree.entries || tree.entries.length === 0) {
    return (
      <>
        <div className="text-center py-12">
          <Folder
            className="w-16 h-16 mx-auto mb-4 opacity-40"
            style={{ color: t.textMuted }}
          />
          <h3 className="text-lg font-semibold mb-2" style={{ color: t.text }}>
            This repository is empty
          </h3>
          <p className="text-sm mb-6" style={{ color: t.textMuted }}>
            Use Git CLI to create your first commit and push to this repository.
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
              <div>echo "# {repoName}" &gt;&gt; README.md</div>
              <div>git init</div>
              <div>git add README.md</div>
              <div>git commit -m "Initial commit"</div>
              <div>git branch -M {defaultBranch}</div>
              <div>
                git remote add origin https://gent.dev/{userEmail.split("@")[0]}
                /{repoName}.git
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
      </>
    );
  }

  // File view
  if (viewMode === "file" && selectedFile) {
    return (
      <>
        <div className="space-y-4">
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
                className="p-2 rounded-lg transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
                style={{ color: t.textMuted }}
                title="Download file"
              >
                <Download className="w-4 h-4" />
              </button>
              <button
                className="p-2 rounded-lg transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
                style={{ color: t.textMuted }}
                title="Copy content"
              >
                <Copy className="w-4 h-4" />
              </button>
              <button
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

        {/* File Upload Modal - must be present in ALL views */}
        <FileUploadModal
          isOpen={showUploadModal}
          onClose={() => setShowUploadModal(false)}
          ownerId={ownerId}
          repoName={repoName}
          isDark={isDark}
          defaultBranch={defaultBranch}
          userEmail={userEmail}
          mode={uploadMode}
        />
      </>
    );
  }

  // Directory tree view
  return (
    <>
      <div className="space-y-4">
        {/* Action buttons when repo has commits */}
        <div className="flex items-center justify-between">
          <div>
            {/* Path breadcrumb */}
            {currentPath.length > 0 && (
              <div
                className="flex items-center gap-1 text-sm"
                style={{ color: t.textMuted }}
              >
                <button
                  onClick={() => setCurrentPath([])}
                  className="hover:underline"
                  style={{ color: t.accent }}
                >
                  {repoName}
                </button>
                {currentPath.map((path, index) => (
                  <div key={index} className="flex items-center gap-1">
                    <ChevronRight className="w-4 h-4" />
                    <button
                      onClick={() =>
                        setCurrentPath(currentPath.slice(0, index + 1))
                      }
                      className="hover:underline"
                      style={{ color: t.accent }}
                    >
                      {path}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Add file buttons */}
          <div className="flex gap-2">
            <button
              onClick={() => {
                setUploadMode("create");
                setShowUploadModal(true);
              }}
              className="flex items-center gap-2 px-3 py-1.5 text-xs rounded-lg border transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
              style={{
                borderColor: t.border,
                color: t.text,
              }}
              title="Create new file"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">New file</span>
            </button>
            <button
              onClick={() => {
                setUploadMode("upload");
                setShowUploadModal(true);
              }}
              className="flex items-center gap-2 px-3 py-1.5 text-xs rounded-lg transition-colors"
              style={{
                backgroundColor: t.accent,
                color: t.successText,
              }}
              title="Upload files"
            >
              <Upload className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Upload</span>
            </button>
          </div>
        </div>

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
          {tree.entries.map((item, index) => (
            <motion.div
              key={item.sha}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              onClick={() => handleItemClick(item)}
              className="flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              {item.type === "tree" ? (
                <Folder className="w-5 h-5 text-blue-500 flex-shrink-0" />
              ) : (
                <File
                  className="w-5 h-5 flex-shrink-0"
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

      {/* File Upload Modal */}
      <FileUploadModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        ownerId={ownerId}
        repoName={repoName}
        isDark={isDark}
        defaultBranch={defaultBranch}
        userEmail={userEmail}
        mode={uploadMode}
      />
    </>
  );
}
