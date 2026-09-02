"use client";

import { motion } from "framer-motion";
import { GitBranch, GitCommit, GitMerge } from "lucide-react";
import { getDashboardTheme } from "./dashboard-theme";
import GentiMascot from "@/app/components/site/GentiMascot";

export default function WorkspacePulse({ isDark }: { isDark: boolean }) {
  const t = getDashboardTheme(isDark);

  return (
    <motion.div
      whileHover={{ rotateX: 2, rotateY: -3, y: -2 }}
      transition={{ type: "spring", stiffness: 180, damping: 18 }}
      className="scene relative hidden h-36 w-[360px] shrink-0 overflow-hidden rounded-2xl border xl:block"
      style={{
        borderColor: t.border,
        background: t.surface,
        boxShadow: t.shadow,
        transformStyle: "preserve-3d",
      }}
      aria-hidden
    >
      <div className="grid-bg absolute inset-0 opacity-35" />
      <div className="absolute -right-6 -top-12 h-40 w-40 rounded-full blur-3xl" style={{ background: `${t.accentHover}20` }} />
      <div className="absolute -bottom-16 left-12 h-36 w-36 rounded-full blur-3xl" style={{ background: `${t.accentTertiary}18` }} />

      <svg viewBox="0 0 360 144" className="absolute inset-0 h-full w-full" fill="none">
        <defs>
          <linearGradient id="workspace-pulse" x1="48" y1="120" x2="312" y2="28" gradientUnits="userSpaceOnUse">
            <stop stopColor={t.accent} />
            <stop offset=".55" stopColor={t.accentHover} />
            <stop offset="1" stopColor={t.accentTertiary} />
          </linearGradient>
        </defs>
        <motion.path d="M42 112V54C42 40 54 32 69 32h73c19 0 21 31 42 31h105" stroke="url(#workspace-pulse)" strokeWidth="2" strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.2, ease: "easeOut" }} />
        <motion.path d="M42 86h91c18 0 24 30 44 30h138" stroke="url(#workspace-pulse)" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="5 7" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.4, delay: 0.15 }} />
      </svg>

      {[
        { x: 42, y: 112, color: t.accent, delay: 0 },
        { x: 42, y: 54, color: t.accent, delay: 0.12 },
        { x: 184, y: 63, color: t.accentHover, delay: 0.24 },
        { x: 289, y: 63, color: t.accentTertiary, delay: 0.36 },
        { x: 177, y: 116, color: t.accentHover, delay: 0.48 },
        { x: 315, y: 116, color: t.accent, delay: 0.6 },
      ].map((node) => (
        <motion.span key={`${node.x}-${node.y}`} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: node.delay, type: "spring" }} className="absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2" style={{ left: node.x, top: node.y, borderColor: node.color, background: t.elevated, boxShadow: `0 0 14px ${node.color}` }} />
      ))}

      <div className="absolute left-5 top-3 flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.16em]" style={{ color: t.textMuted }}>
        <GitBranch className="h-3 w-3" style={{ color: t.accent }} /> live branch topology
      </div>
      <motion.div animate={{ y: [0, -4, 0] }} transition={{ duration: 3.2, repeat: Infinity }} className="absolute bottom-3 right-4 flex items-center gap-2 rounded-lg border px-2.5 py-1.5 font-mono text-[9px]" style={{ borderColor: t.border, background: t.elevated, color: t.textSecondary }}>
        <GitMerge className="h-3 w-3" style={{ color: t.accentHover }} /> main synced
      </motion.div>
      <div className="absolute -bottom-1 left-0 flex items-end" title="Genti watches your branches">
        <GentiMascot scene="merge" className="h-[58px] w-[116px]" />
        <span className="mb-3 -ml-3 rounded-md border px-2 py-1 font-mono text-[8px]" style={{ borderColor: t.border, background: t.elevated, color: t.textSecondary }}>
          Genti on watch
        </span>
      </div>
      <div className="absolute left-20 top-[68px] flex items-center gap-1.5 rounded-md px-2 py-1 font-mono text-[8px]" style={{ background: t.accentMuted, color: t.accent }}>
        <GitCommit className="h-2.5 w-2.5" /> a1f9c3
      </div>
    </motion.div>
  );
}
