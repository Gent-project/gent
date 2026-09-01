"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import Atmosphere from "./Atmosphere";

/** Split-screen auth frame: brand showcase on the left, form card on the right. */
export default function AuthShell({
  children,
  showcase,
}: {
  children: React.ReactNode;
  showcase: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen flex-col">
      <Atmosphere />

      <div className="mx-auto flex w-full max-w-6xl flex-1 items-center px-6 py-10">
        <div className="grid w-full items-center gap-12 lg:grid-cols-2">
          {/* showcase */}
          <motion.div
            initial={{ opacity: 0, x: -24 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="hidden lg:block"
          >
            {showcase}
          </motion.div>

          {/* form */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mx-auto w-full max-w-md"
          >
            <Link
              href="/home"
              className="mb-6 inline-flex items-center gap-2 text-sm text-muted transition-colors hover:text-fg lg:hidden"
            >
              ← Back to Gent
            </Link>
            <div className="glass-strong glow-ring rounded-3xl p-7 sm:p-9">
              {children}
            </div>
          </motion.div>
        </div>
      </div>

      <footer className="relative border-t border-line py-5">
        <div className="mx-auto flex max-w-6xl flex-wrap justify-center gap-6 px-6 text-xs text-faint">
          <Link href="/privacy" className="transition-colors hover:text-fg">
            Privacy Policy
          </Link>
          <Link href="/terms" className="transition-colors hover:text-fg">
            Terms of Service
          </Link>
          <span>© {new Date().getFullYear()} Gent. All rights reserved.</span>
        </div>
      </footer>
    </div>
  );
}
