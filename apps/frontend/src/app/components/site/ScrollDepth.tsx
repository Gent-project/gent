"use client";

import {
  motion,
  useScroll,
  useSpring,
  useTransform,
} from "framer-motion";

/**
 * A restrained scroll-linked 3D marker shared by marketing pages. It turns
 * page progress into depth, rotation, and a luminous vertical trail.
 */
export default function ScrollDepth() {
  const { scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, {
    stiffness: 90,
    damping: 24,
    mass: 0.45,
  });
  const y = useTransform(progress, [0, 1], [0, 420]);
  const rotateX = useTransform(progress, [0, 1], [18, 738]);
  const rotateY = useTransform(progress, [0, 1], [28, -692]);
  const glow = useTransform(progress, [0, 0.5, 1], [0.35, 1, 0.35]);

  return (
    <div
      aria-hidden
      data-testid="scroll-depth"
      className="pointer-events-none fixed right-5 top-1/2 z-40 hidden h-[30rem] w-8 -translate-y-1/2 xl:block"
    >
      <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-gradient-to-b from-transparent via-brand/25 to-transparent" />
      <motion.div
        className="absolute left-1/2 top-0 h-full w-px origin-top -translate-x-1/2 bg-gradient-to-b from-brand/0 via-brand to-brand-3/0 shadow-[0_0_14px_var(--glow)]"
        style={{ scaleY: progress }}
      />
      <motion.div
        data-testid="scroll-depth-object"
        className="absolute left-1/2 top-3 h-7 w-7 -translate-x-1/2"
        style={{
          y,
          rotateX,
          rotateY,
          opacity: glow,
          perspective: 500,
          transformStyle: "preserve-3d",
        }}
      >
        <span className="absolute inset-0 rotate-45 rounded-[5px] border border-brand bg-brand/10 shadow-[0_0_20px_var(--glow)]" />
        <span className="absolute inset-[5px] -rotate-12 rotate-45 rounded-[3px] border border-brand-3/70 bg-bg/70" />
        <span className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-2 shadow-[0_0_10px_var(--brand)]" />
      </motion.div>
    </div>
  );
}
