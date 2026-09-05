"use client";

import { motion } from "framer-motion";
import { getDashboardTheme } from "./dashboard-theme";

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  text?: string;
  isDark?: boolean;
  className?: string;
}

export default function LoadingSpinner({ 
  size = 'md', 
  text, 
  isDark = false, 
  className = '' 
}: LoadingSpinnerProps) {
  const t = getDashboardTheme(isDark);

  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12'
  };

  const textSizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base'
  };

  return (
    <div className={`flex flex-col items-center justify-center gap-3 ${className}`}>
      <motion.div
        className={`${sizeClasses[size]} border-2 border-transparent rounded-full`}
        style={{
          borderTopColor: t.accent,
          borderRightColor: t.accent + '30',
        }}
        animate={{ rotate: 360 }}
        transition={{
          duration: 1,
          repeat: Infinity,
          ease: "linear"
        }}
      />
      {text && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className={`font-medium ${textSizeClasses[size]}`}
          style={{ color: t.textMuted }}
        >
          {text}
        </motion.p>
      )}
    </div>
  );
}

// Skeleton loader for cards
export function SkeletonCard({ isDark = false }: { isDark?: boolean }) {
  const t = getDashboardTheme(isDark);

  return (
    <div
      className="rounded-lg border p-6"
      style={{
        backgroundColor: t.elevated,
        borderColor: t.border,
      }}
    >
      <div className="animate-pulse">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <div className="h-5 bg-gray-300 rounded w-48 mb-2"></div>
            <div className="h-4 bg-gray-300 rounded w-64 mb-3"></div>
            <div className="flex gap-2">
              <div className="h-6 bg-gray-300 rounded w-16"></div>
              <div className="h-6 bg-gray-300 rounded w-20"></div>
            </div>
          </div>
          <div className="h-8 bg-gray-300 rounded w-20"></div>
        </div>
        <div className="flex items-center gap-4">
          <div className="h-3 bg-gray-300 rounded w-24"></div>
          <div className="h-3 bg-gray-300 rounded w-20"></div>
          <div className="h-3 bg-gray-300 rounded w-28"></div>
        </div>
      </div>
    </div>
  );
}

// Skeleton loader for activity feed
export function SkeletonActivity({ isDark = false }: { isDark?: boolean }) {
  const t = getDashboardTheme(isDark);

  return (
    <div
      className="rounded-lg border p-6"
      style={{
        backgroundColor: t.elevated,
        borderColor: t.border,
      }}
    >
      <div className="h-5 bg-gray-300 rounded w-32 mb-4"></div>
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 animate-pulse">
            <div className="w-8 h-8 bg-gray-300 rounded-full"></div>
            <div className="flex-1">
              <div className="h-4 bg-gray-300 rounded mb-1"></div>
              <div className="h-3 bg-gray-300 rounded w-2/3"></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}