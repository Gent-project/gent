"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, ChevronLeft, ChevronRight, Copy, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { cloneCommand, installCommand, repoCloneUrl } from "@/lib/gent-urls";

/**
 * Interactive step-by-step guides shown from the project page.
 *
 * Each guide is a small "wizard": a sequence of titled steps, each with one
 * or more copyable command snippets, plus a short explanation of what the
 * step does. Users can copy and run them in order without leaving the page.
 *
 * Supported kinds:
 *  - `clone`       : how to install the CLI and clone this repo
 *  - `checkout`    : how to fetch and switch to a specific branch
 *  - `new-branch`  : how to create a new branch and push it
 */
export type GuideKind = "clone" | "checkout" | "new-branch";

interface Step {
  title: string;
  description: string;
  commands: string[];
}

export function InteractiveGuideModal({
  open,
  onClose,
  kind,
  ownerId,
  repoName,
  defaultBranch,
  targetBranch,
}: {
  open: boolean;
  onClose: () => void;
  kind: GuideKind;
  ownerId: number | string;
  repoName: string;
  defaultBranch: string;
  /** For `checkout` guides — the branch the user clicked. */
  targetBranch?: string;
}) {
  const guide = useMemo(
    () => buildGuide({ kind, ownerId, repoName, defaultBranch, targetBranch }),
    [kind, ownerId, repoName, defaultBranch, targetBranch],
  );
  const [stepIdx, setStepIdx] = useState(0);

  // Reset to step 0 every time the modal opens with a new kind/branch.
  const key = `${kind}-${targetBranch ?? ""}-${open}`;
  useMemo(() => setStepIdx(0), [key]);

  const step = guide.steps[stepIdx];
  const total = guide.steps.length;
  const isLast = stepIdx === total - 1;
  const isFirst = stepIdx === 0;

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={
        <span className="inline-flex items-center gap-2">
          <Sparkles className="size-5 text-primary" />
          {guide.title}
        </span>
      }
      description={guide.subtitle}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Done
          </Button>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => setStepIdx((i) => Math.max(0, i - 1))}
              disabled={isFirst}
            >
              <ChevronLeft className="size-4" /> Back
            </Button>
            {!isLast ? (
              <Button onClick={() => setStepIdx((i) => Math.min(total - 1, i + 1))}>
                Next <ChevronRight className="size-4" />
              </Button>
            ) : (
              <Button onClick={onClose}>Finish</Button>
            )}
          </div>
        </>
      }
    >
      {/* Stepper */}
      <ol className="mb-4 flex items-center gap-2">
        {guide.steps.map((s, i) => (
          <li key={i} className="flex-1">
            <button
              type="button"
              onClick={() => setStepIdx(i)}
              className="flex w-full items-center gap-2 group"
            >
              <span
                className={cn(
                  "inline-flex size-7 items-center justify-center rounded-full text-xs font-semibold transition-all",
                  i < stepIdx && "bg-secondary text-on-secondary",
                  i === stepIdx && "bg-primary text-on-primary ring-4 ring-primary/20",
                  i > stepIdx && "bg-surface-container text-on-surface-variant",
                )}
              >
                {i < stepIdx ? <Check className="size-3.5" /> : i + 1}
              </span>
              <span
                className={cn(
                  "hidden sm:block text-xs truncate transition-colors",
                  i === stepIdx
                    ? "text-foreground font-semibold"
                    : "text-on-surface-variant group-hover:text-foreground",
                )}
              >
                {s.title}
              </span>
            </button>
          </li>
        ))}
      </ol>

      <AnimatePresence mode="wait">
        <motion.div
          key={stepIdx}
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -12 }}
          transition={{ duration: 0.2 }}
        >
          <div className="flex items-center gap-2">
            <Badge tone="primary" size="sm">
              Step {stepIdx + 1} of {total}
            </Badge>
            <h3 className="text-base font-semibold">{step.title}</h3>
          </div>
          <p className="mt-2 text-sm text-on-surface-variant leading-relaxed">
            {step.description}
          </p>
          <ul className="mt-4 space-y-2">
            {step.commands.map((cmd, i) => (
              <CommandRow key={i} command={cmd} />
            ))}
          </ul>
        </motion.div>
      </AnimatePresence>
    </Modal>
  );
}

