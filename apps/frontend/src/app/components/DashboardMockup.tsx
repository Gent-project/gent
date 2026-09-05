"use client";

import { motion } from "framer-motion";
import { useSelector } from "react-redux";
import { RootState } from "@/store";
import {
  GitBranch,
  GitCommit,
  Users,
  Star,
  TrendingUp,
  Activity,
} from "lucide-react";

export default function DashboardMockup() {
  const isDark = useSelector((state: RootState) => state.theme.isDark);

  const stats = [
    { label: "Repositories", value: "24", icon: GitBranch, change: "+3" },
    { label: "Commits", value: "1,247", icon: GitCommit, change: "+127" },
    { label: "Contributors", value: "18", icon: Users, change: "+2" },
    { label: "Stars", value: "342", icon: Star, change: "+45" },
  ];

  const activities = [
    {
      action: "Pushed to main",
      repo: "my-project",
      time: "2m ago",
      color: "text-green-400",
    },
    {
      action: "Created branch",
      repo: "frontend-app",
      time: "15m ago",
      color: "text-blue-400",
    },
    {
      action: "Merged PR #24",
      repo: "backend-api",
      time: "1h ago",
      color: "text-purple-400",
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className={`relative rounded-2xl overflow-hidden shadow-2xl border-2 w-full h-[600px] flex flex-col ${
        isDark
          ? "bg-gradient-to-br from-[#0f1419] to-[#1a1f2e] border-[#7dd3fc]/20"
          : "bg-gradient-to-br from-white to-gray-50 border-[#5A7863]/20"
      }`}
    >
      {/* Glow Effect */}
      <div
        className={`absolute inset-0 opacity-30 blur-3xl ${
          isDark
            ? "bg-gradient-to-tr from-[#7dd3fc]/20 via-[#06b6d4]/20 to-transparent"
            : "bg-gradient-to-tr from-[#5A7863]/10 via-[#4a6853]/10 to-transparent"
        }`}
      />

      {/* Window Header */}
      <div
        className={`relative border-b px-4 py-3 backdrop-blur-sm flex-shrink-0 ${
          isDark
            ? "bg-[#0f1419]/80 border-[#7dd3fc]/10"
            : "bg-white/80 border-gray-200"
        }`}
      >
        <div className="flex items-center gap-2">
          <motion.div
            className="w-3 h-3 rounded-full bg-[#ff5f57]"
            whileHover={{ scale: 1.1 }}
          />
          <motion.div
            className="w-3 h-3 rounded-full bg-[#febc2e]"
            whileHover={{ scale: 1.1 }}
          />
          <motion.div
            className="w-3 h-3 rounded-full bg-[#28c840]"
            whileHover={{ scale: 1.1 }}
          />
          <span
            className={`ml-4 text-sm font-medium ${
              isDark ? "text-[#7dd3fc]" : "text-[#5A7863]"
            }`}
          >
            Dashboard
          </span>
        </div>
      </div>

      {/* Dashboard Content - Scrollable */}
      <div className="relative overflow-y-auto overflow-x-hidden flex-1 scrollbar-thin scrollbar-thumb-rounded scrollbar-thumb-gray-400 scrollbar-track-transparent hover:scrollbar-thumb-gray-500">
        <div className="p-6 space-y-6">
          {/* Stats Grid */}
          <div className="grid grid-cols-4 gap-3">
            {stats.map((stat, index) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className={`rounded-xl p-3 border backdrop-blur-sm ${
                  isDark
                    ? "bg-[#1a1f2e]/50 border-[#7dd3fc]/10 hover:border-[#7dd3fc]/30"
                    : "bg-white/50 border-gray-200 hover:border-[#5A7863]/30"
                }`}
                whileHover={{ scale: 1.02 }}
              >
                <div className="flex items-start justify-between mb-2">
                  <stat.icon
                    className={`w-4 h-4 ${
                      isDark ? "text-[#7dd3fc]" : "text-[#5A7863]"
                    }`}
                  />
                  <motion.span
                    className="text-xs px-1.5 py-0.5 rounded-full bg-green-500/20 text-green-400 font-medium"
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: index * 0.1 + 0.2 }}
                  >
                    {stat.change}
                  </motion.span>
                </div>
                <div
                  className={`text-xl font-bold mb-0.5 ${
                    isDark ? "text-white" : "text-gray-900"
                  }`}
                >
                  {stat.value}
                </div>
                <div
                  className={`text-xs ${
                    isDark ? "text-gray-400" : "text-gray-600"
                  }`}
                >
                  {stat.label}
                </div>
              </motion.div>
            ))}
          </div>

          {/* Activity Feed */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className={`rounded-xl p-4 border backdrop-blur-sm ${
              isDark
                ? "bg-[#1a1f2e]/50 border-[#7dd3fc]/10"
                : "bg-white/50 border-gray-200"
            }`}
          >
            <div className="flex items-center gap-2 mb-4">
              <Activity
                className={`w-4 h-4 ${
                  isDark ? "text-[#7dd3fc]" : "text-[#5A7863]"
                }`}
              />
              <span
                className={`text-sm font-medium ${
                  isDark ? "text-white" : "text-gray-900"
                }`}
              >
                Recent Activity
              </span>
            </div>
            <div className="space-y-3">
              {activities.map((activity, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 + index * 0.1 }}
                  className="flex items-start gap-3"
                >
                  <motion.div
                    className={`w-2 h-2 rounded-full mt-1.5 ${activity.color}`}
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      delay: index * 0.3,
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <p
                      className={`text-sm ${
                        isDark ? "text-white" : "text-gray-900"
                      }`}
                    >
                      {activity.action}
                    </p>
                    <p
                      className={`text-xs ${
                        isDark ? "text-gray-400" : "text-gray-600"
                      }`}
                    >
                      {activity.repo} • {activity.time}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Chart Placeholder */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
            className={`rounded-xl p-4 border backdrop-blur-sm ${
              isDark
                ? "bg-[#1a1f2e]/50 border-[#7dd3fc]/10"
                : "bg-white/50 border-gray-200"
            }`}
          >
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp
                className={`w-4 h-4 ${
                  isDark ? "text-[#7dd3fc]" : "text-[#5A7863]"
                }`}
              />
              <span
                className={`text-sm font-medium ${
                  isDark ? "text-white" : "text-gray-900"
                }`}
              >
                Commit Activity
              </span>
            </div>
            <div className="flex items-end justify-between h-24 gap-2">
              {[40, 65, 45, 80, 55, 90, 70].map((height, index) => (
                <motion.div
                  key={index}
                  initial={{ height: 0 }}
                  animate={{ height: `${height}%` }}
                  transition={{ delay: 0.9 + index * 0.05, duration: 0.3 }}
                  className={`flex-1 rounded-t-md ${
                    isDark
                      ? "bg-gradient-to-t from-[#7dd3fc] to-[#06b6d4]"
                      : "bg-gradient-to-t from-[#5A7863] to-[#4a6853]"
                  }`}
                  whileHover={{ opacity: 0.8 }}
                />
              ))}
            </div>
            <div className="flex justify-between mt-2">
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(
                (day, index) => (
                  <motion.span
                    key={day}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 1.2 + index * 0.05 }}
                    className={`text-xs ${
                      isDark ? "text-gray-400" : "text-gray-600"
                    }`}
                  >
                    {day}
                  </motion.span>
                ),
              )}
            </div>
          </motion.div>

          {/* Extra Content - Top Repositories */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.0 }}
            className={`rounded-xl p-4 border backdrop-blur-sm ${
              isDark
                ? "bg-[#1a1f2e]/50 border-[#7dd3fc]/10"
                : "bg-white/50 border-gray-200"
            }`}
          >
            <div className="flex items-center gap-2 mb-3">
              <Star
                className={`w-4 h-4 ${
                  isDark ? "text-[#7dd3fc]" : "text-[#5A7863]"
                }`}
              />
              <span
                className={`text-sm font-medium ${
                  isDark ? "text-white" : "text-gray-900"
                }`}
              >
                Top Repositories
              </span>
            </div>
            <div className="space-y-2">
              {[
                { name: "frontend-app", stars: 89, language: "TypeScript" },
                { name: "backend-api", stars: 67, language: "Node.js" },
                { name: "mobile-app", stars: 54, language: "React Native" },
              ].map((repo, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 1.1 + index * 0.1 }}
                  className={`flex items-center justify-between p-2 rounded-lg ${
                    isDark ? "bg-[#0f1419]/50" : "bg-white/50"
                  }`}
                >
                  <div>
                    <p
                      className={`text-sm font-medium ${
                        isDark ? "text-white" : "text-gray-900"
                      }`}
                    >
                      {repo.name}
                    </p>
                    <p
                      className={`text-xs ${
                        isDark ? "text-gray-400" : "text-gray-600"
                      }`}
                    >
                      {repo.language}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Star
                      className={`w-3 h-3 ${
                        isDark ? "text-yellow-400" : "text-yellow-500"
                      }`}
                    />
                    <span
                      className={`text-xs ${
                        isDark ? "text-gray-400" : "text-gray-600"
                      }`}
                    >
                      {repo.stars}
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
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
  );
}
