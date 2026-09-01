"use client";

import { useState } from "react";
import { GitBranch, Plus, Trash2, MoreVertical } from "lucide-react";
import { Branch } from "@/types/repository";
import { useDeleteBranch } from "@/hooks/use-branches";
import { getDashboardTheme } from "@/app/dashboard/_components/dashboard-theme";
import CreateBranchModal from "./CreateBranchModal";

interface BranchesTabProps {
  branches: Branch[];
  isLoading: boolean;
  isDark: boolean;
  defaultBranch: string;
  ownerId: number;
  repoName: string;
  userEmail: string;
}

export default function BranchesTab({ 
  branches, 
  isLoading, 
  isDark, 
  defaultBranch,
  ownerId,
  repoName,
  userEmail 
}: BranchesTabProps) {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState<string | null>(null);
  
  const deleteBranch = useDeleteBranch();
  const t = getDashboardTheme(isDark);

  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 60) return `${diffInSeconds} seconds ago`;
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
    if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)} days ago`;
    if (diffInSeconds < 31536000) return `${Math.floor(diffInSeconds / 2592000)} months ago`;
    return `${Math.floor(diffInSeconds / 31536000)} years ago`;
  };

  const handleDelete = async (branchName: string) => {
    if (branchName === defaultBranch) return;
    
    try {
      await deleteBranch.mutateAsync({
        ownerId,
        repoName,
        branchName
      });
      setDeleteConfirmation(null);
    } catch (error) {
      console.error('Failed to delete branch:', error);
    }
  };

  return (
    <>
      <div>
        <div 
          className="flex items-center justify-between p-4 border-b"
          style={{ borderColor: t.border }}
        >
          <h3 className="font-semibold" style={{ color: t.text }}>
            {branches.length} {branches.length === 1 ? 'branch' : 'branches'}
          </h3>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors"
            style={{
              backgroundColor: t.accent,
              color: t.successText,
            }}
          >
            <Plus className="w-4 h-4" />
            New branch
          </button>
        </div>

        {isLoading ? (
          <div className="p-6">
            <div className="animate-pulse space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex justify-between items-center p-3">
                  <div className="flex-1">
                    <div className="h-4 bg-gray-300 rounded mb-1 w-1/3"></div>
                    <div className="h-3 bg-gray-300 rounded w-1/2"></div>
                  </div>
                  <div className="h-8 bg-gray-300 rounded w-16"></div>
                </div>
              ))}
            </div>
          </div>
        ) : branches.length > 0 ? (
          <div>
            {branches.map((branch, index) => (
              <div
                key={branch.id}
                className={`flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors ${
                  index !== branches.length - 1 ? 'border-b' : ''
                }`}
                style={{ borderColor: t.border }}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <GitBranch className="w-4 h-4" style={{ color: t.textMuted }} />
                    <span className="font-medium" style={{ color: t.text }}>
                      {branch.name}
                    </span>
                    {branch.name === defaultBranch && (
                      <span 
                        className="px-2 py-0.5 text-xs rounded-full border"
                        style={{ borderColor: t.border, color: t.textMuted }}
                      >
                        default
                      </span>
                    )}
                  </div>
                  <p className="text-xs mt-1" style={{ color: t.textMuted }}>
                    Updated {formatRelativeTime(branch.updated_at)} • {branch.commit_sha.substring(0, 7)}
                  </p>
                </div>
                
                {branch.name !== defaultBranch && (
                  <div className="relative">
                    <button
                      onClick={() => setDeleteConfirmation(deleteConfirmation === branch.name ? null : branch.name)}
                      className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                      style={{ color: t.textMuted }}
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>
                    
                    {deleteConfirmation === branch.name && (
                      <div
                        className="absolute right-0 top-full mt-1 w-48 rounded-lg border shadow-lg p-2 z-10"
                        style={{
                          backgroundColor: t.elevated,
                          borderColor: t.border,
                        }}
                      >
                        <button
                          onClick={() => handleDelete(branch.name)}
                          disabled={deleteBranch.isPending}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-50"
                        >
                          <Trash2 className="w-4 h-4" />
                          {deleteBranch.isPending ? 'Deleting...' : 'Delete branch'}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 p-6">
            <GitBranch className="w-16 h-16 mx-auto mb-4 opacity-40" style={{ color: t.textMuted }} />
            <h3 className="text-lg font-semibold mb-2" style={{ color: t.text }}>
              Default branch only
            </h3>
            <p className="text-sm mb-4" style={{ color: t.textMuted }}>
              Only the {defaultBranch} branch exists. Create additional branches to organize your work.
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              style={{
                backgroundColor: t.accent,
                color: t.successText,
              }}
            >
              <Plus className="w-4 h-4 inline mr-2" />
              Create branch
            </button>
          </div>
        )}
      </div>

      {/* Create Branch Modal */}
      <CreateBranchModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        ownerId={ownerId}
        repoName={repoName}
        isDark={isDark}
        defaultBranch={defaultBranch}
        branches={branches}
      />
    </>
  );
}