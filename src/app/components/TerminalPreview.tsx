"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Copy, Check } from "lucide-react";
import { useSelector } from "react-redux";
import { RootState } from "@/store";

interface TerminalCommand {
  command: string;
  comment?: string;
}

interface TerminalPreviewProps {
  title?: string;
  commands: TerminalCommand[];
  showTitle?: boolean;
}

export default function TerminalPreview({
  title = "Terminal",
  commands,
  showTitle = true,
}: TerminalPreviewProps) {
  const isDark = useSelector((state: RootState) => state.theme.isDark);
  const [copied, setCopied] = useState(false);
  const [visibleCommands, setVisibleCommands] = useState<number[]>([]);

  // Animate commands appearance
  useEffect(() => {
    commands.forEach((_, index) => {
      setTimeout(() => {
        setVisibleCommands((prev) => [...prev, index]);
      }, index * 400);
    });
  }, [commands]);

  const handleCopy = () => {
    const commandsText = commands.map((c) => c.command).join("\n");
    navigator.clipboard.writeText(commandsText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className={`relative rounded-xl overflow-hidden shadow-2xl ${
        isDark
          ? "bg-gradient-to-br from-[#0f1419] to-[#1a1f2e] border-2 border-[#7dd3fc]/20"
          : "bg-gradient-to-br from-[#5A7863] to-[#4a6853] border-2 border-white/20"
      }`}
    >
      {/* Glow Effect */}
      <div
        className={`absolute inset-0 opacity-50 blur-2xl ${
          isDark
            ? "bg-gradient-to-r from-[#7dd3fc]/10 via-[#06b6d4]/10 to-transparent"
            : "bg-gradient-to-r from-white/10 via-white/5 to-transparent"
        }`}
      />

      {/* MacOS-style Window Header */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className={`relative flex items-center justify-between px-4 py-3 backdrop-blur-sm ${
          isDark
            ? "bg-[#0f1419]/80 border-b border-[#7dd3fc]/10"
            : "bg-[#4a6853]/80 border-b border-white/10"
        }`}
      >
        {/* Traffic Lights */}
        <div className="flex items-center gap-2">
          <motion.div
            className="w-3 h-3 rounded-full bg-[#ff5f57] hover:bg-[#ff5f57]/80 transition-colors cursor-pointer"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
          />
          <motion.div
            className="w-3 h-3 rounded-full bg-[#febc2e] hover:bg-[#febc2e]/80 transition-colors cursor-pointer"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
          />
          <motion.div
            className="w-3 h-3 rounded-full bg-[#28c840] hover:bg-[#28c840]/80 transition-colors cursor-pointer"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
          />
        </div>

        {/* Title */}
        {showTitle && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className={`absolute left-1/2 -translate-x-1/2 text-sm font-medium ${
              isDark ? "text-[#7dd3fc]" : "text-white"
            }`}
          >
            {title}
          </motion.div>
        )}

        {/* Copy Button */}
        <motion.button
          onClick={handleCopy}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
            copied
              ? isDark
                ? "bg-[#28c840]/20 text-[#28c840]"
                : "bg-white/30 text-white"
              : isDark
                ? "bg-[#7dd3fc]/10 text-[#7dd3fc] hover:bg-[#7dd3fc]/20"
                : "bg-white/10 text-white hover:bg-white/20"
          }`}
        >
          <AnimatePresence mode="wait">
            {copied ? (
              <motion.div
                key="check"
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                exit={{ scale: 0, rotate: 180 }}
                className="flex items-center gap-1.5"
              >
                <Check className="w-3 h-3" />
                Copied
              </motion.div>
            ) : (
              <motion.div
                key="copy"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                className="flex items-center gap-1.5"
              >
                <Copy className="w-3 h-3" />
                Copy
              </motion.div>
            )}
          </AnimatePresence>
        </motion.button>
      </motion.div>

      {/* Terminal Content */}
      <div className="relative p-4 sm:p-6 font-mono text-sm overflow-x-auto">
        <div className="space-y-3">
          <AnimatePresence>
            {commands.map(
              (cmd, index) =>
                visibleCommands.includes(index) && (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{
                      duration: 0.4,
                      ease: [0.22, 1, 0.36, 1],
                    }}
                  >
                    {/* Comment */}
                    {cmd.comment && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.1 }}
                        className={`mb-1.5 text-xs sm:text-sm ${
                          isDark ? "text-[#7dd3fc]/60" : "text-white/60"
                        }`}
                      >
                        # {cmd.comment}
                      </motion.div>
                    )}

                    {/* Command Line */}
                    <div className="flex items-start gap-2 sm:gap-3">
                      {/* Prompt */}
                      <motion.span
                        className={`select-none flex-shrink-0 font-bold ${
                          isDark ? "text-[#06b6d4]" : "text-[#7dd3fc]"
                        }`}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.15 }}
                      >
                        $
                      </motion.span>

                      {/* Command */}
                      <span
                        className={`break-all text-xs sm:text-sm ${
                          isDark ? "text-white" : "text-white/90"
                        }`}
                      >
                        {cmd.command.split(" ").map((word, i) => {
                          // Git command highlighting
                          if (i === 0 && word === "git") {
                            return (
                              <motion.span
                                key={i}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.2 + i * 0.05 }}
                                className={
                                  isDark
                                    ? "text-[#7dd3fc] font-semibold"
                                    : "text-white font-semibold"
                                }
                              >
                                git{" "}
                              </motion.span>
                            );
                          }
                          // Git subcommands
                          if (
                            i === 1 &&
                            commands[index].command.startsWith("git")
                          ) {
                            return (
                              <motion.span
                                key={i}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.2 + i * 0.05 }}
                                className={
                                  isDark
                                    ? "text-[#06b6d4] font-semibold"
                                    : "text-[#7dd3fc] font-semibold"
                                }
                              >
                                {word}{" "}
                              </motion.span>
                            );
                          }
                          // Flags (starting with -)
                          if (word.startsWith("-")) {
                            return (
                              <motion.span
                                key={i}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.2 + i * 0.05 }}
                                className={
                                  isDark ? "text-[#7dd3fc]/80" : "text-white/70"
                                }
                              >
                                {word}{" "}
                              </motion.span>
                            );
                          }
                          // Strings in quotes
                          if (word.startsWith('"') || word.startsWith("'")) {
                            return (
                              <motion.span
                                key={i}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.2 + i * 0.05 }}
                                className={
                                  isDark ? "text-[#28c840]" : "text-[#dcfce7]"
                                }
                              >
                                {word}{" "}
                              </motion.span>
                            );
                          }
                          return (
                            <motion.span
                              key={i}
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              transition={{ delay: 0.2 + i * 0.05 }}
                            >
                              {word}{" "}
                            </motion.span>
                          );
                        })}
                      </span>
                    </div>
                  </motion.div>
                ),
            )}
          </AnimatePresence>

          {/* Blinking Cursor */}
          {visibleCommands.length === commands.length && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="flex items-center gap-2 sm:gap-3 mt-4"
            >
              <span
                className={`font-bold ${
                  isDark ? "text-[#06b6d4]" : "text-[#7dd3fc]"
                }`}
              >
                $
              </span>
              <motion.div
                className={`w-2 h-4 ${isDark ? "bg-[#7dd3fc]" : "bg-white"}`}
                animate={{
                  opacity: [1, 0, 1],
                  scale: [1, 0.95, 1],
                }}
                transition={{
                  duration: 1.2,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              />
            </motion.div>
          )}
        </div>
      </div>

      {/* Bottom Glow */}
      <div
        className={`absolute bottom-0 left-0 right-0 h-px ${
          isDark
            ? "bg-gradient-to-r from-transparent via-[#7dd3fc] to-transparent"
            : "bg-gradient-to-r from-transparent via-white to-transparent"
        }`}
      />
    </motion.div>
  );
}
