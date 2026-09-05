"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { GitBranch, Lock, Globe, Sparkles } from "lucide-react";

import { Modal } from "@/components/ui/modal";
import { TextField } from "@/components/ui/text-field";
import { Button } from "@/components/ui/button";
import { useCreateRepo } from "@/hooks/use-repos";
import { PATHS } from "@/lib/paths";

/**
 * CreateProjectModal — used from the dashboard "New project" button.
 *
 * Posts to /repos/create/ via `useCreateRepo`, then navigates to the new
 * project page. The form intentionally stays inside a Modal so the user
 * doesn't lose their place on the dashboard.
 */
export function CreateProjectModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const { mutate, isPending } = useCreateRepo();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [defaultBranch, setDefaultBranch] = useState("main");
  const [error, setError] = useState<string | undefined>();

  function submit() {
    if (!name.trim()) {
      setError("A project name is required.");
      return;
    }
    if (!/^[a-zA-Z0-9._-]+$/.test(name)) {
      setError("Only letters, numbers, dots, dashes, underscores.");
      return;
    }
    setError(undefined);
    mutate(
      {
        name: name.trim(),
        description: description.trim() || undefined,
        is_private: isPrivate,
        default_branch: defaultBranch.trim() || undefined,
      },
      {
        onSuccess: (created) => {
          onClose();
          // Reset form for next open
          setName("");
          setDescription("");
          router.push(PATHS.app.project(created.owner_id, created.name));
        },
      },
    );
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        <span className="inline-flex items-center gap-2">
          <Sparkles className="size-5 text-primary" />
          Create a new project
        </span>
      }
      description="Spin up a fresh repository. You can clone it from your CLI right after."
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={isPending || !name.trim()}>
            {isPending ? "Creating…" : "Create project"}
          </Button>
        </>
      }
    >
      <div className="space-y-1">
        <TextField
          label="Project name"
          placeholder="my-awesome-app"
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={error}
          helperText="Lowercase letters and dashes work best."
          autoFocus
        />
        <TextField
          label="Description"
          placeholder="What is this project about? (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <TextField
          label="Default branch"
          placeholder="main"
          value={defaultBranch}
          onChange={(e) => setDefaultBranch(e.target.value)}
          leadingIcon={<GitBranch />}
        />

        <div className="pt-2">
          <span className="text-sm font-medium text-foreground">Visibility</span>
          <div className="mt-2 grid grid-cols-2 gap-3">
            <VisibilityOption
              selected={!isPrivate}
              onClick={() => setIsPrivate(false)}
              icon={<Globe className="size-4" />}
              title="Public"
              description="Anyone can see this project."
            />
            <VisibilityOption
              selected={isPrivate}
              onClick={() => setIsPrivate(true)}
              icon={<Lock className="size-4" />}
              title="Private"
              description="Only you can see it."
            />
          </div>
        </div>
      </div>
    </Modal>
  );
}

function VisibilityOption({
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
