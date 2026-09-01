"use client";

import { useRef } from "react";
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  type MotionValue,
} from "framer-motion";
import { GitCommit, GitPullRequest, Tag } from "lucide-react";
import AnimatedTerminal from "./AnimatedTerminal";

/** A layer that parallaxes by its depth: deeper Z → travels further with the pointer. */
function Layer({
  z,
  mx,
  my,
  className = "",
  children,
  float,
}: {
  z: number;
  mx: MotionValue<number>;
  my: MotionValue<number>;
  className?: string;
  children?: React.ReactNode;
  float?: boolean;
}) {
  // pointer travel scales with depth
  const tx = useTransform(mx, (v) => v * (z / 6));
  const ty = useTransform(my, (v) => v * (z / 6));
  return (
    <motion.div
      style={{ x: tx, y: ty, translateZ: z, transformStyle: "preserve-3d" }}
      className={`absolute ${float ? "anim-float" : ""} ${className}`}
    >
      {children}
    </motion.div>
  );
}

export default function Hero3D() {
  const ref = useRef<HTMLDivElement>(null);
  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);

  const mx = useSpring(rawX, { stiffness: 120, damping: 18 });
  const my = useSpring(rawY, { stiffness: 120, damping: 18 });

  const rotY = useSpring(useTransform(rawX, [-1, 1], [16, -16]), {
    stiffness: 120,
    damping: 18,
  });
  const rotX = useSpring(useTransform(rawY, [-1, 1], [-14, 14]), {
    stiffness: 120,
    damping: 18,
  });

  function onMove(e: React.PointerEvent<HTMLDivElement>) {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    rawX.set(((e.clientX - r.left) / r.width - 0.5) * 2);
    rawY.set(((e.clientY - r.top) / r.height - 0.5) * 2);
  }
  function onLeave() {
    rawX.set(0);
    rawY.set(0);
  }

  return (
    <div
      ref={ref}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      className="relative h-[30rem] w-full sm:h-[34rem]"
      style={{ perspective: "1200px" }}
    >
      <motion.div
        style={{ rotateX: rotX, rotateY: rotY, transformStyle: "preserve-3d" }}
        className="absolute inset-0 flex items-center justify-center"
      >
        {/* deep glow plane */}
        <Layer z={-160} mx={mx} my={my} className="left-1/2 top-1/2">
          <div
            className="anim-pulse-glow h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
            style={{ background: "var(--glow)" }}
          />
        </Layer>

        {/* connective SVG constellation (mid-depth) */}
        <Layer z={-40} mx={mx} my={my} className="left-1/2 top-1/2">
          <svg
            width="520"
            height="440"
            viewBox="0 0 520 440"
            className="-translate-x-1/2 -translate-y-1/2 opacity-70"
            fill="none"
          >
            <defs>
              <linearGradient id="h3d" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="var(--brand)" />
                <stop offset="1" stopColor="var(--brand-3)" />
              </linearGradient>
            </defs>
            {[
              "M90 360 L90 120",
              "M90 200 C 200 200, 250 150, 360 90",
              "M90 120 C 200 120, 320 120, 430 200",
              "M360 90 L430 200",
            ].map((d, i) => (
              <motion.path
                key={i}
                d={d}
                stroke="url(#h3d)"
                strokeWidth="1.5"
                strokeLinecap="round"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 0.8 }}
                transition={{ duration: 1.4, delay: 0.3 + i * 0.2, ease: "easeInOut" }}
              />
            ))}
            {[
              [90, 360],
              [90, 200],
              [90, 120],
              [360, 90],
              [430, 200],
            ].map(([cx, cy], i) => (
              <motion.circle
                key={i}
                cx={cx}
                cy={cy}
                r="5"
                fill="var(--brand)"
                initial={{ scale: 0 }}
                animate={{ scale: [0, 1.3, 1] }}
                transition={{ delay: 0.6 + i * 0.18, duration: 0.6 }}
                style={{ transformOrigin: `${cx}px ${cy}px` }}
              />
            ))}
          </svg>
        </Layer>

        {/* the terminal — the anchor plane */}
        <Layer z={10} mx={mx} my={my} className="left-1/2 top-1/2 w-[22rem] sm:w-[26rem]">
          <div className="-translate-x-1/2 -translate-y-1/2">
            <AnimatedTerminal />
          </div>
        </Layer>

        {/* floating labeled commit nodes at varied depth */}
        <Layer z={120} mx={mx} my={my} float className="left-2 top-10">
          <div className="glass-strong glow-ring flex items-center gap-2 rounded-xl px-3 py-2">
            <GitCommit className="h-4 w-4 text-brand" />
            <span className="font-mono text-xs text-fg">main ✓ synced</span>
          </div>
        </Layer>

        <Layer z={170} mx={mx} my={my} float className="right-0 top-4 delay-1">
          <div className="flex items-center gap-1.5 rounded-full bg-brand px-3 py-1 text-brand-ink shadow-lg shadow-brand/30">
            <Tag className="h-3.5 w-3.5" />
            <span className="font-mono text-xs font-bold">v11.0.0</span>
          </div>
        </Layer>

        <Layer z={90} mx={mx} my={my} float className="bottom-10 right-2 delay-2">
          <div className="glass-strong flex items-center gap-2 rounded-xl px-3 py-2">
            <GitPullRequest className="h-4 w-4 text-brand-3" />
            <span className="font-mono text-xs text-fg">feat/auth → main</span>
          </div>
        </Layer>

        <Layer z={150} mx={mx} my={my} float className="bottom-6 left-6 delay-1">
          <div className="glass-strong rounded-lg px-2.5 py-1.5">
            <span className="font-mono text-[11px] text-brand-2">a1f9c3</span>
          </div>
        </Layer>

        {/* tiny depth particles */}
        {[
          { z: 60, cls: "left-10 top-1/2" },
          { z: 200, cls: "right-16 top-1/3 delay-2" },
          { z: 40, cls: "left-1/3 bottom-4 delay-1" },
        ].map((p, i) => (
          <Layer key={i} z={p.z} mx={mx} my={my} float className={p.cls}>
            <span className="block h-2 w-2 rounded-full bg-brand shadow-[0_0_12px_var(--glow)]" />
          </Layer>
        ))}
      </motion.div>
    </div>
  );
}