function CommandRow({ command }: { command: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(command).then(() => {
      setCopied(true);
      toast.success("Copied.");
      setTimeout(() => setCopied(false), 1200);
    });
  }
  return (
    <li className="group rounded-xl bg-inverse-surface text-on-inverse-surface px-3 py-2 flex items-start gap-3">
      <span className="text-primary font-mono select-none">$</span>
      <code className="flex-1 font-mono text-sm break-all">{command}</code>
      <button
        type="button"
        onClick={copy}
        aria-label="Copy command"
        className="rounded-md p-1 hover:bg-on-inverse-surface/10 transition"
      >
        {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
      </button>
    </li>
  );
}

/* ----------------------------------------------------------------------------
 * Guide definitions
 * --------------------------------------------------------------------------*/

function buildGuide({
  kind,
  ownerId,
  repoName,
  defaultBranch,
  targetBranch,
}: {
  kind: GuideKind;
  ownerId: number | string;
  repoName: string;
  defaultBranch: string;
  targetBranch?: string;
}): { title: string; subtitle: string; steps: Step[] } {
  const url = repoCloneUrl(ownerId, repoName);
  const clone = cloneCommand(ownerId, repoName);
  const branch = targetBranch ?? defaultBranch;

  if (kind === "clone") {
    return {
      title: `Clone ${repoName}`,
      subtitle: "Install the CLI, sign in, and pull this project to your machine.",
      steps: [
        {
          title: "Install the CLI",
          description:
            "Gent's CLI is published on npm as gent-cli. Install it globally so the `gent` command is available everywhere.",
          commands: [installCommand],
        },
        {
          title: "Sign in",
          description:
            "Authenticate the CLI with the same account you're using on the web. You only do this once per machine.",
          commands: ["gent login"],
        },
        {
          title: "Clone the repository",
          description:
            "Use the CLI-accepted clone URL — it embeds the owner id and repo name in the path the CLI expects.",
          commands: [clone, `cd ${repoName}`],
        },
        {
          title: "Verify",
          description:
            "Check the local copy. You should see this project's branches and the latest commits.",
          commands: ["gent status", "gent log", "gent branch"],
        },
      ],
    };
  }

  if (kind === "checkout") {
    return {
      title: `Checkout the "${branch}" branch`,
      subtitle:
        "Make sure your local copy has the latest branches, then switch your working tree to this branch.",
      steps: [
        {
          title: "Make sure your remote is set",
          description:
            "If you cloned this project the remote is already wired up. If you started from `gent init`, point it at this project first.",
          commands: [`gent remote add origin ${url}`],
        },
        {
          title: "Fetch the latest branches",
          description:
            "Pull the freshest data from the server so the branch ref is up to date locally.",
          commands: ["gent pull"],
        },
        {
          title: "Switch to the branch",
          description: `Move HEAD and your working tree to "${branch}". Your uncommitted changes are preserved — stash them first if there's a conflict.`,
          commands: [`gent checkout ${branch}`, "gent status"],
        },
        {
          title: "You're there",
          description:
            "You can now commit, push and merge on this branch. Run `gent log` to see its history.",
          commands: [`gent log`, `gent branch`],
        },
      ],
    };
  }

  // new-branch
  return {
    title: "Create a new branch",
    subtitle:
      "Branch from the latest default branch, push it to Gent, and start hacking.",
    steps: [
      {
        title: "Start from the latest default branch",
        description: `Switch to ${defaultBranch} and pull the freshest changes so your branch starts from the tip.`,
        commands: [`gent checkout ${defaultBranch}`, "gent pull"],
      },
      {
        title: "Create + switch in one step",
        description:
          "Replace `feature/your-name` with whatever describes the work you're about to do.",
        commands: [`gent checkout -b feature/your-name`],
      },
      {
        title: "Commit your work",
        description:
          "Stage your changes and make at least one commit before pushing.",
        commands: ["gent add .", 'gent commit -m "describe your change"'],
      },
      {
        title: "Push to the server",
        description:
          "Publish the branch so it shows up on the project page. The `-u` flag sets it as the upstream so future pushes are just `gent push`.",
        commands: [`gent push -u origin feature/your-name`],
      },
      {
        title: "Open it on the dashboard",
        description:
          "Refresh the Branches tab in a few seconds — your new branch will appear with its head commit.",
        commands: ["gent web"],
      },
    ],
  };
}
