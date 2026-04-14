"use client";

import { motion } from "framer-motion";

export default function AuthSteps() {
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
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Get Started</h2>
      <div className="space-y-4">
        {steps.map((step, index) => (
          <motion.div
            key={step.number}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            className="flex items-start gap-3"
          >
            <div className="shrink-0 w-6 h-6 rounded-full  text-[#5A7863]  flex items-center justify-center text-sm font-medium">
              {step.number}
            </div>
            <div>
              <h3 className="font-medium text-gray-800">{step.title}</h3>
              <p className="text-sm text-gray-600">{step.description}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}