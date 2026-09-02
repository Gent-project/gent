"use client";

import { motion } from "framer-motion";

export type GentiScene = "idle" | "push" | "pull" | "merge";

interface GentiMascotProps {
  className?: string;
  scene?: GentiScene;
  title?: string;
}

const BODY = "#c97b5a";
const SHADE = "#9c5a3f";
const EYE = "#15110f";
const MOUTH = "#5a2f22";
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
 * The block proportions and palette intentionally match the terminal mascot.
 */
export default function GentiMascot({
  className = "",
  scene = "idle",
  title = "Genti, the Gent mascot",
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
        animate={scene === "merge" ? { rotate: [-1.5, 1.5, -1.5] } : undefined}
        transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
        style={{ transformOrigin: "7px 7px" }}
      >
        <rect x="1" y="2" width="12" height="5" fill={BODY} />
        <rect x="1" y="7" width="12" height="1" fill={SHADE} />
        <Pixel x={0} y={4} />
        <Pixel x={13} y={4} />

        <motion.g
          animate={{ scaleY: [1, 1, 1, 0.08, 1, 1] }}
          transition={{ duration: 4.2, times: [0, 0.7, 0.76, 0.78, 0.8, 1], repeat: Infinity }}
          style={{ transformOrigin: "7px 4.5px" }}
        >
          <rect x="4" y="4" width="2" height="1" fill={EYE} />
          <rect x="9" y="4" width="2" height="1" fill={EYE} />
        </motion.g>

        <rect x="6" y="6" width="4" height="0.65" fill={MOUTH} />
        <rect x="3" y="9" width="2" height="1" fill={BODY} />
        <rect x="10" y="9" width="2" height="1" fill={BODY} />

        {waving && (
          <motion.g
            animate={{ rotate: [0, -16, 8, -16, 0] }}
            transition={{ duration: 2.6, repeat: Infinity, repeatDelay: 1.4 }}
            style={{ transformOrigin: "13px 4px" }}
          >
            <Pixel x={13} y={2} />
            <Pixel x={14} y={1} />
          </motion.g>
        )}
      </motion.g>
    </motion.svg>
  );
}
