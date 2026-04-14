"use client";

import LoginForm from "@/app/components/LoginForm";
import Image from "next/image";
import { motion } from "framer-motion";
import { useState } from "react";
import { AUTH_PATH } from "@/routes/path";
import AuthSteps from "@/app/components/AuthSteps";

export default function LoginPage() {
  const [tooltip, setTooltip] = useState<string | null>(null);

  const links = [
    { label: "Privacy Policy", key: "privacy" },
    { label: "Help Center", key: "help" },
    { label: "Terms of Service", key: "terms" },
  ];

  return (
    <div className="min-h-screen flex flex-col justify-between bg-[#bed19e] p-4">
      <div className="flex-1 flex flex-col lg:flex-row items-center justify-center gap-8 lg:gap-12 py-8">
        {/* Left Side - Steps, تظهر فقط على lg فما فوق */}
        <div className="w-full max-w-sm hidden lg:block">
          <AuthSteps />
        </div>

        {/* Right Side - Login Form */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="w-full max-w-md lg:max-w-lg"
        >
          <div className="bg-white rounded-2xl shadow-lg p-6 sm:p-8 w-full">
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
              Sign In to Gent
            </h1>

            <LoginForm />

            <div className="mt-4 text-center text-sm sm:text-base text-gray-600">
              Don&apos;t have an account?{' '}
              <a 
                href={AUTH_PATH.SIGNIN} 
                className="font-medium text-[#5A7863] hover:underline"
              >
                Register
              </a>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Footer Links */}
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
