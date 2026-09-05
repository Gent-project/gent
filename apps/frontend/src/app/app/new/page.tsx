"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, GitBranch, Globe, Lock, Terminal } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { TextField } from "@/components/ui/text-field";
import { Button } from "@/components/ui/button";
import { useCreateRepo } from "@/hooks/use-repos";
import { useAuth } from "@/hooks/use-auth";
import { PATHS } from "@/lib/paths";
import { repoCloneUrl, installCommand } from "@/lib/gent-urls";

/**
 * New Project — full-page version (the modal still exists from the dashboard).
 *
 * Provides a richer layout where we can show the CLI snippet they'd use after
 * creation. Same network call, just better real-estate for guidance.
 */
export default function NewProjectPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { mutate, isPending } = useCreateRepo();
  const [form, setForm] = useState({
    name: "",
    description: "",
    is_private: false,
    default_branch: "main",
  });
  const [error, setError] = useState<string | undefined>();

  /**
   * The actual clone URL the CLI accepts. We don't know the new repo's id
   * until the server responds, so before submission we preview using the
   * signed-in user's id — that's almost always the same id the API will
   * assign as the new owner.
   */
  const previewName = form.name || "my-awesome-app";
  const previewCloneUrl = repoCloneUrl(user?.id ?? "{owner_id}", previewName);

  function set<K extends keyof typeof form>(key: K, value: typeof form[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      setError("A name is required.");
      return;
    }
    setError(undefined);
    mutate(form, {
      onSuccess: (created) =>
        router.push(PATHS.app.project(created.owner_id, created.name)),
    });
  }

  return (
    <AppShell
      title="Create a new project"
      subtitle="Set up a fresh repository. You'll get CLI instructions right after."
      actions={
        <Button asChild size="sm" variant="ghost">
          <Link href={PATHS.app.dashboard}>
            <ArrowLeft className="size-4" /> Back
          </Link>
        </Button>
      }
    >
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Form */}
        <form onSubmit={submit} className="lg:col-span-2 space-y-4" noValidate>
          <Card>
            <CardContent className="p-6 space-y-2">
              <TextField
                label="Project name"
                placeholder="my-awesome-app"
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                error={error}
                helperText="Lowercase letters and dashes work best."
                autoFocus
              />
              <TextField
                label="Description"
                placeholder="What is this project about? (optional)"
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
              />
              <TextField
                label="Default branch"
                placeholder="main"
                value={form.default_branch}
                onChange={(e) => set("default_branch", e.target.value)}
                leadingIcon={<GitBranch />}
              />

              <div className="pt-2">
                <span className="text-sm font-medium text-foreground">Visibility</span>
                <div className="mt-2 grid grid-cols-2 gap-3">
                  <VisToggle
                    selected={!form.is_private}
                    onClick={() => set("is_private", false)}
                    icon={<Globe className="size-4" />}
                    title="Public"
                    description="Anyone can find and clone this project."
                  />
                  <VisToggle
                    selected={form.is_private}
                    onClick={() => set("is_private", true)}
                    icon={<Lock className="size-4" />}
                    title="Private"
                    description="Only you can see it."
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" asChild>
              <Link href={PATHS.app.dashboard}>Cancel</Link>
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Creating…" : "Create project"}
            </Button>
          </div>
        </form>

        {/* Side helper */}
        <Card variant="outline" className="h-fit">
          <CardContent className="p-6 space-y-3 text-sm">
            <div className="inline-flex items-center gap-2 text-foreground font-semibold">
              <Terminal className="size-4 text-primary" /> After you create
            </div>
            <p className="text-on-surface-variant">
              First install the CLI from npm:
            </p>
            <pre className="rounded-xl bg-inverse-surface text-on-inverse-surface p-3 text-xs overflow-x-auto">
{installCommand}
            </pre>
            <p className="text-on-surface-variant">
              Then clone this project locally:
            </p>
            <pre className="rounded-xl bg-inverse-surface text-on-inverse-surface p-3 text-xs overflow-x-auto">
{`gent clone ${previewCloneUrl}`}
            </pre>
            <p className="text-on-surface-variant">
              Or initialise an empty project and push it up:
            </p>
            <pre className="rounded-xl bg-inverse-surface text-on-inverse-surface p-3 text-xs overflow-x-auto">
{`gent init
gent add .
gent commit -m "first commit"
gent remote add origin ${previewCloneUrl}
gent push origin ${form.default_branch || "main"}`}
            </pre>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

function VisToggle({
  selected,
  onClick,
  icon,
  title,
  description,
}: {
  selected: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left rounded-2xl border p-3 transition-all ${
        selected
          ? "border-primary bg-primary-container/40 ring-2 ring-primary/30"
          : "border-outline-variant hover:bg-surface-container-low"
      }`}
    >
      <div className="flex items-center gap-2 text-foreground font-medium">
        <span className="text-primary">{icon}</span>
        {title}
      </div>
      <p className="mt-1 text-xs text-on-surface-variant">{description}</p>
    </button>
  );
}
