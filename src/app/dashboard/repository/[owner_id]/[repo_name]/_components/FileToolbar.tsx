"use client";

import { useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Plus,
  Upload,
  Check,
  GitBranch,
} from "lucide-react";
import { getDashboardTheme } from "@/app/dashboard/_components/dashboard-theme";

interface Branch {
  id: number | string;
  name: string;
}

interface FileToolbarProps {
  currentPath: string[];
  repoName: string;
  isDark: boolean;
  onCreate: () => void;
  onUpload: () => void;

  branches: Branch[];
  selectedBranch: string;
  onBranchChange: (branchName: string) => void;
}

export default function FileToolbar({
  currentPath,
  repoName,
  isDark,
  onCreate,
  onUpload,
  branches,
  selectedBranch,
  onBranchChange,
}: FileToolbarProps) {
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [showBranchMenu, setShowBranchMenu] = useState(false);

  const menuRef = useRef<HTMLDivElement | null>(null);
  const branchMenuRef = useRef<HTMLDivElement | null>(null);

  const t = getDashboardTheme(isDark);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;

      if (menuRef.current && !menuRef.current.contains(target)) {
        setShowAddMenu(false);
      }

      if (branchMenuRef.current && !branchMenuRef.current.contains(target)) {
        setShowBranchMenu(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleBranchChange = (branchName: string) => {
    onBranchChange(branchName);
    setShowBranchMenu(false);
  };

  return (
    <div className="flex items-center justify-between gap-3">
      {/* Repository / Path */}
      <div className="min-w-0">
        {currentPath.length > 0 ? (
          <div
            className="flex items-center gap-1 text-sm"
            style={{ color: t.textMuted }}
          >
            <button
              onClick={() =>
                window.dispatchEvent(new CustomEvent("repo:reset-path"))
              }
              className="hover:underline"
              style={{ color: t.accent }}
            >
              {repoName}
            </button>

            {currentPath.map((path, index) => (
              <div
                key={`${path}-${index}`}
                className="flex items-center gap-1 min-w-0"
              >
                <ChevronRight className="w-4 h-4 shrink-0" />
                <span className="truncate">{path}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-sm font-medium" style={{ color: t.text }}>
            {repoName}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Branch selector */}
        <div className="relative" ref={branchMenuRef}>
          <button
            type="button"
            onClick={() => setShowBranchMenu((value) => !value)}
            className="flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
            style={{
              borderColor: t.border,
              color: t.text,
            }}
          >
            <GitBranch className="w-3.5 h-3.5" />

            <span className="max-w-32 truncate">{selectedBranch}</span>

            <ChevronDown className="w-3.5 h-3.5" />
          </button>

          {showBranchMenu && (
            <div
              className="absolute right-0 top-full z-20 mt-2 max-h-72 min-w-52 overflow-y-auto rounded-lg border py-2 shadow-lg"
              style={{
                backgroundColor: t.elevated,
                borderColor: t.border,
              }}
            >
              <div
                className="px-3 pb-2 text-xs font-medium"
                style={{ color: t.textMuted }}
              >
                Select branch
              </div>

              {branches.length === 0 ? (
                <div
                  className="px-3 py-2 text-sm"
                  style={{ color: t.textMuted }}
                >
                  No branches available
                </div>
              ) : (
                branches.map((branch) => {
                  const isSelected = branch.name === selectedBranch;

                  return (
                    <button
                      key={branch.id}
                      type="button"
                      onClick={() => handleBranchChange(branch.name)}
                      className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
                      style={{ color: t.text }}
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <GitBranch className="w-4 h-4 shrink-0" />

                        <span className="truncate">{branch.name}</span>
                      </span>

                      {isSelected && (
                        <Check
                          className="w-4 h-4 shrink-0"
                          style={{ color: t.accent }}
                        />
                      )}
                    </button>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* Add file */}
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setShowAddMenu((value) => !value)}
            className="flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
            style={{
              borderColor: t.border,
              color: t.text,
            }}
          >
            <Plus className="w-3.5 h-3.5" />
            Add file
            <ChevronDown className="w-3.5 h-3.5" />
          </button>

          {showAddMenu && (
            <div
              className="absolute right-0 top-full z-10 mt-2 min-w-44 rounded-lg border py-2 shadow-lg"
              style={{
                backgroundColor: t.elevated,
                borderColor: t.border,
              }}
            >
              <button
                type="button"
                onClick={() => {
                  setShowAddMenu(false);
                  onCreate();
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
                style={{ color: t.text }}
              >
                <Plus className="w-4 h-4" />
                New file
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowAddMenu(false);
                  onUpload();
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
                style={{ color: t.text }}
              >
                <Upload className="w-4 h-4" />
                Upload files
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
