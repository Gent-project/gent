"use client";

import { GitBranch } from "lucide-react";
import SignUpForm from "@/app/components/SignUpForm";
import AuthShell from "@/app/components/site/AuthShell";
import AnimatedTerminal from "@/app/components/site/AnimatedTerminal";

export default function SignUpPage() {
  return (
    <AuthShell
      showcase={
        <div>
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-line bg-surface/50 px-3 py-1.5 text-xs text-muted backdrop-blur">
            <GitBranch className="h-3.5 w-3.5 text-brand" /> Start with Gent
          </div>
          <h2 className="font-display text-4xl font-bold leading-tight">
            Your first repository is
            <span className="text-gradient"> one commit away.</span>
          </h2>
          <p className="mt-4 max-w-md text-muted">
            Create an account, install the CLI, and push code that shows up in
            your dashboard seconds later.
          </p>
          <div className="mt-8">
            <AnimatedTerminal />
          </div>
        </div>
      }
    >
      <h1 className="font-display text-3xl font-bold">Create account</h1>
      <p className="mt-1 text-sm text-muted">
        Start managing repositories with Gent.
      </p>
      <div className="mt-8">
        <SignUpForm />
      </div>
    </AuthShell>
  );
}
