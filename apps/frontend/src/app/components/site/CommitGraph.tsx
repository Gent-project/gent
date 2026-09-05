"use client";

import { motion } from "framer-motion";

/**
 * A compact git DAG that draws its branches, then pulses its commit nodes.
 * Used as a floating 3D layer in the hero.
 */
const nodes = [
  { cx: 30, cy: 150, r: 6, d: 0.2 },
  { cx: 30, cy: 110, r: 6, d: 0.5 },
  { cx: 30, cy: 70, r: 6, d: 0.8 },
  { cx: 90, cy: 70, r: 6, d: 1.2 }, // branch off
  { cx: 90, cy: 34, r: 6, d: 1.5 },
  { cx: 30, cy: 30, r: 7, d: 1.9 }, // merge target (HEAD)
];

export default function CommitGraph() {
  return (
    <svg
      viewBox="0 0 130 180"
      className="h-full w-full"
      fill="none"
      aria-hidden
    >
      <defs>
        <linearGradient id="cg-line" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="var(--brand)" />
          <stop offset="1" stopColor="var(--brand-3)" />
        </linearGradient>
      </defs>

      {/* main trunk */}
      <motion.path
        d="M30 150 L30 30"
        stroke="url(#cg-line)"
        strokeWidth="2.5"
        strokeLinecap="round"
        initial={{ pathLength: 0 }}
        whileInView={{ pathLength: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 1.2, ease: "easeInOut" }}
      />
      {/* feature branch out + merge back */}
      <motion.path
        d="M30 70 C 70 70, 90 60, 90 34 C 90 34, 60 30, 30 30"
        stroke="var(--brand-2)"
        strokeWidth="2.5"
        strokeLinecap="round"
        initial={{ pathLength: 0 }}
        whileInView={{ pathLength: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 1.3, delay: 0.5, ease: "easeInOut" }}
      />

      {nodes.map((n, i) => (
        <g key={i}>
          <motion.circle
            cx={n.cx}
            cy={n.cy}
            r={n.r + 5}
            fill="var(--brand)"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: [0, 0.25, 0.1] }}
            viewport={{ once: true }}
            transition={{
              duration: 2.4,
              delay: n.d,
              repeat: Infinity,
              repeatType: "reverse",
            }}
          />
          <motion.circle
            cx={n.cx}
            cy={n.cy}
            r={n.r}
            fill="var(--bg)"
            stroke="url(#cg-line)"
            strokeWidth="2.5"
            initial={{ scale: 0, opacity: 0 }}
            whileInView={{ scale: 1, opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: n.d, type: "spring", stiffness: 300 }}
            style={{ transformOrigin: `${n.cx}px ${n.cy}px` }}
          />
        </g>
      ))}
    </svg>
  );
}
