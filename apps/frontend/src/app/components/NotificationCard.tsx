"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useSelector } from "react-redux";
import { RootState } from "@/store";
import { useState, useEffect } from "react";
import { ArrowRight, Zap, X } from "lucide-react";
import Link from "next/link";
import { AUTH_PATH } from "@/routes/path";

const notifications = [
  {
    title: "Lightweight Version Control",
    description:
      "Gent is a modern, lightweight version control system designed for developers who value simplicity and efficiency.",
    badge: "Version Control",
    type: "info",
  },
  {
    title: "Start Your Journey",
    description:
      "Sign in to create repositories, browse branches, and copy Gent CLI remotes.",
    badge: "Get Started",
    type: "cta",
    showButton: true,
  },
];

export default function NotificationCard() {
  const isDark = useSelector((state: RootState) => state.theme.isDark);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (!isHydrated) return;

    // Show after 2 seconds
    const showTimer = setTimeout(() => {
      setIsVisible(true);
    }, 2000);

    return () => clearTimeout(showTimer);
  }, [isHydrated]);

  useEffect(() => {
    if (!isVisible) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % notifications.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [isVisible]);

  const current = notifications[currentIndex];
  const handleClose = () => {
    setIsVisible(false);
  };

  if (!isHydrated) return null;

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ x: 400, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 400, opacity: 0 }}
          transition={{
            duration: 0.6,
            ease: "easeOut",
            type: "spring",
            stiffness: 100,
          }}
          className="fixed bottom-20 right-2 sm:right-4 lg:right-6 z-40 w-64 sm:w-72 md:w-80"
        >
          {/* Glow effect */}
          <motion.div
            className={`absolute inset-0 rounded-2xl blur-2xl opacity-30 ${
              isDark ? "bg-[#7dd3fc]" : "bg-[#5A7863]"
            }`}
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 3, repeat: Infinity }}
          />

          {/* Card */}
          <motion.div
            key={currentIndex}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.5 }}
            className={`relative rounded-xl border p-3 sm:p-4 md:p-6 backdrop-blur-xl shadow-2xl ${
              isDark
                ? "border-white/20 bg-[#0f1419]/95"
                : "border-[#5A7863]/30 bg-white/95"
            }`}
          >
            {/* Close Button */}
            <motion.button
              onClick={handleClose}
              className={`absolute top-2 right-2 p-1.5 rounded-lg transition-all ${
                isDark
                  ? "bg-white/5 hover:bg-white/10 text-white/60 hover:text-white"
                  : "bg-black/5 hover:bg-black/10 text-gray-600 hover:text-gray-900"
              }`}
              whileHover={{ scale: 1.1, rotate: 90 }}
              whileTap={{ scale: 0.9 }}
              title="Close"
            >
              <X className="w-4 h-4" />
            </motion.button>

            {current.type === "info" ? (
              <>
                {/* Info Card */}
                <div className="space-y-3">
                  <div>
                    <span
                      className={`inline-block text-xs font-bold px-3 py-1 rounded-full mb-2 ${
                        isDark
                          ? "bg-[#7dd3fc]/20 text-[#7dd3fc]"
                          : "bg-[#5A7863]/20 text-[#5A7863]"
                      }`}
                    >
                      {current.badge}
                    </span>
                  </div>
                  <h3
                    className={`text-sm sm:text-base md:text-lg font-bold ${isDark ? "text-white" : "text-[#2d3e2d]"}`}
                  >
                    {current.title}
                  </h3>
                  <p
                    className={`text-xs leading-relaxed ${isDark ? "text-white/70" : "text-[#2d3e2d]/70"}`}
                  >
                    {current.description}
                  </p>
                </div>
              </>
            ) : (
              <>
                {/* CTA Card */}
                <div className="space-y-4">
                  <div>
                    <span
                      className={`inline-block text-xs font-bold px-3 py-1 rounded-full mb-2 ${
                        isDark
                          ? "bg-[#7dd3fc]/20 text-[#7dd3fc]"
                          : "bg-[#5A7863]/20 text-[#5A7863]"
                      }`}
                    >
                      {current.badge}
                    </span>
                  </div>
                  <h3
                    className={`text-sm sm:text-base md:text-lg font-bold ${isDark ? "text-white" : "text-[#2d3e2d]"}`}
                  >
                    {current.title}
                  </h3>
                  <p
                    className={`text-xs leading-relaxed ${isDark ? "text-white/70" : "text-[#2d3e2d]/70"}`}
                  >
                    {current.description}
                  </p>
                  <motion.div
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <Link
                      href={AUTH_PATH.LOGIN}
                      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg font-medium text-xs sm:text-sm transition-all ${
                        isDark
                          ? "bg-gradient-to-r from-[#7dd3fc] to-[#06b6d4] text-[#0f1419] hover:shadow-lg hover:shadow-cyan-500/50"
                          : "bg-gradient-to-r from-[#5A7863] to-[#4a6853] text-white hover:shadow-lg hover:shadow-green-500/50"
                      }`}
                    >
                      <Zap className="w-4 h-4" />
                      Sign In
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                  </motion.div>
                </div>
              </>
            )}

            {/* Progress indicator */}
            <motion.div
              className={`absolute bottom-0 left-0 h-1 rounded-b-2xl ${
                isDark ? "bg-[#7dd3fc]" : "bg-[#5A7863]"
              }`}
              initial={{ width: "100%" }}
              animate={{ width: "0%" }}
              transition={{ duration: 5, ease: "linear" }}
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
