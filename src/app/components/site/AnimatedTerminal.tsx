"use client";

import { useEffect, useRef, useState } from "react";

type Line =
  | { type: "cmd"; text: string }
  | { type: "out"; text: string; tone?: "muted" | "ok" | "brand" };

const SCRIPT: Line[] = [
  { type: "cmd", text: "gent init" },
  { type: "out", text: "Initialized empty Gent repository in ./.gent", tone: "muted" },
  { type: "cmd", text: "gent add ." },
  { type: "cmd", text: 'gent commit -m "Initial commit"' },
  { type: "out", text: "[main a1f9c3] Initial commit · 12 files, 1.4 kB", tone: "ok" },
  { type: "cmd", text: "gent remote add origin gent-api…/repos/1/my-repo" },
  { type: "cmd", text: "gent push origin main" },
  { type: "out", text: "Packing objects: 100% (12/12), done.", tone: "muted" },
  { type: "out", text: "→ pushed to origin/main ✓", tone: "brand" },
];

const toneClass: Record<string, string> = {
  muted: "text-faint",
  ok: "text-brand-2",
  brand: "text-brand",
};

/** Typewriter terminal that self-types the Gent workflow, then loops. */
export default function AnimatedTerminal() {
  const [rendered, setRendered] = useState<Line[]>([]);
  const [typing, setTyping] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const wait = (ms: number) =>
      new Promise<void>((res) => timers.push(setTimeout(res, ms)));

    async function run() {
      while (!cancelled) {
        setRendered([]);
        setTyping("");
        for (const line of SCRIPT) {
          if (cancelled) return;
          if (line.type === "cmd") {
            for (let i = 1; i <= line.text.length; i++) {
              if (cancelled) return;
              setTyping(line.text.slice(0, i));
              await wait(26);
            }
            await wait(260);
            setRendered((r) => [...r, line]);
            setTyping("");
          } else {
            await wait(180);
            setRendered((r) => [...r, line]);
          }
          await wait(120);
        }
        await wait(2600);
      }
    }
    run();
    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [rendered, typing]);

  return (
    <div
      data-no-translate
      className="border-beam glow-soft overflow-hidden rounded-2xl bg-[#040a08]/95 ring-1 ring-line"
    >
      {/* title bar */}
      <div className="flex items-center gap-2 border-b border-white/5 px-4 py-3">
        <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
        <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
        <span className="h-3 w-3 rounded-full bg-[#28c840]" />
        <span className="ml-2 font-mono text-[11px] text-white/40">
          gent — zsh — 80×24
        </span>
      </div>

      {/* body */}
      <div
        ref={scrollRef}
        className="scrollbar-thin h-[19rem] overflow-y-auto p-5 font-mono text-[13px] leading-6"
      >
        {rendered.map((line, i) =>
          line.type === "cmd" ? (
            <div key={i} className="flex gap-2">
              <span className="select-none text-brand">❯</span>
              <span className="text-slate-100">{line.text}</span>
            </div>
          ) : (
            <div key={i} className={`pl-4 ${toneClass[line.tone ?? "muted"]}`}>
              {line.text}
            </div>
          )
        )}
        {typing && (
          <div className="flex gap-2">
            <span className="select-none text-brand">❯</span>
            <span className="text-slate-100">
              {typing}
              <span className="ml-0.5 inline-block h-[1.05em] w-[7px] translate-y-[2px] animate-pulse bg-brand" />
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
