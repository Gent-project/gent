"use client";

import Link from "next/link";
import { useState } from "react";
import { Mail, Lock, Eye, EyeOff } from "lucide-react";

import { AuthShell } from "@/components/layout/auth-shell";
import { TextField } from "@/components/ui/text-field";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { PATHS } from "@/lib/paths";

/**
 * Login page (POST /auth/login/).
 *
 * The form is intentionally minimal — email + password — because the API
 * doesn't yet expose social auth or magic-link. Validation messages are
 * inline below each field and surface mistakes before the network round-trip.
 */
export default function LoginPage() {
  const { login, isLoggingIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  function validate() {
    const next: typeof errors = {};
    if (!email.trim()) next.email = "Email is required.";
    else if (!/\S+@\S+\.\S+/.test(email)) next.email = "That email doesn't look right.";
    if (!password) next.password = "Password is required.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    login({ email: email.trim(), password });
  }

  return (
    <AuthShell title="Welcome back" subtitle="Sign in to your Gent account.">
      <form onSubmit={onSubmit} className="space-y-2" noValidate>
        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={errors.email}
          leadingIcon={<Mail />}
        />
        <TextField
          label="Password"
          type={showPw ? "text" : "password"}
          autoComplete="current-password"
          placeholder="Enter your password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors.password}
          leadingIcon={<Lock />}
          trailingIcon={
            <button
              type="button"
              onClick={() => setShowPw((v) => !v)}
              className="hover:text-foreground transition"
              aria-label={showPw ? "Hide password" : "Show password"}
            >
              {showPw ? <EyeOff /> : <Eye />}
            </button>
          }
        />

        <Button type="submit" size="lg" className="w-full" disabled={isLoggingIn}>
          {isLoggingIn ? "Signing in…" : "Sign in"}
        </Button>

        <p className="text-center text-sm text-on-surface-variant pt-2">
          Don't have an account?{" "}
          <Link href={PATHS.auth.signup} className="text-primary font-semibold hover:underline">
            Create one
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}
