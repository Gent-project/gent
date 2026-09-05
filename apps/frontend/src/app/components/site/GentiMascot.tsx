"use client";

import { motion } from "framer-motion";

export type GentiScene = "idle" | "push" | "pull" | "merge";

interface GentiMascotProps {
  className?: string;
  scene?: GentiScene;
  title?: string;
}

const BODY = "#55e6c1";
const SHADE = "#168f86";
const EYE = "#7c3aed";
const EYE_GLOW = "#c4b5fd";
const MOUTH = "#34205f";
const CRATE = "#e0b64d";
const CRATE_IN = "#b98a1f";
const BRANCH_A = "#5ac8c9";
const BRANCH_B = "#c98ad6";
const NODE = "#8ae06a";

function Pixel({ x, y, fill = BODY }: { x: number; y: number; fill?: string }) {
  return <rect x={x} y={y} width="1" height="1" fill={fill} />;
}

/**
 * Genti's browser sprite, ported from apps/Cli/src/commands/pet.js.
 * Its wide fins, single eye, and ribbon tentacles match the terminal sky-jelly.
 */
export default function GentiMascot({
  className = "",
  scene = "idle",
  title = "Genti, the one-eyed sky-jelly mascot",
}: GentiMascotProps) {
  const waving = scene !== "merge";

  return (
    <motion.svg
      data-no-translate
      role="img"
      aria-label={title}
      viewBox="0 0 24 12"
      className={className}
      shapeRendering="crispEdges"
      initial={{ opacity: 0, scale: 0.88, y: 6 }}
      animate={{ opacity: 1, scale: 1, y: [0, -2, 0] }}
      transition={{
        opacity: { duration: 0.25 },
        scale: { type: "spring", stiffness: 220, damping: 16 },
        y: { duration: 3.2, repeat: Infinity, ease: "easeInOut" },
      }}
    >
      {scene === "merge" && (
        <g opacity="0.92">
          <path d="M15 3h2l3 3h3" fill="none" stroke={BRANCH_A} strokeWidth="0.55" />
          <path d="M15 9h2l3-3" fill="none" stroke={BRANCH_B} strokeWidth="0.55" />
          <circle cx="15" cy="3" r="0.65" fill={BRANCH_A} />
          <circle cx="15" cy="9" r="0.65" fill={BRANCH_B} />
          <motion.circle
            cx="22.5"
            cy="6"
            r="0.75"
            fill={NODE}
            animate={{ opacity: [0.4, 1, 0.4], scale: [0.85, 1.15, 0.85] }}
            transition={{ duration: 1.8, repeat: Infinity }}
            style={{ transformOrigin: "22.5px 6px" }}
          />
        </g>
      )}

      {(scene === "push" || scene === "pull") && (
        <motion.g
          initial={{ x: scene === "pull" ? 2 : -2 }}
          animate={{
            x: scene === "pull" ? [2, -1, 2] : [-2, 0, -2],
            y: [0, -0.5, 0],
          }}
          transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
        >
          <rect x={scene === "pull" ? 14 : 16} y="5" width="6" height="4" rx="0.3" fill={CRATE} />
          <rect x={scene === "pull" ? 15 : 17} y="6" width="4" height="2" fill={CRATE_IN} />
          <path d={scene === "pull" ? "M14 6h6M17 5v4" : "M16 6h6M19 5v4"} stroke={CRATE} strokeWidth="0.5" />
        </motion.g>
      )}

      <motion.g
        animate={scene === "merge" ? { rotate: [-2, 2, -2] } : undefined}
        transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
        style={{ transformOrigin: "8px 6px" }}
      >
        <path d="M4 3h2V2h5v1h2v1h2v1h2v2h-2v1H2V7H0V5h2V4h2z" fill={BODY} />
        <path d="M3 7h12v1H4v1H3z" fill={SHADE} />

        <motion.g
          animate={{ scaleY: [1, 1, 1, 0.08, 1, 1] }}
          transition={{ duration: 4.2, times: [0, 0.7, 0.76, 0.78, 0.8, 1], repeat: Infinity }}
          style={{ transformOrigin: "8.5px 5.5px" }}
        >
          <rect x="7" y="5" width="3" height="2" rx="0.35" fill={EYE} />
          <Pixel x={8} y={5} fill={EYE_GLOW} />
        </motion.g>

        <rect x="7" y="7.35" width="3" height="0.5" rx="0.25" fill={MOUTH} />
        <motion.path
          d="M5 8v2M8 8v3M11 8v2"
          fill="none"
          stroke={SHADE}
          strokeWidth="1"
          animate={{ d: ["M5 8v2M8 8v3M11 8v2", "M5 8v3M8 8v2M11 8v3", "M5 8v2M8 8v3M11 8v2"] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
        />

        {waving && (
          <motion.g
            animate={{ rotate: [0, -20, 9, -20, 0] }}
            transition={{ duration: 2.6, repeat: Infinity, repeatDelay: 1.4 }}
            style={{ transformOrigin: "2px 5px" }}
          >
            <path d="M2 5H0V3h1V2h1z" fill={BODY} />
          </motion.g>
        )}
      </motion.g>
    </motion.svg>
  );
}
