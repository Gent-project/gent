"use client";

import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { initializeTheme } from "@/store/slices/theme-slice";
import { RootState } from "@/store";

export default function ThemeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const dispatch = useDispatch();
  const isDark = useSelector((state: RootState) => state.theme.isDark);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    // Initialize theme from localStorage/system preference
    dispatch(initializeTheme());
    setIsHydrated(true);
  }, [dispatch]);

  useEffect(() => {
    if (!isHydrated) return;
    
    const htmlElement = document.documentElement;
    if (isDark) {
      htmlElement.classList.add("dark");
    } else {
      htmlElement.classList.remove("dark");
    }
  }, [isDark, isHydrated]);

  return <>{children}</>;
}
