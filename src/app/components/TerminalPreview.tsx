"use client";

import { useState } from "react";
import { motion } from "framer-motion";
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
  showTitle = true 
}: TerminalPreviewProps) {
  const isDark = useSelector((state: RootState) => state.theme.isDark);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    const commandsText = commands.map(c => c.command).join('\n');
    navigator.clipboard.writeText(commandsText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className={`relative rounded-lg overflow-hidden border shadow-lg ${
        isDark
          ? "bg-[#1e1e1e] border-[#3e3e3e]"
          : "bg-[#2d2d2d] border-[#4a4a4a]"
      }`}
    >
      {/* MacOS-style Window Header */}
      <div className={`flex items-center justify-between px-4 py-3 border-b ${
        isDark ? "bg-[#2d2d2d] border-[#3e3e3e]" : "bg-[#3a3a3a] border-[#4a4a4a]"
      }`}>
        {/* Traffic Lights */}
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-[#ff5f57] hover:bg-[#ff5f57]/80 transition-colors cursor-pointer" />
          <div className="w-3 h-3 rounded-full bg-[#febc2e] hover:bg-[#febc2e]/80 transition-colors cursor-pointer" />
          <div className="w-3 h-3 rounded-full bg-[#28c840] hover:bg-[#28c840]/80 transition-colors cursor-pointer" />
        </div>

        {/* Title */}
        {showTitle && (
          <div className="absolute left-1/2 -translate-x-1/2 text-sm font-medium text-white/60">
            {title}
          </div>
        )}

        {/* Copy Button */}
        <button
          onClick={handleCopy}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-all ${
            copied
              ? "bg-green-500/20 text-green-400"
              : "bg-white/10 text-white/70 hover:bg-white/20 hover:text-white"
          }`}
        >
          {copied ? (
            <>
              <Check className="w-3 h-3" />
              Copied
            </>
          ) : (
            <>
              <Copy className="w-3 h-3" />
              Copy
            </>
          )}
        </button>
      </div>

      {/* Terminal Content */}
      <div className="p-4 font-mono text-sm overflow-x-auto">
        <div className="space-y-2">
          {commands.map((cmd, index) => (
            <div key={index}>
              {/* Comment */}
              {cmd.comment && (
                <div className="text-[#6a9955] mb-1">
                  # {cmd.comment}
                </div>
              )}
              
              {/* Command Line */}
              <div className="flex items-start gap-2">
                {/* Prompt */}
                <span className="text-[#4ec9b0] select-none flex-shrink-0">
                  $
                </span>
                
                {/* Command */}
                <span className="text-[#dcdcdc] break-all">
                  {cmd.command.split(' ').map((word, i) => {
                    // Git command highlighting
                    if (i === 0 && word === 'git') {
                      return <span key={i} className="text-[#c586c0]">git </span>;
                    }
                    // Git subcommands
                    if (i === 1 && commands[index].command.startsWith('git')) {
                      return <span key={i} className="text-[#569cd6]">{word} </span>;
                    }
                    // Flags (starting with -)
                    if (word.startsWith('-')) {
                      return <span key={i} className="text-[#ce9178]">{word} </span>;
                    }
                    // Strings in quotes
                    if (word.startsWith('"') || word.startsWith("'")) {
                      return <span key={i} className="text-[#ce9178]">{word} </span>;
                    }
                    return <span key={i}>{word} </span>;
                  })}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Blinking Cursor */}
        <div className="flex items-center gap-2 mt-3">
          <span className="text-[#4ec9b0]">$</span>
          <motion.div
            className="w-2 h-4 bg-white/70"
            animate={{ opacity: [1, 0, 1] }}
            transition={{ duration: 1.2, repeat: Infinity }}
          />
        </div>
      </div>
    </motion.div>
  );
}
