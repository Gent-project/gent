"use client";

import {
  GitBranch,
  Moon,
  Sun,
  Menu,
  X,
  ChevronDown,
  FileText,
  Shield,
  HelpCircle,
  Terminal,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useDispatch, useSelector } from "react-redux";
import { toggleTheme } from "@/store/slices/theme-slice";
import { RootState } from "@/store";
import { AUTH_PATH } from "@/routes/path";
import Link from "next/link";
import { useState } from "react";

export default function SharedNavigation() {
  const dispatch = useDispatch();
  const isDark = useSelector((state: RootState) => state.theme.isDark);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isResourcesOpen, setIsResourcesOpen] = useState(false);

  const resourcesLinks = [
    { href: "/privacy", label: "Privacy Policy", icon: Shield },
    { href: "/terms", label: "Terms of Service", icon: FileText },
    { href: "/faq", label: "FAQ", icon: HelpCircle },
  ];

  return (
    <motion.nav
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className={`fixed top-0 left-0 right-0 transition-all duration-300 z-50 ${
        isDark
          ? "bg-[#0f1419]/80 backdrop-blur-2xl border-b border-white/5"
          : "bg-white/80 backdrop-blur-2xl border-b border-gray-200/50"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link href="/home" className="flex items-center gap-3 group">
            <motion.div
              className={`p-2 rounded-xl transition-all ${
                isDark
                  ? "bg-gradient-to-br from-[#7dd3fc]/10 to-[#06b6d4]/10 group-hover:from-[#7dd3fc]/20 group-hover:to-[#06b6d4]/20"
                  : "bg-gradient-to-br from-[#5A7863]/10 to-[#4a6853]/10 group-hover:from-[#5A7863]/20 group-hover:to-[#4a6853]/20"
              }`}
              whileHover={{ scale: 1.05, rotate: 5 }}
              whileTap={{ scale: 0.95 }}
            >
              <GitBranch
                className={`w-5 h-5 ${isDark ? "text-[#7dd3fc]" : "text-[#5A7863]"}`}
              />
            </motion.div>
            <div>
              <span
                className={`text-xl font-bold ${isDark ? "text-white" : "text-gray-900"}`}
              >
                Gent
              </span>
              <div
                className={`text-xs ${isDark ? "text-gray-400" : "text-gray-500"}`}
              >
                Version Control
              </div>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex items-center gap-1">
            <NavLink href="/home" isDark={isDark}>
              Home
            </NavLink>
            <NavLink href="/how-it-works" isDark={isDark}>
              Insights
            </NavLink>
            <NavLink href="/services" isDark={isDark}>
              Solutions
            </NavLink>

            {/* Resources Dropdown */}
            <div
              className="relative"
              onMouseEnter={() => setIsResourcesOpen(true)}
              onMouseLeave={() => setIsResourcesOpen(false)}
            >
              <button
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  isDark
                    ? "text-gray-300 hover:text-white hover:bg-white/5"
                    : "text-gray-700 hover:text-gray-900 hover:bg-gray-100"
                }`}
              >
                Resources
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform duration-200 ${isResourcesOpen ? "rotate-180" : ""}`}
                />
              </button>

              <AnimatePresence>
                {isResourcesOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    transition={{ duration: 0.15, ease: "easeOut" }}
                    className={`absolute top-full right-0 mt-2 w-64 rounded-xl border overflow-hidden shadow-2xl ${
                      isDark
                        ? "bg-[#1a1f2e] border-white/10"
                        : "bg-white border-gray-200"
                    }`}
                  >
                    <div
                      className={`p-2 border-b ${isDark ? "border-white/5" : "border-gray-100"}`}
                    >
                      <div
                        className={`px-3 py-2 text-xs font-semibold ${isDark ? "text-gray-400" : "text-gray-500"}`}
                      >
                        RESOURCES
                      </div>
                    </div>
                    {resourcesLinks.map((link) => (
                      <Link
                        key={link.href}
                        href={link.href}
                        className={`flex items-center gap-3 px-4 py-3 transition-all ${
                          isDark
                            ? "hover:bg-white/5 text-gray-300 hover:text-white"
                            : "hover:bg-gray-50 text-gray-700 hover:text-gray-900"
                        }`}
                      >
                        <div
                          className={`p-1.5 rounded-lg ${
                            isDark ? "bg-[#7dd3fc]/10" : "bg-[#5A7863]/10"
                          }`}
                        >
                          <link.icon
                            className={`w-4 h-4 ${isDark ? "text-[#7dd3fc]" : "text-[#5A7863]"}`}
                          />
                        </div>
                        <div className="flex-1">
                          <div className="text-sm font-medium">
                            {link.label}
                          </div>
                        </div>
                      </Link>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Right Actions */}
          <div className="hidden lg:flex items-center gap-3">
            <motion.button
              onClick={() => dispatch(toggleTheme())}
              className={`p-2.5 rounded-lg transition-all ${
                isDark
                  ? "bg-white/5 hover:bg-white/10 text-[#7dd3fc]"
                  : "bg-gray-100 hover:bg-gray-200 text-gray-700"
              }`}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
            >
              {isDark ? (
                <Sun className="w-4 h-4" />
              ) : (
                <Moon className="w-4 h-4" />
              )}
            </motion.button>

            <Link href={AUTH_PATH.LOGIN}>
              <motion.div
                className={`group relative overflow-hidden px-5 py-2.5 rounded-xl font-semibold text-sm transition-all cursor-pointer border-2 ${
                  isDark
                    ? "bg-gradient-to-r from-[#7dd3fc]/10 to-[#06b6d4]/10 text-[#7dd3fc] border-[#7dd3fc] hover:bg-[#7dd3fc] hover:text-[#0f1419]"
                    : "bg-gradient-to-r from-[#5A7863]/10 to-[#4a6853]/10 text-[#5A7863] border-[#5A7863] hover:bg-[#5A7863] hover:text-white"
                }`}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <div className="relative z-10 flex items-center gap-2">
                  <Terminal className="w-4 h-4" />
                  <span>Start Building</span>
                </div>
              </motion.div>
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <div className="lg:hidden flex items-center gap-2">
            <motion.button
              onClick={() => dispatch(toggleTheme())}
              className={`p-2 rounded-lg transition-all ${
                isDark
                  ? "bg-white/5 hover:bg-white/10 text-[#7dd3fc]"
                  : "bg-gray-100 hover:bg-gray-200 text-gray-700"
              }`}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              {isDark ? (
                <Sun className="w-4 h-4" />
              ) : (
                <Moon className="w-4 h-4" />
              )}
            </motion.button>
            <motion.button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className={`p-2 rounded-lg transition-all ${
                isDark
                  ? "bg-white/5 hover:bg-white/10 text-white"
                  : "bg-gray-100 hover:bg-gray-200 text-gray-700"
              }`}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              {isMenuOpen ? (
                <X className="w-5 h-5" />
              ) : (
                <Menu className="w-5 h-5" />
              )}
            </motion.button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className={`lg:hidden overflow-hidden border-t ${
              isDark
                ? "border-white/5 bg-[#0f1419]/95"
                : "border-gray-200 bg-white/95"
            } backdrop-blur-2xl`}
          >
            <div className="px-4 py-4 space-y-1">
              <MobileNavLink
                href="/home"
                isDark={isDark}
                onClick={() => setIsMenuOpen(false)}
              >
                Home
              </MobileNavLink>
              <MobileNavLink
                href="/how-it-works"
                isDark={isDark}
                onClick={() => setIsMenuOpen(false)}
              >
                Insights
              </MobileNavLink>
              <MobileNavLink
                href="/services"
                isDark={isDark}
                onClick={() => setIsMenuOpen(false)}
              >
                Solutions
              </MobileNavLink>

              <div
                className={`px-3 py-2 mt-3 text-xs font-semibold ${isDark ? "text-gray-400" : "text-gray-500"}`}
              >
                RESOURCES
              </div>
              {resourcesLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${
                    isDark
                      ? "text-gray-300 hover:text-white hover:bg-white/5"
                      : "text-gray-700 hover:text-gray-900 hover:bg-gray-100"
                  }`}
                  onClick={() => setIsMenuOpen(false)}
                >
                  <link.icon className="w-4 h-4" />
                  <span className="text-sm font-medium">{link.label}</span>
                </Link>
              ))}

              <Link href={AUTH_PATH.LOGIN} className="block mt-4">
                <motion.div
                  className={`group relative overflow-hidden flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-semibold text-sm transition-all cursor-pointer border-2 ${
                    isDark
                      ? "bg-gradient-to-r from-[#7dd3fc]/10 to-[#06b6d4]/10 text-[#7dd3fc] border-[#7dd3fc]"
                      : "bg-gradient-to-r from-[#5A7863]/10 to-[#4a6853]/10 text-[#5A7863] border-[#5A7863]"
                  }`}
                  onClick={() => setIsMenuOpen(false)}
                  whileTap={{ scale: 0.98 }}
                >
                  <Terminal className="w-4 h-4" />
                  <span>Start Building</span>
                </motion.div>
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  );
}

// Desktop Nav Link Component
function NavLink({
  href,
  isDark,
  children,
}: {
  href: string;
  isDark: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
        isDark
          ? "text-gray-300 hover:text-white hover:bg-white/5"
          : "text-gray-700 hover:text-gray-900 hover:bg-gray-100"
      }`}
    >
      {children}
    </Link>
  );
}

// Mobile Nav Link Component
function MobileNavLink({
  href,
  isDark,
  onClick,
  children,
}: {
  href: string;
  isDark: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`block px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
        isDark
          ? "text-gray-300 hover:text-white hover:bg-white/5"
          : "text-gray-700 hover:text-gray-900 hover:bg-gray-100"
      }`}
      onClick={onClick}
    >
      {children}
    </Link>
  );
}
