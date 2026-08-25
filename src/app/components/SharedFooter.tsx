"use client";

import {
  GitBranch,
  Mail,
  Github,
  Linkedin,
  Twitter,
  Terminal,
  Code2,
  Zap,
  Shield,
} from "lucide-react";
import { motion } from "framer-motion";
import { useSelector } from "react-redux";
import { RootState } from "@/store";
import Link from "next/link";

export default function SharedFooter() {
  const isDark = useSelector((state: RootState) => state.theme.isDark);

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
  };

  const productLinks = [
    { href: "/services", label: "Solutions", icon: Code2 },
    { href: "/how-it-works", label: "Insights", icon: Zap },
    { href: "/faq", label: "FAQ", icon: Shield },
  ];

  const legalLinks = [
    { href: "/terms", label: "Terms of Service" },
    { href: "/privacy", label: "Privacy Policy" },
  ];

  const socialLinks = [
    { href: "#", icon: Github, label: "GitHub" },
    { href: "#", icon: Linkedin, label: "LinkedIn" },
    { href: "#", icon: Twitter, label: "Twitter" },
  ];

  return (
    <motion.footer
      className={`relative border-t transition-colors duration-300 ${
        isDark ? "border-white/5 bg-[#0f1419]" : "border-gray-200 bg-white"
      }`}
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true }}
    >
      {/* Gradient overlay */}
      <div
        className={`absolute inset-0 opacity-50 ${
          isDark
            ? "bg-gradient-to-b from-transparent via-[#7dd3fc]/5 to-transparent"
            : "bg-gradient-to-b from-transparent via-[#5A7863]/5 to-transparent"
        }`}
      ></div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid md:grid-cols-12 gap-8 mb-8">
          {/* Brand Section */}
          <motion.div className="md:col-span-4" variants={itemVariants}>
            <Link
              href="/home"
              className="inline-flex items-center gap-3 mb-4 group"
            >
              <motion.div
                className={`p-2.5 rounded-xl transition-all ${
                  isDark
                    ? "bg-gradient-to-br from-[#7dd3fc]/10 to-[#06b6d4]/10 group-hover:from-[#7dd3fc]/20 group-hover:to-[#06b6d4]/20"
                    : "bg-gradient-to-br from-[#5A7863]/10 to-[#4a6853]/10 group-hover:from-[#5A7863]/20 group-hover:to-[#4a6853]/20"
                }`}
                whileHover={{ scale: 1.05, rotate: 5 }}
              >
                <GitBranch
                  className={`w-5 h-5 ${isDark ? "text-[#7dd3fc]" : "text-[#5A7863]"}`}
                />
              </motion.div>
              <div>
                <span
                  className={`text-xl font-bold block ${isDark ? "text-white" : "text-gray-900"}`}
                >
                  Gent
                </span>
                <span
                  className={`text-xs ${isDark ? "text-gray-400" : "text-gray-500"}`}
                >
                  Version Control
                </span>
              </div>
            </Link>
            <p
              className={`text-sm leading-relaxed mb-4 ${isDark ? "text-gray-400" : "text-gray-600"}`}
            >
              Modern version control that speaks your language. Gent CLI with a
              repository dashboard.
            </p>
            {/* CLI Command Box */}
            <div
              className={`p-3 rounded-lg border font-mono text-sm ${
                isDark
                  ? "bg-[#1a1f2e]/50 border-[#7dd3fc]/20 text-[#7dd3fc]"
                  : "bg-gray-50 border-gray-200 text-[#5A7863]"
              }`}
            >
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4" />
                <span>$ npm install -g gent-cli</span>
              </div>
            </div>
          </motion.div>

          {/* Product Links */}
          <motion.div className="md:col-span-2" variants={itemVariants}>
            <h4
              className={`font-semibold mb-4 text-sm ${isDark ? "text-white" : "text-gray-900"}`}
            >
              Product
            </h4>
            <ul className="space-y-3">
              {productLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className={`flex items-center gap-2 text-sm transition-colors group ${
                      isDark
                        ? "text-gray-400 hover:text-[#7dd3fc]"
                        : "text-gray-600 hover:text-[#5A7863]"
                    }`}
                  >
                    <link.icon className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </motion.div>

          {/* Legal Links */}
          <motion.div className="md:col-span-2" variants={itemVariants}>
            <h4
              className={`font-semibold mb-4 text-sm ${isDark ? "text-white" : "text-gray-900"}`}
            >
              Legal
            </h4>
            <ul className="space-y-3">
              {legalLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className={`text-sm transition-colors hover:translate-x-1 inline-block ${
                      isDark
                        ? "text-gray-400 hover:text-[#7dd3fc]"
                        : "text-gray-600 hover:text-[#5A7863]"
                    }`}
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </motion.div>

          {/* Contact & Social */}
          <motion.div className="md:col-span-4" variants={itemVariants}>
            <h4
              className={`font-semibold mb-4 text-sm ${isDark ? "text-white" : "text-gray-900"}`}
            >
              Connect
            </h4>
            <div className="space-y-3 mb-6">
              <a
                href="mailto:info@gent.com"
                className={`flex items-center gap-3 text-sm transition-colors group ${
                  isDark
                    ? "text-gray-400 hover:text-[#7dd3fc]"
                    : "text-gray-600 hover:text-[#5A7863]"
                }`}
              >
                <div
                  className={`p-2 rounded-lg ${
                    isDark
                      ? "bg-white/5 group-hover:bg-white/10"
                      : "bg-gray-100 group-hover:bg-gray-200"
                  }`}
                >
                  <Mail className="w-4 h-4" />
                </div>
                info@gent.com
              </a>
            </div>

            <div className="flex gap-3">
              {socialLinks.map((social) => (
                <motion.a
                  key={social.label}
                  href={social.href}
                  className={`p-3 rounded-lg transition-all ${
                    isDark
                      ? "bg-white/5 hover:bg-white/10 text-gray-400 hover:text-[#7dd3fc]"
                      : "bg-gray-100 hover:bg-gray-200 text-gray-600 hover:text-[#5A7863]"
                  }`}
                  whileHover={{ scale: 1.1, y: -2 }}
                  whileTap={{ scale: 0.95 }}
                  title={social.label}
                >
                  <social.icon className="w-5 h-5" />
                </motion.a>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Bottom Bar */}
        <motion.div
          className={`pt-6 border-t ${
            isDark ? "border-white/5" : "border-gray-200"
          }`}
          variants={itemVariants}
        >
          <div className="flex flex-col items-center gap-3 text-center">
            <p
              className={`text-sm ${isDark ? "text-gray-400" : "text-gray-600"}`}
            >
              © 2026 Gent Technologies Inc. All rights reserved.
            </p>
            <div
              className={`flex flex-wrap items-center justify-center gap-4 text-xs ${isDark ? "text-gray-500" : "text-gray-500"}`}
            >
              <div className="flex items-center gap-2">
                <div
                  className={`w-2 h-2 rounded-full animate-pulse ${isDark ? "bg-emerald-400" : "bg-emerald-500"}`}
                ></div>
                <span>All Systems Operational</span>
              </div>
              <span>•</span>
              <span>Version 1.0.0</span>
              <span>•</span>
              <span>Built with Gent</span>
            </div>
          </div>
        </motion.div>
      </div>
    </motion.footer>
  );
}
