"use client";

import { useRef } from "react";
import {
  motion,
  useScroll,
  useSpring,
  useTransform,
} from "framer-motion";
import { Boxes, GitCommit, Radar, Terminal } from "lucide-react";

const stages = [
  {
    label: "01 / LOCAL",
    title: "Your files become versioned objects",
    body: "Gent hashes staged files and commits into a local history you can inspect and move between.",
  },
  {
    label: "02 / SYNC",
    title: "One push connects every object",
    body: "The CLI sends the exact commit, tree, and blob data the Gent API understands.",
  },
  {
    label: "03 / EXPLORE",
    title: "The dashboard makes history visible",
    body: "Branches, files, commits, tags, and members become one navigable project view.",
  },
];

export default function ScrollStory() {
  const sectionRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "end start"],
  });
  const progress = useSpring(scrollYProgress, {
    stiffness: 90,
    damping: 24,
    mass: 0.45,
  });

  const sceneRotateX = useTransform(progress, [0, 0.5, 1], [14, 2, -10]);
  const sceneRotateY = useTransform(progress, [0, 0.5, 1], [-18, 12, -8]);
  const sceneScale = useTransform(progress, [0, 0.5, 1], [0.82, 1, 0.9]);
  const localY = useTransform(progress, [0, 0.45, 1], [170, 16, -95]);
  const syncY = useTransform(progress, [0, 0.55, 1], [230, 64, -55]);
  const webY = useTransform(progress, [0, 0.65, 1], [290, 112, -12]);
  const orbitRotate = useTransform(progress, [0, 1], [0, 520]);
  const firstOpacity = useTransform(progress, [0, 0.2, 0.42], [0.35, 1, 0.35]);
  const secondOpacity = useTransform(progress, [0.25, 0.5, 0.72], [0.35, 1, 0.35]);
  const thirdOpacity = useTransform(progress, [0.55, 0.78, 1], [0.35, 1, 0.55]);
  const stageOpacities = [firstOpacity, secondOpacity, thirdOpacity];

  return (
    <section ref={sectionRef} className="relative mx-auto max-w-6xl px-6 py-24 lg:h-[190vh] lg:py-0">
      <div className="grid items-center gap-16 lg:sticky lg:top-0 lg:h-screen lg:grid-cols-[0.82fr_1.18fr]">
        <div>
          <motion.p
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="font-mono text-xs uppercase tracking-[0.22em] text-brand-2"
          >
            Scroll through a commit
          </motion.p>
          <motion.h2
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.65 }}
            className="mt-4 max-w-xl font-display text-4xl font-bold tracking-tight sm:text-5xl"
          >
            One history. Three connected surfaces.
          </motion.h2>

          <div className="mt-10 space-y-3">
            {stages.map((stage, index) => (
              <motion.div
                key={stage.label}
                style={{ opacity: stageOpacities[index] }}
                className="relative border-l border-line-strong py-3 pl-5 rtl:border-l-0 rtl:border-r rtl:pl-0 rtl:pr-5"
              >
                <span className="absolute -left-[4.5px] top-5 h-2 w-2 rounded-full bg-brand-2 shadow-[0_0_14px_var(--glow-2)] rtl:-right-[4.5px] rtl:left-auto" />
                <p className="font-mono text-[10px] tracking-[0.18em] text-brand-2">
                  {stage.label}
                </p>
                <h3 className="mt-1 font-display text-lg font-semibold">{stage.title}</h3>
                <p className="mt-1 max-w-md text-sm leading-6 text-muted">{stage.body}</p>
              </motion.div>
            ))}
          </div>
        </div>

        <div className="scene relative h-[34rem] overflow-hidden rounded-[2rem] border border-line bg-surface/30 backdrop-blur-sm">
          <div className="absolute inset-0 grid-bg opacity-70" />
          <div className="absolute inset-x-12 top-1/2 h-48 -translate-y-1/2 rounded-full bg-brand/20 blur-[90px]" />

          <motion.div
            className="absolute inset-0"
            style={{
              rotateX: sceneRotateX,
              rotateY: sceneRotateY,
              scale: sceneScale,
              transformStyle: "preserve-3d",
              perspective: 1100,
            }}
          >
            <svg aria-hidden viewBox="0 0 640 520" className="absolute inset-0 h-full w-full">
              <defs>
                <linearGradient id="story-line" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="var(--brand-2)" />
                  <stop offset="0.5" stopColor="var(--brand)" />
                  <stop offset="1" stopColor="var(--brand-3)" />
                </linearGradient>
              </defs>
              <motion.path
                d="M112 370 C 210 315, 228 230, 320 252 S 445 190, 526 116"
                fill="none"
                stroke="url(#story-line)"
                strokeWidth="2"
                strokeDasharray="8 9"
                style={{ pathLength: progress }}
              />
            </svg>

            <motion.div className="absolute left-[8%] top-[10%] w-[70%]" style={{ y: localY }}>
              <div className="glass-strong rounded-2xl p-5 shadow-2xl" style={{ transform: "translateZ(150px)" }}>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 font-mono text-xs text-brand-2">
                    <Terminal className="h-4 w-4" /> local objects
                  </span>
                  <span data-no-translate className="font-mono text-[10px] text-faint">a1f9c3</span>
                </div>
                <div className="mt-4 grid grid-cols-4 gap-2">
                  {["blob", "tree", "commit", "ref"].map((item, index) => (
                    <motion.span
                      key={item}
                      animate={{ y: [0, -5, 0] }}
                      transition={{ duration: 2.6, delay: index * 0.18, repeat: Infinity }}
                      className="rounded-lg border border-line bg-bg/70 px-2 py-3 text-center font-mono text-[10px] text-muted"
                    >
                      {item}
                    </motion.span>
                  ))}
                </div>
              </div>
            </motion.div>

            <motion.div className="absolute right-[6%] top-[20%] w-[64%]" style={{ y: syncY }}>
              <div className="glass-strong rounded-2xl p-5 shadow-2xl" style={{ transform: "translateZ(80px)" }}>
                <div className="flex items-center gap-2 font-mono text-xs text-brand">
                  <Radar className="h-4 w-4" /> API sync
                </div>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-bg">
                  <motion.div
                    className="h-full rounded-full bg-gradient-to-r from-brand-2 via-brand to-brand-3"
                    style={{ scaleX: progress, transformOrigin: "left" }}
                  />
                </div>
                <p data-no-translate className="mt-3 font-mono text-[10px] text-faint">
                  POST /api/repos/1/project/push
                </p>
              </div>
            </motion.div>

            <motion.div className="absolute bottom-[4%] left-[16%] w-[72%]" style={{ y: webY }}>
              <div className="glass-strong rounded-2xl p-5 shadow-2xl" style={{ transform: "translateZ(20px)" }}>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 font-mono text-xs text-brand-3">
                    <Boxes className="h-4 w-4" /> web dashboard
                  </span>
                  <GitCommit className="h-4 w-4 text-brand-2" />
                </div>
                <div className="mt-4 grid grid-cols-[1fr_0.65fr] gap-3">
                  <div className="space-y-2">
                    {[78, 58, 86].map((width, index) => (
                      <motion.div
                        key={width}
                        initial={{ scaleX: 0 }}
                        whileInView={{ scaleX: 1 }}
                        transition={{ delay: 0.2 + index * 0.12 }}
                        className="h-2 rounded-full bg-brand/20"
                        style={{ width: `${width}%`, transformOrigin: "left" }}
                      />
                    ))}
                  </div>
                  <div className="rounded-xl border border-line bg-bg/60 p-3">
                    <div className="h-2 w-12 rounded-full bg-brand-2/40" />
                    <div className="mt-2 h-2 w-16 rounded-full bg-brand-3/30" />
                  </div>
                </div>
              </div>
            </motion.div>

            <motion.div
              className="absolute left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full border border-brand/20"
              style={{ rotate: orbitRotate, transformStyle: "preserve-3d" }}
            >
              <span className="absolute left-1/2 top-0 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-2 shadow-[0_0_18px_var(--glow-2)]" />
              <span className="absolute bottom-0 left-1/2 h-2 w-2 -translate-x-1/2 translate-y-1/2 rounded-full bg-brand-3 shadow-[0_0_16px_var(--glow)]" />
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
