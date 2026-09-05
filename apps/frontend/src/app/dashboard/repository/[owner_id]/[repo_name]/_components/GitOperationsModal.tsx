"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { 
  X, 
  Upload, 
  Download, 
  GitPullRequest, 
  Terminal, 
  Copy, 
  CheckCircle,
  AlertCircle 
} from "lucide-react";
import { usePushPack, usePullRepository } from "@/hooks/use-git-operations";
import { getDashboardTheme } from "@/app/dashboard/_components/dashboard-theme";

interface GitOperationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  ownerId: number | string;
  repoName: string;
  isDark: boolean;
  repositoryUrl: string;
  defaultBranch: string;
}

export default function GitOperationsModal({ 
  isOpen, 
  onClose, 
  ownerId, 
  repoName, 
  isDark,
  repositoryUrl,
  defaultBranch 
}: GitOperationsModalProps) {
  const [activeTab, setActiveTab] = useState<'clone' | 'push' | 'pull'>('clone');
  
  const pushPack = usePushPack();
  const pullRepository = usePullRepository();
  const t = getDashboardTheme(isDark);

  if (!isOpen) return null;

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const cloneCommands = [
    {
      title: "Clone with Gent CLI",
      command: `gent clone ${repositoryUrl}`,
      description: "Uses the repository owner id and name"
    }
  ];

  const setupCommands = [
    `cd ${repoName}`,
    `echo "# ${repoName}" >> README.md`,
    `gent add README.md`,
    `gent commit -m "Initial commit"`,
    `gent remote add origin ${repositoryUrl}`,
    `gent push origin ${defaultBranch}`
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative w-full max-w-2xl rounded-lg border"
        style={{
          backgroundColor: t.elevated,
          borderColor: t.border,
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b" style={{ borderColor: t.border }}>
          <div className="flex items-center gap-2">
            <Terminal className="w-5 h-5" style={{ color: t.accent }} />
            <h3 className="text-lg font-semibold" style={{ color: t.text }}>
              Git Operations
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

        {/* Tabs */}
        <div className="flex border-b" style={{ borderColor: t.border }}>
          {[
            { id: 'clone', label: 'Clone', icon: Download },
            { id: 'push', label: 'Push', icon: Upload },
            { id: 'pull', label: 'Pull', icon: GitPullRequest },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === tab.id ? 'border-b-2' : 'hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}
              style={{
                borderBottomColor: activeTab === tab.id ? t.accent : 'transparent',
                color: activeTab === tab.id ? t.accent : t.textMuted,
              }}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-6">
          {activeTab === 'clone' && (
            <div className="space-y-6">
              <div>
                <h4 className="text-sm font-semibold mb-3" style={{ color: t.text }}>
                  Clone this repository
                </h4>
                <div className="space-y-4">
                  {cloneCommands.map((cmd, index) => (
                    <div key={index}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium" style={{ color: t.text }}>
                          {cmd.title}
                        </span>
                        <span className="text-xs" style={{ color: t.textMuted }}>
                          {cmd.description}
                        </span>
                      </div>
                      <div className="flex">
                        <code
                          className="flex-1 px-3 py-2 text-xs rounded-l-lg border font-mono"
                          style={{
                            backgroundColor: t.surface,
                            borderColor: t.border,
                            color: t.text,
                          }}
                        >
                          {cmd.command}
                        </code>
                        <button
                          onClick={() => handleCopy(cmd.command)}
                          className="px-3 py-2 border border-l-0 rounded-r-lg transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
                          style={{
                            borderColor: t.border,
                            color: t.textMuted,
                          }}
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="text-sm font-semibold mb-3" style={{ color: t.text }}>
                  Push an existing folder from the command line
                </h4>
                <div
                  className="p-3 rounded-lg border font-mono text-xs"
                  style={{
                    backgroundColor: t.surface,
                    borderColor: t.border,
                    color: t.text,
                  }}
                >
                  {setupCommands.map((cmd, index) => (
                    <div key={index} className="mb-1">
                      {cmd}
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => handleCopy(setupCommands.join('\n'))}
                  className="mt-2 flex items-center gap-2 px-3 py-2 text-xs rounded-lg transition-colors"
                  style={{
                    backgroundColor: t.accent,
                    color: t.successText,
                  }}
                >
                  <Copy className="w-3 h-3" />
                  Copy commands
                </button>
              </div>
            </div>
          )}

          {activeTab === 'push' && (
            <div className="space-y-4">
              <div className="text-center py-8">
                <Upload className="w-16 h-16 mx-auto mb-4 opacity-40" style={{ color: t.textMuted }} />
                <h4 className="text-lg font-semibold mb-2" style={{ color: t.text }}>
                  Push Changes
                </h4>
                <p className="text-sm mb-4" style={{ color: t.textMuted }}>
                  Push your local changes to the repository. This feature is for advanced Git pack operations.
                </p>
                <div className="space-y-2 text-xs" style={{ color: t.textMuted }}>
                  <p>Use Gent CLI commands:</p>
                  <code
                    className="block p-2 rounded font-mono"
                    style={{ backgroundColor: t.surface }}
                  >
                    gent add .<br />
                    gent commit -m "Your message"<br />
                    gent push origin {defaultBranch}
                  </code>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'pull' && (
            <div className="space-y-4">
              <div className="text-center py-8">
                <GitPullRequest className="w-16 h-16 mx-auto mb-4 opacity-40" style={{ color: t.textMuted }} />
                <h4 className="text-lg font-semibold mb-2" style={{ color: t.text }}>
                  Pull Changes
                </h4>
                <p className="text-sm mb-4" style={{ color: t.textMuted }}>
                  Pull the latest changes from the repository to keep your local copy up to date.
                </p>
                <div className="space-y-2 text-xs" style={{ color: t.textMuted }}>
                  <p>Use Gent CLI commands:</p>
                  <code
                    className="block p-2 rounded font-mono"
                    style={{ backgroundColor: t.surface }}
                  >
                    gent pull origin {defaultBranch}
                  </code>
                </div>
                <button
                  onClick={() => pullRepository.mutate({ ownerId, repoName })}
                  disabled={pullRepository.isPending}
                  className="mt-4 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                  style={{
                    backgroundColor: t.accent,
                    color: t.successText,
                  }}
                >
                  {pullRepository.isPending ? 'Pulling...' : 'Pull Repository'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div 
          className="flex items-center justify-between p-4 border-t bg-gray-50 dark:bg-gray-800/50"
          style={{ borderColor: t.border }}
        >
          <div className="flex items-center gap-2 text-xs" style={{ color: t.textMuted }}>
            <CheckCircle className="w-4 h-4 text-green-500" />
            Repository URL is ready for cloning
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-lg border transition-colors"
            style={{
              borderColor: t.border,
              color: t.text,
            }}
          >
            Close
          </button>
        </div>
      </motion.div>
    </div>
  );
}
