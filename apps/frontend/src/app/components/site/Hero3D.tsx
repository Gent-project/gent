"use client";

import { useRef } from "react";
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  type MotionValue,
} from "framer-motion";
import {
  CheckCircle2,
  Cloud,
  FileCode2,
  Folder,
  GitBranch,
  GitCommit,
  GitPullRequest,
  Tag,
} from "lucide-react";
import AnimatedTerminal from "./AnimatedTerminal";
import GentiMascot from "./GentiMascot";

const repositoryRows = [
  { name: "src", icon: Folder, tone: "text-brand-2" },
  { name: "app", icon: Folder, tone: "text-brand-2" },
  { name: "package.json", icon: FileCode2, tone: "text-brand-3" },
  { name: "README.md", icon: FileCode2, tone: "text-faint" },
];

function RepositoryPanel() {
  return (
    <div data-no-translate className="overflow-hidden rounded-2xl border border-line-strong bg-surface/90 shadow-2xl backdrop-blur-2xl">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <span className="flex items-center gap-2 font-mono text-[10px] text-faint">
          <GitBranch className="h-3.5 w-3.5 text-brand" /> gent / web
        </span>
        <span className="rounded-md bg-brand/10 px-2 py-1 font-mono text-[9px] text-brand">main</span>
      </div>
      <div className="flex items-center justify-between border-b border-line bg-bg/45 px-4 py-2.5">
        <span className="flex items-center gap-2 text-[10px] text-muted"><GitCommit className="h-3.5 w-3.5 text-brand-2" /> refine dashboard experience</span>
        <span className="font-mono text-[9px] text-brand-2">a1f9c3</span>
      </div>
      <div className="divide-y divide-line px-2 py-1.5">
        {repositoryRows.map((row, index) => (
          <motion.div key={row.name} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.45 + index * 0.08 }} className="flex items-center justify-between rounded-lg px-2 py-2 text-[11px] text-fg">
            <span className="flex items-center gap-2.5"><row.icon className={`h-3.5 w-3.5 ${row.tone}`} />{row.name}</span>
            <span className="font-mono text-[8px] text-faint">{index < 2 ? "tree" : "blob"}</span>
          </motion.div>
        ))}
      </div>
      <div className="flex items-center justify-between border-t border-line px-4 py-2.5 font-mono text-[9px] text-faint">
        <span>12 files</span>
        <span className="flex items-center gap-1.5 text-brand-2"><CheckCircle2 className="h-3 w-3" /> synced</span>
      </div>
    </div>
  );
}

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
      className="relative h-[32rem] w-full sm:h-[36rem]"
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

        {/* repository browser — rear product plane */}
        <Layer z={-5} mx={mx} my={my} className="left-[58%] top-[42%] w-[18rem] sm:w-[21rem]">
          <div className="-translate-x-1/2 -translate-y-1/2 rotate-[2deg]">
            <RepositoryPanel />
          </div>
        </Layer>

        {/* CLI terminal — foreground product plane */}
        <Layer z={85} mx={mx} my={my} className="left-[39%] top-[61%] w-[19rem] sm:w-[22rem]">
          <div className="-translate-x-1/2 -translate-y-1/2 -rotate-[3deg] scale-[0.82] sm:scale-[0.88]">
            <AnimatedTerminal />
          </div>
        </Layer>

        {/* floating labeled commit nodes at varied depth */}
        <Layer z={145} mx={mx} my={my} float className="left-1 top-14 sm:left-3">
          <div className="glass-strong glow-ring flex items-center gap-2 rounded-xl px-3 py-2">
            <GitCommit className="h-4 w-4 text-brand" />
            <span className="font-mono text-xs text-fg">main ✓ synced</span>
          </div>
        </Layer>

        <Layer z={190} mx={mx} my={my} float className="right-0 top-5 delay-1">
          <div className="flex items-center gap-1.5 rounded-full bg-brand px-3 py-1 text-brand-ink shadow-lg shadow-brand/30">
            <Tag className="h-3.5 w-3.5" />
            <span className="font-mono text-xs font-bold">v11.0.0</span>
          </div>
        </Layer>

        <Layer z={125} mx={mx} my={my} float className="bottom-12 right-0 delay-2">
          <div className="glass-strong flex items-center gap-2 rounded-xl px-3 py-2">
            <GitPullRequest className="h-4 w-4 text-brand-3" />
            <span className="font-mono text-xs text-fg">feat/auth → main</span>
          </div>
        </Layer>

        <Layer z={165} mx={mx} my={my} float className="bottom-8 left-3 delay-1">
          <div className="glass-strong flex items-center gap-2 rounded-lg px-2.5 py-1.5">
            <Cloud className="h-3.5 w-3.5 text-brand-2" />
            <span className="font-mono text-[11px] text-brand-2">origin/main</span>
          </div>
        </Layer>

        {/* Genti — the same pixel mascot that celebrates successful CLI workflows. */}
        <Layer z={235} mx={mx} my={my} className="bottom-20 right-1 sm:bottom-24 sm:right-5">
          <motion.div
            initial={{ opacity: 0, x: 16, rotate: 3 }}
            animate={{ opacity: 1, x: 0, rotate: 1 }}
            transition={{ delay: 0.9, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="glass-strong glow-ring flex items-center gap-2.5 rounded-2xl p-2.5 pe-3 shadow-xl"
          >
            <GentiMascot scene="push" className="h-[58px] w-[116px] shrink-0" />
            <div className="hidden min-w-0 sm:block">
              <p className="text-[11px] font-semibold leading-tight text-fg">Genti is shipping it.</p>
              <p data-no-translate className="mt-1 font-mono text-[9px] text-brand-2">$ gent push</p>
            </div>
          </motion.div>
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
