"use client";

import { motion } from "framer-motion";
import { useSelector } from "react-redux";
import { RootState } from "@/store";
import { useState, useEffect } from "react";
import { X, Check, Cookie } from "lucide-react";

export default function CookieConsent() {
  const isDark = useSelector((state: RootState) => state.theme.isDark);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Show after 1 second delay on every page load
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  const handleAccept = () => {
    localStorage.setItem("cookieConsent", "accepted");
    setIsVisible(false);
  };

  const handleReject = () => {
    localStorage.setItem("cookieConsent", "rejected");
    setIsVisible(false);
  };

  if (!isVisible) {
    return null;
  }

  return (
    <motion.div
      initial={{ y: 400, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 400, opacity: 0 }}
      transition={{ duration: 0.6, ease: "easeOut", type: "spring", stiffness: 100 }}
      className={`fixed bottom-0 left-0 right-0 z-50 p-4 sm:p-6 ${
        isDark
          ? "bg-[#0f1419]/95 border-t border-white/20"
          : "bg-[#bed19e]/95 border-t border-[#2d3e2d]/20"
      } backdrop-blur-xl shadow-2xl`}
    >
      <div className="max-w-7xl mx-auto">
        <motion.div 
          className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.5 }}
        >
          <motion.div 
            className="flex-1"
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.5 }}
          >
            <div className="flex items-center gap-2 mb-2">
              <Cookie className={`w-5 h-5 ${isDark ? "text-[#7dd3fc]" : "text-[#5A7863]"}`} />
              <h3 className={`text-lg font-semibold ${
                isDark ? "text-white" : "text-[#2d3e2d]"
              }`}>
                Cookie Consent
              </h3>
            </div>
            <p className={`text-sm ${
              isDark ? "text-white/70" : "text-[#2d3e2d]/70"
            }`}>
              We use cookies to enhance your experience, analyze site traffic, and serve personalized content. By clicking "Accept All", you consent to our use of cookies. You can manage your preferences or reject non-essential cookies.
            </p>
          </motion.div>

          <motion.div 
            className="flex gap-3 flex-shrink-0 w-full sm:w-auto"
            initial={{ x: 20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.5 }}
          >
            <motion.button
              onClick={handleReject}
              className={`flex-1 sm:flex-none px-4 py-2 rounded-lg border transition-all font-medium text-sm flex items-center justify-center gap-2 ${
                isDark
                  ? "border-white/30 text-white/80 hover:bg-white/10"
                  : "border-[#2d3e2d]/30 text-[#2d3e2d] hover:bg-[#2d3e2d]/10"
              }`}
              whileHover={{ scale: 1.08, y: -2 }}
              whileTap={{ scale: 0.95 }}
              transition={{ type: "spring", stiffness: 400, damping: 10 }}
            >
              <X className="w-4 h-4" />
              Reject
            </motion.button>
            
            <motion.div
              className="relative flex-1 sm:flex-none"
              whileHover="hover"
              initial="initial"
            >
              {/* Glow effect */}
              <motion.div
                className={`absolute inset-0 rounded-lg blur-lg opacity-0 ${
                  isDark
                    ? "bg-[#7dd3fc]"
                    : "bg-[#5A7863]"
                }`}
                variants={{
                  initial: { opacity: 0, scale: 0.8 },
                  hover: { opacity: 0.5, scale: 1.1 }
                }}
                transition={{ duration: 0.3 }}
              />
              
              {/* Button */}
              <motion.button
                onClick={handleAccept}
                className={`relative w-full px-6 py-2 rounded-lg transition-all font-medium text-sm flex items-center justify-center gap-2 ${
                  isDark
                    ? "bg-gradient-to-r from-[#7dd3fc] to-[#06b6d4] text-[#0f1419] hover:shadow-xl hover:shadow-cyan-500/50"
                    : "bg-gradient-to-r from-[#5A7863] to-[#4a6853] text-white hover:shadow-xl hover:shadow-green-500/50"
                }`}
                whileHover={{ scale: 1.08, y: -2 }}
                whileTap={{ scale: 0.95 }}
                transition={{ type: "spring", stiffness: 400, damping: 10 }}
              >
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                >
                  <Check className="w-4 h-4" />
                </motion.div>
                Accept All
              </motion.button>
            </motion.div>
          </motion.div>
        </motion.div>
      </div>
    </motion.div>
  );
}
