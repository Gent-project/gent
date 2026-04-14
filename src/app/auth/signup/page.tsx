"use client";

import SignUpForm from "@/app/components/SignUpForm";
import Image from "next/image";
import { motion } from "framer-motion";
import { useState } from "react";
import AuthSteps from "@/app/components/AuthSteps";

export default function SignUpPage() {
  const [tooltip, setTooltip] = useState<string | null>(null);

  const links = [
    { label: "Privacy Policy", key: "privacy" },
    { label: "Help Center", key: "help" },
    { label: "Terms of Service", key: "terms" },
  ];

  return (
    <div className="min-h-screen flex flex-col justify-between bg-[#bed19e] p-4">
      <div className="flex-1 flex flex-col lg:flex-row items-center justify-center gap-8 lg:gap-12 py-8">
        <div className="w-full max-w-sm hidden lg:block">
          <AuthSteps />
        </div>

        {/* Right Side - Signup Form */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="w-full max-w-md lg:max-w-lg"
        >
          <div className="bg-white w-full rounded-2xl shadow-lg p-6 sm:p-8">
            <div className="flex justify-center mb-6">
              <Image
                src="/logo.png"
                alt="Logo"
                width={140}
                height={140}
                className="h-auto"
              />
            </div>

            <h1 className="text-xl sm:text-2xl font-bold text-center mb-6 text-gray-400">
              Create Account
            </h1>

            <SignUpForm />
          </div>
        </motion.div>
      </div>

      {/* Footer */}
      <footer className="w-full py-4 mt-8 border-t border-gray-200">
        <div className="flex flex-wrap justify-center gap-4 text-xs sm:text-sm text-gray-500">
          {links.map((link) => (
            <a
              key={link.key}
              href="#"
              className="hover:text-gray-700 transition-colors"
              onClick={(e) => {
                e.preventDefault();
                setTooltip(link.key === tooltip ? null : link.key);
              }}
            >
              {link.label}
            </a>
          ))}
        </div>
      </footer>
    </div>
  );
}
