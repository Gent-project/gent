"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronRight, Plus, Upload } from "lucide-react";
import { getDashboardTheme } from "@/app/dashboard/_components/dashboard-theme";

interface FileToolbarProps {
  currentPath: string[];
  repoName: string;
  isDark: boolean;
  onCreate: () => void;
  onUpload: () => void;
}

export default function FileToolbar({
  currentPath,
  repoName,
  isDark,
  onCreate,
  onUpload,
}: FileToolbarProps) {
  const [showAddMenu, setShowAddMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const t = getDashboardTheme(isDark);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowAddMenu(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="flex items-center justify-between gap-3">
      <div>
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
              <div key={`${path}-${index}`} className="flex items-center gap-1">
                <ChevronRight className="w-4 h-4" />
                <span>{path}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-sm font-medium" style={{ color: t.text }}>
            {repoName}
          </div>
        )}
      </div>

      <div className="relative flex items-center gap-2" ref={menuRef}>
        <button
          onClick={() => setShowAddMenu((value) => !value)}
          className="flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
          style={{ borderColor: t.border, color: t.text }}
        >
          <Plus className="w-3.5 h-3.5" />
          Add file
          <ChevronDown className="w-3.5 h-3.5" />
        </button>

        {showAddMenu && (
          <div
            className="absolute right-0 top-full z-10 mt-2 min-w-44 rounded-lg border py-2 shadow-lg"
            style={{ backgroundColor: t.elevated, borderColor: t.border }}
          >
            <button
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
  );
}
