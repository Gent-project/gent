"use client";

import { AUTH_PATH } from "@/routes/path";
import {
  GitBranch,
  Code2,
  Users,
  Zap,
  Shield,
  GitPullRequest,
  ArrowRight,
  Rocket,
  Target,
  Lightbulb,
  CheckCircle,
  MessageSquare,
  Activity,
  TrendingUp,
} from "lucide-react";
import { motion } from "framer-motion";
import { useSelector } from "react-redux";
import { RootState } from "@/store";
import SharedNavigation from "@/app/components/SharedNavigation";
import SharedFooter from "@/app/components/SharedFooter";
import NotificationCard from "@/app/components/NotificationCard";
import DashboardMockup from "@/app/components/DashboardMockup";
import Link from "next/link";
import { useState, useEffect } from "react";

export default function Home() {
  const isDark = useSelector((state: RootState) => state.theme.isDark);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2,
        duration: 0.5,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
  };

  const floatingVariants = {
    animate: {
      y: [0, -10, 0],
      transition: { duration: 3, repeat: Infinity },
    },
  };

  return (
    <div
      className={`min-h-screen transition-colors duration-300 ${
        isDark
          ? "bg-gradient-to-br from-[#0f1419] via-[#1a1f2e] to-[#151b28]"
          : "bg-gradient-to-br from-[#bed19e] via-[#a8c88a] to-[#9bc07a]"
      } text-foreground overflow-hidden`}
    >
      {!isHydrated ? null : (
        <>
          <SharedNavigation />

          {/* Section 1: Hero */}
          <motion.section
            className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-32 mt-20"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <motion.div className="space-y-6" variants={itemVariants}>
                <h1
                  className={`text-3xl md:text-6xl lg:text-5xl font-bold leading-tight drop-shadow-lg ${
                    isDark ? "text-white" : "text-[#1a2e1a]"
                  }`}
                >
                  Version Control That
                  <span
                    className={
                      isDark ? "text-[#7dd3fc]" : "text-[#2d3e2d] max-w-xl"
                    }
                  >
                    {" "}
                    moves at the speed of your terminal
                  </span>
                </h1>
                <p
                  className={`text-lg leading-relaxed max-w-xl ${
                    isDark ? "text-gray-300" : "text-[#2d3e2d]"
                  }`}
                >
                  Gent is a modern, Git-shaped platform. A blazing-fast CLI for
                  everyday work, and a beautiful web dashboard that updates the
                  instant you push.
                </p>
                <motion.div
                  className="flex flex-col sm:flex-row gap-4 pt-4"
                  variants={itemVariants}
                >
                  <motion.a
                    href={AUTH_PATH.LOGIN}
                    className={`px-8 py-3 rounded-lg transition-all font-bold text-center flex items-center justify-center gap-2 ${
                      isDark
                        ? "bg-[#7dd3fc] text-[#0f1419] hover:shadow-xl hover:shadow-cyan-500/50"
                        : "bg-white text-[#5A7863] hover:shadow-xl"
                    }`}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    Get started — it's free <ArrowRight className="w-4 h-4" />
                  </motion.a>
                  <motion.button
                    className={`px-8 py-3 rounded-lg border-2 transition-all font-bold ${
                      isDark
                        ? "border-[#7dd3fc] text-[#7dd3fc] hover:bg-[#7dd3fc]/10"
                        : "border-[#2d3e2d] text-[#2d3e2d] hover:bg-[#2d3e2d]/10"
                    }`}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    Browse the CLI
                  </motion.button>
                </motion.div>

                {/* Features list */}
                <div className="flex flex-wrap gap-8 pt-6">
                  <div className="flex items-center gap-2">
                    <CheckCircle
                      className={`w-5 h-5 ${isDark ? "text-[#7dd3fc]" : "text-[#2d3e2d]"}`}
                    />
                    <span
                      className={`text-sm ${isDark ? "text-gray-300" : "text-[#2d3e2d]"}`}
                    >
                      Free for personal use
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle
                      className={`w-5 h-5 ${isDark ? "text-[#7dd3fc]" : "text-[#2d3e2d]"}`}
                    />
                    <span
                      className={`text-sm ${isDark ? "text-gray-300" : "text-[#2d3e2d]"}`}
                    >
                      macOS, Linux, Windows
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle
                      className={`w-5 h-5 ${isDark ? "text-[#7dd3fc]" : "text-[#2d3e2d]"}`}
                    />
                    <span
                      className={`text-sm ${isDark ? "text-gray-300" : "text-[#2d3e2d]"}`}
                    >
                      Open beta
                    </span>
                  </div>
                </div>
              </motion.div>
              <motion.div
                className="relative"
                variants={floatingVariants}
                animate="animate"
              >
                <div
                  className={`rounded-2xl p-8 border shadow-2xl transition-colors ${
                    isDark
                      ? "bg-[#1a1f2e]/50 backdrop-blur-md border-white/10"
                      : "bg-white/10 backdrop-blur-md border-[#2d3e2d]/20"
                  }`}
                >
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full bg-red-500"></div>
                      <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                      <div className="w-3 h-3 rounded-full bg-green-500"></div>
                    </div>
                    <div
                      className={`rounded-lg p-4 font-mono text-sm space-y-2 ${
                        isDark ? "bg-[#0f1419]" : "bg-[#1a1a1a]"
                      }`}
                    >
                      <div className="text-green-400">
                        $ gent clone my-project
                      </div>
                      <div className="text-green-400">$ cd my-project</div>
                      <div className="text-green-400">
                        $ gent commit -m "Initial commit"
                      </div>
                      <div className="text-emerald-300">
                        ✓ Committed successfully
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          </motion.section>

          {/* NEW SECTION: Dashboard Preview with Stats */}
          <motion.section
            className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20"
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
          >
            <div className="grid lg:grid-cols-2 gap-12 items-start">
              {/* Left Side: Dashboard Mockup */}
              <motion.div
                className="order-1 lg:order-1"
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
              >
                <DashboardMockup />
              </motion.div>

              {/* Right Side: Badge, Title, Description */}
              <motion.div
                className="space-y-6 order-2 lg:order-2"
                variants={itemVariants}
              >
                {/* Badge */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  className="inline-flex"
                >
                  <span
                    className={`px-4 py-2 rounded-full text-sm font-semibold border ${
                      isDark
                        ? "bg-[#7dd3fc]/10 text-[#7dd3fc] border-[#7dd3fc]/20"
                        : "bg-[#5A7863]/10 text-[#5A7863] border-[#5A7863]/20"
                    }`}
                  >
                    Real-time Dashboard
                  </span>
                </motion.div>

                {/* Title */}
                <h2
                  className={`text-4xl md:text-5xl font-bold leading-tight ${
                    isDark ? "text-white" : "text-[#2d3e2d]"
                  }`}
                >
                  Manage Gent Repositories,
                  <br />
                  <span
                    className={isDark ? "text-[#7dd3fc]" : "text-[#5A7863]"}
                  >
                    From Web and CLI
                  </span>
                </h2>

                {/* Description */}
                <p
                  className={`text-lg leading-relaxed ${
                    isDark ? "text-gray-300" : "text-[#4a5f4a]"
                  }`}
                >
                  Create repositories, open branches, inspect commits, browse
                  files, and keep the web interface aligned with the Gent CLI
                  and backend API.
                </p>

                {/* Feature List */}
                <div className="space-y-4 pt-4">
                  {[
                    {
                      icon: GitBranch,
                      title: "Branch-aware file browser",
                      description:
                        "Open the tree that belongs to the selected branch",
                    },
                    {
                      icon: Users,
                      title: "Repository access",
                      description:
                        "Use repository settings to manage members and roles",
                    },
                  ].map((feature, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, x: -20 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: idx * 0.1 }}
                      className={`flex gap-4 p-4 rounded-lg border transition-all ${
                        isDark
                          ? "bg-white/5 border-[#7dd3fc]/10 hover:bg-white/10 hover:border-[#7dd3fc]/20"
                          : "bg-white/30 border-[#5A7863]/20 hover:bg-white/50 hover:border-[#5A7863]/30"
                      }`}
                    >
                      <feature.icon
                        className={`w-6 h-6 flex-shrink-0 ${
                          isDark ? "text-[#7dd3fc]" : "text-[#5A7863]"
                        }`}
                      />
                      <div>
                        <h4
                          className={`font-semibold mb-1 ${
                            isDark ? "text-white" : "text-[#2d3e2d]"
                          }`}
                        >
                          {feature.title}
                        </h4>
                        <p
                          className={`text-sm ${
                            isDark ? "text-gray-400" : "text-[#4a5f4a]"
                          }`}
                        >
                          {feature.description}
                        </p>
                      </div>
                    </motion.div>
                  ))}
                </div>

                {/* CTA Button */}
                <motion.a
                  href={AUTH_PATH.LOGIN}
                  className={`inline-flex items-center gap-2 px-6 py-3 rounded-lg font-semibold transition-all ${
                    isDark
                      ? "bg-[#7dd3fc] text-[#0f1419] hover:shadow-lg hover:shadow-[#7dd3fc]/50"
                      : "bg-[#5A7863] text-white hover:shadow-lg hover:shadow-[#5A7863]/50"
                  }`}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  Explore Dashboard
                  <ArrowRight className="w-4 h-4" />
                </motion.a>
              </motion.div>
            </div>
          </motion.section>

          {/* Section 2: Features */}
          <motion.section
            className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 transition-colors duration-300 ${
              isDark ? "" : ""
            }`}
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
          >
            <motion.div className="text-center mb-16" variants={itemVariants}>
              <h2
                className={`text-4xl md:text-5xl font-bold mb-4 drop-shadow-lg ${
                  isDark ? "text-white" : "text-[#2d3e2d]"
                }`}
              >
                Powerful Features for Modern Development
              </h2>
              <p
                className={`text-lg max-w-2xl mx-auto ${
                  isDark ? "text-gray-300" : "text-[#4a5f4a]"
                }`}
              >
                Everything you need to manage your code, collaborate with your
                team, and deploy with confidence.
              </p>
            </motion.div>

            <div className="grid md:grid-cols-3 gap-8">
              {[
                {
                  icon: Code2,
                  title: "Lightweight & Fast",
                  description:
                    "Minimal overhead with maximum performance. Clone, commit, and push in seconds.",
                },
                {
                  icon: Users,
                  title: "Team Collaboration",
                  description:
                    "Work together seamlessly with built-in collaboration tools and real-time updates.",
                },
                {
                  icon: GitPullRequest,
                  title: "Pull Requests",
                  description:
                    "Review code changes, discuss improvements, and merge with confidence.",
                },
                {
                  icon: Shield,
                  title: "Secure & Reliable",
                  description:
                    "Enterprise-grade security with encrypted repositories and access controls.",
                },
                {
                  icon: Zap,
                  title: "Git-Like CLI",
                  description:
                    "Familiar commands and workflows. If you know Git, you know Gent.",
                },
                {
                  icon: GitBranch,
                  title: "Branch Management",
                  description:
                    "Create, merge, and manage branches with an intuitive interface.",
                },
              ].map((feature, idx) => (
                <motion.div
                  key={idx}
                  className={`p-6 rounded-xl border transition-all ${
                    isDark
                      ? "border-white/20 hover:border-white/40 bg-white/10 backdrop-blur-sm hover:bg-white/20 hover:shadow-xl"
                      : "border-[#5A7863]/30 hover:border-[#5A7863]/60 bg-white/40 backdrop-blur-sm hover:bg-white/60 hover:shadow-xl"
                  }`}
                  variants={itemVariants}
                  whileHover={{ y: -5 }}
                >
                  <feature.icon
                    className={`w-8 h-8 mb-4 ${isDark ? "text-white" : "text-[#2d3e2d]"}`}
                  />
                  <h3
                    className={`text-lg font-semibold mb-2 ${isDark ? "text-white" : "text-[#2d3e2d]"}`}
                  >
                    {feature.title}
                  </h3>
                  <p className={isDark ? "text-white/70" : "text-[#2d3e2d]"}>
                    {feature.description}
                  </p>
                </motion.div>
              ))}
            </div>
          </motion.section>

          {/* Section 3: How It Works */}
          <motion.section
            className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20"
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
          >
            <motion.div className="text-center mb-16" variants={itemVariants}>
              <h2
                className={`text-4xl md:text-5xl font-bold mb-4 drop-shadow-lg ${
                  isDark ? "text-white" : "text-[#2d3e2d]"
                }`}
              >
                Get Started in Minutes
              </h2>
              <p
                className={`text-lg ${isDark ? "text-gray-300" : "text-[#4a5f4a]"}`}
              >
                Simple, intuitive workflow for developers of all levels
              </p>
            </motion.div>

            <div className="grid md:grid-cols-4 gap-8">
              {[
                {
                  step: "1",
                  title: "Create Account",
                  description: "Sign up and set up your profile in seconds",
                  icon: Rocket,
                },
                {
                  step: "2",
                  title: "Create Repository",
                  description:
                    "Initialize a new repository or import existing code",
                  icon: GitBranch,
                },
                {
                  step: "3",
                  title: "Collaborate",
                  description: "Invite team members and start working together",
                  icon: Users,
                },
                {
                  step: "4",
                  title: "Deploy",
                  description:
                    "Push to production with integrated deployment tools",
                  icon: Zap,
                },
              ].map((item, idx) => (
                <motion.div
                  key={idx}
                  className="relative"
                  variants={itemVariants}
                >
                  <div className="flex flex-col items-center">
                    <motion.div
                      className={`w-16 h-16 rounded-full flex items-center justify-center font-bold text-2xl mb-4 shadow-lg ${
                        isDark
                          ? "bg-gradient-to-br from-white to-white/80 text-[#0f1419]"
                          : "bg-gradient-to-br from-[#5A7863] to-[#4a6853] text-white"
                      }`}
                      whileHover={{ scale: 1.1 }}
                    >
                      <item.icon className="w-8 h-8" />
                    </motion.div>
                    <h3
                      className={`font-semibold text-center mb-2 text-lg ${isDark ? "text-white" : "text-[#2d3e2d]"}`}
                    >
                      {item.title}
                    </h3>
                    <p
                      className={`text-sm text-center ${isDark ? "text-gray-300" : "text-[#2d3e2d]"}`}
                    >
                      {item.description}
                    </p>
                  </div>
                  {idx < 3 && (
                    <motion.div
                      className={`hidden md:block absolute top-8 left-[60%] w-[40%] h-1 bg-gradient-to-r ${
                        isDark
                          ? "from-white/40 to-white/10"
                          : "from-[#2d3e2d]/40 to-[#2d3e2d]/10"
                      }`}
                      initial={{ scaleX: 0 }}
                      whileInView={{ scaleX: 1 }}
                      transition={{ delay: idx * 0.2 }}
                    ></motion.div>
                  )}
                </motion.div>
              ))}
            </div>
          </motion.section>

          {/* Section 4: Why Choose Gent */}
          <motion.section
            className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20"
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
          >
            <motion.div className="text-center mb-16" variants={itemVariants}>
              <h2
                className={`text-4xl md:text-5xl font-bold mb-4 drop-shadow-lg ${
                  isDark ? "text-white" : "text-[#2d3e2d]"
                }`}
              >
                Why Choose Gent?
              </h2>
              <p
                className={`text-lg ${isDark ? "text-gray-300" : "text-[#4a5f4a]"}`}
              >
                Built by developers, for developers who demand excellence
              </p>
            </motion.div>

            <div className="grid md:grid-cols-2 gap-12 items-center">
              <motion.div className="space-y-6" variants={itemVariants}>
                {[
                  {
                    icon: Target,
                    title: "Focused on Simplicity",
                    description:
                      "We believe version control shouldn't be complicated. Gent strips away unnecessary complexity while keeping powerful features at your fingertips.",
                  },
                  {
                    icon: Lightbulb,
                    title: "Developer-First Design",
                    description:
                      "Every feature is designed with developers in mind. From the CLI to the web interface, everything is intuitive and efficient.",
                  },
                  {
                    icon: Shield,
                    title: "Enterprise Security",
                    description:
                      "Your code is your most valuable asset. We provide enterprise-grade security without the enterprise complexity.",
                  },
                ].map((item, idx) => (
                  <motion.div
                    key={idx}
                    className={`flex gap-4 p-4 rounded-lg border transition-all ${
                      isDark
                        ? "bg-white/10 backdrop-blur-sm border-white/20 hover:bg-white/20"
                        : "bg-white/40 backdrop-blur-sm border-[#2d3e2d]/30 hover:bg-white/60"
                    }`}
                    variants={itemVariants}
                    whileHover={{ x: 5 }}
                  >
                    <item.icon
                      className={`w-6 h-6 flex-shrink-0 mt-1 ${isDark ? "text-white" : "text-[#2d3e2d]"}`}
                    />
                    <div>
                      <h3
                        className={`font-semibold mb-1 ${isDark ? "text-white" : "text-[#2d3e2d]"}`}
                      >
                        {item.title}
                      </h3>
                      <p
                        className={`text-sm ${isDark ? "text-white/70" : "text-[#2d3e2d]"}`}
                      >
                        {item.description}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </motion.div>
              <motion.div
                className={`relative rounded-2xl overflow-hidden border shadow-2xl ${
                  isDark
                    ? "border-[#7dd3fc]/20 bg-gradient-to-br from-[#0f1419] to-[#1a1f2e]"
                    : "border-[#5A7863]/20 bg-gradient-to-br from-white to-gray-50"
                }`}
                variants={floatingVariants}
                animate="animate"
              >
                {/* Glow Effect */}
                <div
                  className={`absolute inset-0 opacity-30 blur-3xl ${
                    isDark
                      ? "bg-gradient-to-tr from-[#7dd3fc]/20 via-[#06b6d4]/20 to-transparent"
                      : "bg-gradient-to-tr from-[#5A7863]/10 via-[#4a6853]/10 to-transparent"
                  }`}
                />

                {/* Content */}
                <div className="relative p-6 h-full flex flex-col">
                  {/* Header */}
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <div
                        className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-medium mb-2 ${
                          isDark
                            ? "bg-[#7dd3fc]/10 border-[#7dd3fc]/30 text-[#7dd3fc]"
                            : "bg-[#5A7863]/10 border-[#5A7863]/30 text-[#5A7863]"
                        }`}
                      >
                        <TrendingUp className="w-3 h-3" />
                        Repository Snapshot
                      </div>
                      <h4
                        className={`text-lg font-bold ${
                          isDark ? "text-white" : "text-gray-900"
                        }`}
                      >
                        Branch and Object Flow
                      </h4>
                    </div>
                    <div
                      className={`text-right ${isDark ? "text-gray-400" : "text-gray-600"}`}
                    >
                      <div className="text-xs">Gent API</div>
                    </div>
                  </div>

                  {/* Stats Row */}
                  <div className="grid grid-cols-3 gap-3 mb-6">
                    {[
                      { label: "Repos", value: "API", change: "live" },
                      { label: "Branches", value: "CID", change: "mapped" },
                      { label: "Objects", value: "SHA", change: "verified" },
                    ].map((stat, idx) => (
                      <motion.div
                        key={idx}
                        initial={{ opacity: 0, y: 10 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: idx * 0.1 }}
                        className={`p-3 rounded-lg border backdrop-blur-sm ${
                          isDark
                            ? "bg-[#1a1f2e]/50 border-[#7dd3fc]/10"
                            : "bg-white/50 border-[#5A7863]/20"
                        }`}
                      >
                        <div
                          className={`text-xs mb-1 ${
                            isDark ? "text-gray-400" : "text-gray-600"
                          }`}
                        >
                          {stat.label}
                        </div>
                        <div
                          className={`text-lg font-bold ${
                            isDark ? "text-white" : "text-gray-900"
                          }`}
                        >
                          {stat.value}
                        </div>
                        <div className="text-xs text-green-400 font-medium">
                          {stat.change}
                        </div>
                      </motion.div>
                    ))}
                  </div>

                  {/* Line Chart */}
                  <div className="flex-1 flex flex-col">
                    <div
                      className={`flex-1 relative rounded-lg border p-4 ${
                        isDark
                          ? "bg-[#1a1f2e]/30 border-[#7dd3fc]/10"
                          : "bg-white/30 border-[#5A7863]/10"
                      }`}
                    >
                      {/* Y-axis labels */}
                      <div className="absolute left-0 top-0 bottom-0 flex flex-col justify-between py-4 pr-2">
                        {[100, 75, 50, 25, 0].map((val, idx) => (
                          <div
                            key={idx}
                            className={`text-xs ${isDark ? "text-gray-500" : "text-gray-500"}`}
                          >
                            {val}
                          </div>
                        ))}
                      </div>

                      {/* Grid lines */}
                      <div className="absolute left-8 right-4 top-4 bottom-8 flex flex-col justify-between">
                        {[...Array(5)].map((_, idx) => (
                          <div
                            key={idx}
                            className={`h-px ${
                              isDark ? "bg-white/5" : "bg-gray-200"
                            }`}
                          />
                        ))}
                      </div>

                      {/* Chart Area */}
                      <div className="relative h-full pl-8 pr-4 pt-4 pb-8">
                        <svg
                          className="w-full h-full"
                          viewBox="0 0 300 100"
                          preserveAspectRatio="none"
                        >
                          {/* Area under curve */}
                          <defs>
                            <linearGradient
                              id="lineGradient"
                              x1="0%"
                              y1="0%"
                              x2="0%"
                              y2="100%"
                            >
                              <stop
                                offset="0%"
                                className={
                                  isDark
                                    ? "stop-color-[#7dd3fc]"
                                    : "stop-color-[#5A7863]"
                                }
                                stopOpacity="0.3"
                              />
                              <stop
                                offset="100%"
                                className={
                                  isDark
                                    ? "stop-color-[#7dd3fc]"
                                    : "stop-color-[#5A7863]"
                                }
                                stopOpacity="0"
                              />
                            </linearGradient>
                          </defs>

                          <motion.path
                            d="M 0 80 L 50 65 L 100 70 L 150 45 L 200 50 L 250 30 L 300 35"
                            fill="url(#lineGradient)"
                            initial={{ pathLength: 0, opacity: 0 }}
                            animate={{ pathLength: 1, opacity: 0.5 }}
                            transition={{ duration: 2, ease: "easeInOut" }}
                          />

                          {/* Line */}
                          <motion.path
                            d="M 0 80 L 50 65 L 100 70 L 150 45 L 200 50 L 250 30 L 300 35"
                            fill="none"
                            stroke={isDark ? "#7dd3fc" : "#5A7863"}
                            strokeWidth="2"
                            initial={{ pathLength: 0 }}
                            animate={{ pathLength: 1 }}
                            transition={{ duration: 2, ease: "easeInOut" }}
                          />

                          {/* Data points */}
                          {[
                            { x: 0, y: 80 },
                            { x: 50, y: 65 },
                            { x: 100, y: 70 },
                            { x: 150, y: 45 },
                            { x: 200, y: 50 },
                            { x: 250, y: 30 },
                            { x: 300, y: 35 },
                          ].map((point, idx) => (
                            <motion.circle
                              key={idx}
                              cx={point.x}
                              cy={point.y}
                              r="4"
                              fill={isDark ? "#7dd3fc" : "#5A7863"}
                              initial={{ scale: 0, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              transition={{
                                delay: 2 + idx * 0.1,
                                duration: 0.3,
                              }}
                            />
                          ))}
                        </svg>
                      </div>

                      {/* X-axis labels */}
                      <div className="absolute left-8 right-4 bottom-0 flex justify-between">
                        {["Jan", "Feb", "Mar", "Apr", "May", "Jun"].map(
                          (month, idx) => (
                            <motion.div
                              key={idx}
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              transition={{ delay: 2.5 + idx * 0.1 }}
                              className={`text-xs ${isDark ? "text-gray-500" : "text-gray-500"}`}
                            >
                              {month}
                            </motion.div>
                          ),
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bottom Glow */}
                <div
                  className={`absolute bottom-0 left-0 right-0 h-px ${
                    isDark
                      ? "bg-gradient-to-r from-transparent via-[#7dd3fc] to-transparent"
                      : "bg-gradient-to-r from-transparent via-[#5A7863] to-transparent"
                  }`}
                />
              </motion.div>
            </div>
          </motion.section>

          {/* Section 5: CTA */}
          <motion.section
            className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-20"
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
          >
            <motion.div
              className={`rounded-2xl p-12 border text-center ${
                isDark
                  ? "bg-gradient-to-r from-white/20 to-white/10 backdrop-blur-md border-white/30"
                  : "bg-gradient-to-r from-[#2d3e2d]/20 to-[#2d3e2d]/10 backdrop-blur-md border-[#2d3e2d]/30"
              }`}
              variants={itemVariants}
            >
              <h2
                className={`text-4xl md:text-5xl font-bold mb-4 drop-shadow-lg ${
                  isDark ? "text-white" : "text-[#2d3e2d]"
                }`}
              >
                Open Gent and Manage Your Repositories
              </h2>
              <p
                className={`text-lg mb-8 max-w-2xl mx-auto ${
                  isDark ? "text-white/80" : "text-[#2d3e2d]"
                }`}
              >
                Sign in to create repositories, browse branches, inspect files,
                manage members, and copy the CLI-compatible repository URL.
              </p>
              <motion.div
                className="flex flex-col sm:flex-row gap-4 justify-center"
                variants={itemVariants}
              >
                <motion.a
                  href={AUTH_PATH.LOGIN}
                  className={`px-8 py-4 rounded-lg transition-all font-bold text-center flex items-center justify-center gap-2 ${
                    isDark
                      ? "bg-white text-[#0f1419] hover:shadow-xl hover:shadow-white/50"
                      : "bg-[#2d3e2d] text-white hover:shadow-xl"
                  }`}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  Open Dashboard <ArrowRight className="w-5 h-5" />
                </motion.a>
                <motion.a
                  href="mailto:info@gent.com"
                  className={`px-8 py-4 rounded-lg border-2 transition-all font-bold flex items-center justify-center gap-2 ${
                    isDark
                      ? "border-white text-white hover:bg-white/10"
                      : "border-[#2d3e2d] text-[#2d3e2d] hover:bg-[#2d3e2d]/10"
                  }`}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <MessageSquare className="w-5 h-5" /> Request Help
                </motion.a>
              </motion.div>
            </motion.div>
          </motion.section>

          {/* Notification Card */}
          <NotificationCard />

          {/* Footer */}
          <SharedFooter />
        </>
      )}
    </div>
  );
}
