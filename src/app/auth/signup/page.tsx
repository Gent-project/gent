"use client";

import SignUpForm from "@/app/components/SignUpForm";
import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { useSelector } from "react-redux";
import { RootState } from "@/store";
import SharedNavigation from "@/app/components/SharedNavigation";
import Link from "next/link";
import TerminalPreview from "@/app/components/TerminalPreview";

export default function SignUpPage() {
  const isDark = useSelector((state: RootState) => state.theme.isDark);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  if (!isHydrated) return null;

  return (
    <div
      className={`min-h-screen flex flex-col transition-colors duration-300 ${
        isDark
          ? "bg-gradient-to-br from-[#0f1419] via-[#1a1f2e] to-[#151b28]"
          : "bg-gradient-to-br from-[#bed19e] via-[#a8c88a] to-[#9bc07a]"
      }`}
    >
      {/* Navigation Bar */}
      <SharedNavigation />

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center py-8 px-4 mt-20">
        <div className="w-full max-w-6xl grid lg:grid-cols-2 gap-8 items-center">
          {/* Left Side - Terminal Preview */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="hidden lg:block"
          >
            <TerminalPreview
              title="Getting Started"
              commands={[
                {
                  command: "mkdir my-project && cd my-project",
                  comment: "Create your project",
                },
                { command: "git init", comment: "Initialize git repository" },
                { command: 'echo "# My Project" > README.md' },
                { command: "git add README.md" },
                { command: 'git commit -m "Initial commit"' },
                {
                  command:
                    "git remote add origin https://gent.dev/username/my-project.git",
                },
                { command: "git push -u origin main", comment: "Push to Gent" },
              ]}
            />
          </motion.div>

          {/* Right Side - Signup Form */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
            className="w-full"
          >
            <div
              className={`w-full rounded-2xl shadow-2xl p-6 sm:p-8 border transition-all ${
                isDark
                  ? "border-white/20 bg-[#0f1419]/95 backdrop-blur-md"
                  : "border-[#5A7863]/30 bg-white/95 backdrop-blur-md"
              }`}
            >
              <h1
                className={`text-2xl sm:text-3xl font-bold text-center mb-2 ${
                  isDark ? "text-white" : "text-[#2d3e2d]"
                }`}
              >
                Create Account
              </h1>
              <p
                className={`text-center text-sm mb-8 ${
                  isDark ? "text-white/60" : "text-[#2d3e2d]/60"
                }`}
              >
                Join thousands of developers using Gent
              </p>

              <SignUpForm />
            </div>
          </motion.div>
        </div>
      </div>

      {/* Footer */}
      <footer
        className={`w-full py-4 border-t transition-colors duration-300 ${
          isDark
            ? "border-white/10 bg-[#0f1419]/50"
            : "border-[#5A7863]/20 bg-white/50"
        }`}
      >
        <div className="flex flex-wrap justify-center gap-6 text-xs sm:text-sm">
          <Link
            href="/privacy"
            className={`transition-colors ${
              isDark
                ? "text-white/60 hover:text-white"
                : "text-[#2d3e2d]/60 hover:text-[#2d3e2d]"
            }`}
          >
            Privacy Policy
          </Link>
          <Link
            href="/terms"
            className={`transition-colors ${
              isDark
                ? "text-white/60 hover:text-white"
                : "text-[#2d3e2d]/60 hover:text-[#2d3e2d]"
            }`}
          >
            Terms of Service
          </Link>
          <span className={isDark ? "text-white/30" : "text-[#2d3e2d]/30"}>
            •
          </span>
          <span
            className={`text-xs ${isDark ? "text-white/50" : "text-[#2d3e2d]/50"}`}
          >
            © 2026 Gent. All rights reserved.
          </span>
        </div>
      </footer>
    </div>
  );
}
