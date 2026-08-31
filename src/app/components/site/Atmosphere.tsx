"use client";

/**
 * Fixed atmospheric backdrop: drifting emerald aurora blobs, a perspective
 * grid, and a fine noise wash. Sits behind all page content.
 */
export default function Atmosphere() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    >
      {/* base wash */}
      <div className="absolute inset-0 bg-bg" />

      {/* aurora blobs */}
      <div
        className="anim-float absolute -left-40 -top-40 h-[42rem] w-[42rem] rounded-full opacity-70 blur-[120px]"
        style={{
          background:
            "radial-gradient(circle at center, var(--glow) 0%, transparent 68%)",
        }}
      />
      <div
        className="anim-float-slow delay-2 absolute -right-32 top-24 h-[38rem] w-[38rem] rounded-full opacity-60 blur-[120px]"
        style={{
          background:
            "radial-gradient(circle at center, var(--glow-2) 0%, transparent 70%)",
        }}
      />
      <div
        className="anim-float delay-1 absolute bottom-[-16rem] left-1/3 h-[40rem] w-[40rem] rounded-full opacity-50 blur-[130px]"
        style={{
          background:
            "radial-gradient(circle at center, var(--glow) 0%, transparent 70%)",
        }}
      />

      {/* perspective grid */}
      <div className="grid-bg absolute inset-0" />

      {/* noise */}
      <div className="noise absolute inset-0 opacity-[0.035] mix-blend-soft-light" />

      {/* top + bottom vignette to anchor content */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 100% 55% at 50% 0%, transparent 40%, color-mix(in oklab, var(--bg) 65%, transparent) 100%)",
        }}
      />
    </div>
  );
}
