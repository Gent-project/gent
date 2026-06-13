"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";
import { PATHS } from "@/lib/paths";
import { useAuth } from "@/hooks/use-auth";
import { ThemeToggle } from "./theme-toggle";
import { cn } from "@/lib/utils";

/**
 * Marketing-mode top nav.
 *
 * Sticks to the top of the viewport with a frosted-glass background once the
 * user scrolls past the hero. Links to public marketing pages on the left,
 * theme toggle + auth CTAs on the right.
 */
export function MarketingNav() {
  const [scrolled, setScrolled] = useState(false);
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <motion.header
      initial={{ y: -16, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className={cn(
        "sticky top-0 z-40 w-full transition-all",
        scrolled
          ? "glass border-b border-outline-variant/60"
          : "border-b border-transparent",
      )}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-8">
        <Link href={PATHS.home} className="flex items-center gap-2">
          <Logo size={28} />
        </Link>

        <nav className="hidden md:flex items-center gap-1 text-sm">
          {[
            { href: PATHS.cli, label: "CLI" },
            { href: "/#features", label: "Features" },
            { href: "/#how", label: "How it works" },
            { href: PATHS.faq, label: "FAQ" },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-full px-3 py-1.5 text-on-surface-variant hover:bg-surface-container-low hover:text-foreground transition"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          {isAuthenticated ? (
            <Button asChild size="sm" variant="primary">
              <Link href={PATHS.app.dashboard}>
                Dashboard <ArrowRight className="size-4" />
              </Link>
            </Button>
          ) : (
            <>
              <Button asChild size="sm" variant="ghost" className="hidden sm:inline-flex">
                <Link href={PATHS.auth.login}>Sign in</Link>
              </Button>
              <Button asChild size="sm" variant="primary">
                <Link href={PATHS.auth.signup}>
                  Get started <ArrowRight className="size-4" />
                </Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </motion.header>
  );
}
