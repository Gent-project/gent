"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { X, GitBranch, AlertCircle } from "lucide-react";
import { useCreateBranch } from "@/hooks/use-branches";
import { getDashboardTheme } from "@/app/dashboard/_components/dashboard-theme";

interface CreateBranchModalProps {
  isOpen: boolean;
  onClose: () => void;
  ownerId: number;
  repoName: string;
  isDark: boolean;
  defaultBranch: string;
  branches: Array<{ name: string; commit_sha: string }>;
}

export default function CreateBranchModal({ 
  isOpen, 
  onClose, 
  ownerId, 
  repoName, 
  isDark,
  defaultBranch,
  branches 
}: CreateBranchModalProps) {
  const [branchName, setBranchName] = useState('');
  const [sourceBranch, setSourceBranch] = useState(defaultBranch);
  const [error, setError] = useState('');
  
  const createBranch = useCreateBranch();
  const t = getDashboardTheme(isDark);

  if (!isOpen) return null;

  // Check if repository is empty (no branches/commits)
  const isRepoEmpty = !branches || branches.length === 0;

  const validateBranchName = (name: string) => {
    if (!name.trim()) return 'Branch name is required';
    if (name.includes(' ')) return 'Branch name cannot contain spaces';
    if (name.includes('..')) return 'Branch name cannot contain ".."';
    if (branches.some(b => b.name === name)) return 'Branch name already exists';
    if (name.length > 100) return 'Branch name is too long';
    return '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (isRepoEmpty) {
      setError('Cannot create branches in an empty repository. Create your first commit first.');
      return;
    }
    
    const validationError = validateBranchName(branchName);
    if (validationError) {
      setError(validationError);
      return;
    }

    const sourceBranchData = branches.find(b => b.name === sourceBranch);
    if (!sourceBranchData) {
      setError('Source branch not found');
      return;
    }

    try {
      await createBranch.mutateAsync({
        ownerId,
        repoName,
        data: {
          name: branchName.trim(),
          commit_sha: sourceBranchData.commit_sha
        }
      });
      
      setBranchName('');
      setError('');
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create branch');
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
            <GitBranch className="w-5 h-5" style={{ color: t.accent }} />
            <h3 className="text-lg font-semibold" style={{ color: t.text }}>
              Create a new branch
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
          {/* Branch name */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: t.text }}>
              Branch name
            </label>
            <input
              type="text"
              value={branchName}
              onChange={(e) => {
                setBranchName(e.target.value);
                setError('');
              }}
              placeholder="feature/new-feature"
              className="w-full px-3 py-2 text-sm rounded-lg border focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              style={{
                backgroundColor: t.inputBg,
                borderColor: error ? '#ef4444' : t.border,
                color: t.text,
              }}
              autoFocus
            />
          </div>

          {/* Source branch */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: t.text }}>
              Create from
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
                    {branch.name} {branch.name === defaultBranch && '(default)'}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Error message */}
          {error && (
            <div 
              className="flex items-center gap-2 p-3 text-sm rounded-lg"
              style={{
                backgroundColor: isDark ? '#fef2f2' : '#fef2f2',
                color: '#dc2626',
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
              disabled={createBranch.isPending || !branchName.trim() || isRepoEmpty}
              className="flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                backgroundColor: t.accent,
                color: t.successText,
              }}
            >
              {createBranch.isPending ? 'Creating...' : 'Create branch'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}