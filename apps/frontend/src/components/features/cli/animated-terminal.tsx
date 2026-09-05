"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";

import { cn } from "@/lib/utils";

/**
 * AnimatedTerminal — types a sequence of commands character-by-character.
 *
 * Used on the CLI explorer page and the marketing hero. The animation is
 * driven by a state machine over `script` (a list of lines). Each line is
 * either a typed command (starts with `$`) or a non-typed output line.
 *
 * @example
 *   <AnimatedTerminal
 *     script={[
 *       { type: "cmd", text: "gent init" },
 *       { type: "out", text: "Initialised empty repository in .gent/" },
 *     ]}
 *   />
 */
export interface TerminalLine {
  type: "cmd" | "out";
  text: string;
  className?: string;
}

export function AnimatedTerminal({
  script,
  speed = 32,
  className,
  loop = true,
}: {
  script: TerminalLine[];
  speed?: number;
  className?: string;
  loop?: boolean;
}) {
  const [lineIndex, setLineIndex] = useState(0);
  const [charIndex, setCharIndex] = useState(0);

  useEffect(() => {
    if (lineIndex >= script.length) {
      if (!loop) return;
      const restart = setTimeout(() => {
        setLineIndex(0);
        setCharIndex(0);
      }, 2500);
      return () => clearTimeout(restart);
    }
    const line = script[lineIndex];
    if (line.type === "out") {
      const t = setTimeout(() => {
        setLineIndex((i) => i + 1);
        setCharIndex(0);
      }, 350);
      return () => clearTimeout(t);
    }
    if (charIndex < line.text.length) {
      const t = setTimeout(() => setCharIndex((i) => i + 1), speed);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => {
      setLineIndex((i) => i + 1);
      setCharIndex(0);
    }, 700);
    return () => clearTimeout(t);
  }, [lineIndex, charIndex, script, speed, loop]);

  return (
    <div
      className={cn(
        "rounded-2xl border border-outline-variant bg-inverse-surface text-on-inverse-surface",
        "shadow-soft overflow-hidden",
        className,
      )}
    >
      {/* macOS-style traffic lights */}
      <div className="flex items-center gap-2 border-b border-on-inverse-surface/10 px-4 py-2.5">
        <span className="size-2.5 rounded-full bg-error/80" />
        <span className="size-2.5 rounded-full bg-tertiary/80" />
        <span className="size-2.5 rounded-full bg-secondary/80" />
        <span className="ml-3 text-xs text-on-inverse-surface/60 font-mono">
          gent — zsh
        </span>
      </div>

      <pre className="font-mono text-sm leading-relaxed p-5 min-h-[260px]">
        {script.slice(0, lineIndex).map((line, i) => (
          <Line key={i} line={line} done />
        ))}
        {lineIndex < script.length && (
          <Line line={script[lineIndex]} done={false} typedChars={charIndex} />
        )}
      </pre>
    </div>
  );
}

function Line({
  line,
  done,
  typedChars,
}: {
  line: TerminalLine;
  done: boolean;
  typedChars?: number;
}) {
  const text = done ? line.text : line.text.slice(0, typedChars);
  if (line.type === "cmd") {
    return (
      <div>
        <span className="text-primary">$</span>{" "}
        <span className={cn("text-on-inverse-surface", line.className)}>{text}</span>
        {!done && (
          <motion.span
            animate={{ opacity: [1, 0, 1] }}
            transition={{ repeat: Infinity, duration: 1 }}
            className="inline-block w-1.5 h-4 align-[-2px] ml-0.5 bg-on-inverse-surface"
          />
        )}
      </div>
    );
  }
  return (
    <div className={cn("text-on-inverse-surface/80", line.className)}>{text}</div>
  );
}
