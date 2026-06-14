"use client";

import Link from "next/link";
import { useState } from "react";
import { Mail, Lock, User, Eye, EyeOff } from "lucide-react";

import { AuthShell } from "@/components/layout/auth-shell";
import { TextField } from "@/components/ui/text-field";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { PATHS } from "@/lib/paths";

/**
 * Signup page (POST /auth/register/).
 *
 * Matches the API's required fields exactly:
 *   email · password · password_confirm · first_name · last_name
 *
 * `password_confirm` is checked client-side before the network call so users
 * don't waste a request on a typo. The API will still re-validate.
 */
export default function SignupPage() {
  const { register, isRegistering } = useAuth();
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    password: "",
    password_confirm: "",
  });
  const [showPw, setShowPw] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof typeof form, string>>>({});

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function validate() {
    const next: typeof errors = {};
    if (!form.email.trim()) next.email = "Email is required.";
    else if (!/\S+@\S+\.\S+/.test(form.email)) next.email = "Enter a valid email.";
    if (!form.password) next.password = "Password is required.";
    else if (form.password.length < 8) next.password = "Minimum 8 characters.";
    if (form.password !== form.password_confirm)
      next.password_confirm = "Passwords don't match.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    register({
      email: form.email.trim(),
      password: form.password,
      password_confirm: form.password_confirm,
      first_name: form.first_name.trim() || undefined,
      last_name: form.last_name.trim() || undefined,
    });
  }

  return (
    <AuthShell title="Create your account" subtitle="Start tracking your code with Gent in seconds.">
      <form onSubmit={onSubmit} className="space-y-1" noValidate>
        <div className="grid grid-cols-2 gap-3">
          <TextField
            label="First name"
            placeholder="Ada"
            value={form.first_name}
            onChange={(e) => set("first_name", e.target.value)}
            leadingIcon={<User />}
          />
          <TextField
            label="Last name"
            placeholder="Lovelace"
            value={form.last_name}
            onChange={(e) => set("last_name", e.target.value)}
          />
        </div>
        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={form.email}
          onChange={(e) => set("email", e.target.value)}
          error={errors.email}
          leadingIcon={<Mail />}
        />
        <TextField
          label="Password"
          type={showPw ? "text" : "password"}
          autoComplete="new-password"
          placeholder="At least 8 characters"
          value={form.password}
          onChange={(e) => set("password", e.target.value)}
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
        <TextField
          label="Confirm password"
          type={showPw ? "text" : "password"}
          autoComplete="new-password"
          placeholder="Re-enter your password"
          value={form.password_confirm}
          onChange={(e) => set("password_confirm", e.target.value)}
          error={errors.password_confirm}
          leadingIcon={<Lock />}
        />

        <Button type="submit" size="lg" className="w-full mt-2" disabled={isRegistering}>
          {isRegistering ? "Creating account…" : "Create account"}
        </Button>

        <p className="text-center text-sm text-on-surface-variant pt-3">
          Already have an account?{" "}
          <Link href={PATHS.auth.login} className="text-primary font-semibold hover:underline">
            Sign in
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}
