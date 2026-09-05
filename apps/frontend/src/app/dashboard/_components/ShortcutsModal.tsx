"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Keyboard, Command, Zap } from "lucide-react";
import { getDashboardTheme } from "./dashboard-theme";
import { useSelector } from "react-redux";
import { RootState } from "@/store";

interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ShortcutsModal({ isOpen, onClose }: ShortcutsModalProps) {
  const isDark = useSelector((state: RootState) => state.theme.isDark);
  const t = getDashboardTheme(isDark);

  const shortcuts = [
    {
      category: "General",
      icon: <Zap className="w-4 h-4" />,
      items: [
        { keys: ["Ctrl", "N"], description: "Create new repository" },
        { keys: ["Ctrl", "Shift", "R"], description: "Refresh repositories" },
        { keys: ["Ctrl", "D"], description: "Toggle dark/light theme" },
        { keys: ["/"], description: "Focus search bar" },
      ]
    },
    {
      category: "Navigation",
      icon: <Command className="w-4 h-4" />,
      items: [
        { keys: ["Ctrl", "1"], description: "Go to Dashboard" },
        { keys: ["Ctrl", "2"], description: "Go to Settings" },
        { keys: ["Escape"], description: "Close modal/dialog" },
        { keys: ["Tab"], description: "Navigate between elements" },
      ]
    },
    {
      category: "Repository",
      icon: <Keyboard className="w-4 h-4" />,
      items: [
        { keys: ["Enter"], description: "Open selected repository" },
        { keys: ["Ctrl", "Enter"], description: "Open repository in new tab" },
        { keys: ["Delete"], description: "Delete repository (with confirmation)" },
        { keys: ["Ctrl", "E"], description: "Edit repository settings" },
      ]
    }
  ];

  const KeyBadge = ({ keyName }: { keyName: string }) => (
    <kbd 
      className="px-2 py-1 text-xs font-mono rounded border shadow-sm"
      style={{
        backgroundColor: t.surface,
        borderColor: t.border,
        color: t.textSecondary,
      }}
    >
      {keyName}
    </kbd>
  );

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50" 
          onClick={onClose} 
        />
        
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-2xl rounded-lg border shadow-xl"
          style={{
            backgroundColor: t.elevated,
            borderColor: t.border,
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b" style={{ borderColor: t.border }}>
            <div className="flex items-center gap-3">
              <Keyboard className="w-6 h-6" style={{ color: t.accent }} />
              <div>
                <h3 className="text-lg font-semibold" style={{ color: t.text }}>
                  Keyboard Shortcuts
                </h3>
                <p className="text-sm" style={{ color: t.textMuted }}>
                  Speed up your workflow with these shortcuts
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
              style={{ color: t.textMuted }}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 max-h-96 overflow-y-auto">
            <div className="space-y-6">
              {shortcuts.map((section, index) => (
                <motion.div
                  key={section.category}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <div style={{ color: t.accent }}>
                      {section.icon}
                    </div>
                    <h4 className="font-semibold text-sm" style={{ color: t.text }}>
                      {section.category}
                    </h4>
                  </div>
                  
                  <div className="space-y-2 ml-6">
                    {section.items.map((shortcut, shortcutIndex) => (
                      <div key={shortcutIndex} className="flex items-center justify-between py-2">
                        <span className="text-sm" style={{ color: t.textMuted }}>
                          {shortcut.description}
                        </span>
                        <div className="flex items-center gap-1">
                          {shortcut.keys.map((key, keyIndex) => (
                            <div key={keyIndex} className="flex items-center gap-1">
                              <KeyBadge keyName={key} />
                              {keyIndex < shortcut.keys.length - 1 && (
                                <span className="text-xs" style={{ color: t.textMuted }}>
                                  +
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div 
            className="flex items-center justify-between p-6 border-t"
            style={{ borderColor: t.border }}
          >
            <div className="text-xs" style={{ color: t.textMuted }}>
              Press <KeyBadge keyName="?" /> anytime to open this dialog
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
    </AnimatePresence>
  );
}