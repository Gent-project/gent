"use client";

import { motion } from "framer-motion";
import { useSelector } from "react-redux";
import { RootState } from "@/store";

export default function AuthSteps() {
  const isDark = useSelector((state: RootState) => state.theme.isDark);

  const steps = [
    {
      number: 1,
      title: "Create an Account",
      description: "Sign up to access all features"
    },
    {
      number: 2,
      title: "Verify Your Email",
      description: "Check your inbox for verification"
    },
    {
      number: 3,
      title: "Start Exploring",
      description: "Discover all the features"
    }
  ];

  return (
    <div className="w-full max-w-sm">
      <h2 className={`text-2xl font-bold mb-6 ${isDark ? "text-white" : "text-[#2d3e2d]"}`}>
        Get Started
      </h2>
      <div className="space-y-4">
        {steps.map((step, index) => (
          <motion.div
            key={step.number}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            className="flex items-start gap-3"
          >
            <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
              isDark
                ? "bg-[#7dd3fc]/20 text-[#7dd3fc] border border-[#7dd3fc]/40"
                : "bg-[#5A7863]/20 text-[#5A7863] border border-[#5A7863]/40"
            }`}>
              {step.number}
            </div>
            <div>
              <h3 className={`font-semibold ${isDark ? "text-white" : "text-[#2d3e2d]"}`}>
                {step.title}
              </h3>
              <p className={`text-sm ${isDark ? "text-white/60" : "text-[#2d3e2d]/60"}`}>
                {step.description}
              </p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}