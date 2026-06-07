# Gent CLI — Quick Start Guide

## Requirements

- Node.js **18 or newer**
- npm

## Installation

```bash
cd apps/Cli
npm install
node src/index.js --help
```

Make `gent` available globally:

```bash
npm link
gent --help
```

---

## Your First Repository

### 1. Initialize

```bash
mkdir my-project
cd my-project
gent init
```

Skip the interactive prompts:

```bash
gent init -y
```

### 2. Add Files

```bash
echo "console.log('Hello');" > index.js
gent add index.js
# or add everything
gent add .
```

### 3. Check Status

```bash
gent status
gent status -s   # short format
```

### 4. Commit

```bash
gent commit -m "Initial commit"
```

Let AI suggest a message from your staged diff (requires `ANTHROPIC_API_KEY`):

```bash
gent commit --ai
```

### 5. View History

```bash
gent log
gent log --oneline
gent log -n 5
gent log --graph   # ASCII commit graph with branches and merges
```

---

## Working with Branches

```bash
gent branch feature-name       # create
gent checkout feature-name     # switch
gent checkout -b new-feature   # create and switch
gent branch                    # list all
gent branch -d old-feature     # delete (undoable)
```

---

## Merging

```bash
gent checkout main
gent merge feature-login
```

If the merge is clean it commits automatically. If there are conflicts:

```bash
gent resolve        # walk each conflict hunk interactively → Ours / Theirs / Both / Edit / Ask AI
gent push
```

Or resolve markers by hand then:

```bash
gent add .
gent commit -m "Resolve merge"
```

---

## Common Workflows

### Feature development

```bash
gent checkout -b feature-login

echo "// Login code" > login.js
gent add login.js
gent commit -m "Add login feature"

gent checkout main
gent merge feature-login
gent log --graph
```

### Made a mistake? Undo it.

```bash
gent undo              # reverse the last commit / merge / reset / checkout
gent undo --list       # see what can be undone
gent redo              # re-apply the last undone operation
```

Undo never deletes your working files. For hard-reset / fast-forward merges it
also restores file content from the object store.

### Understand what changed

```bash
gent explain                  # explain the latest commit in plain language
gent explain <commit_hash>    # explain a specific commit
gent explain --staged         # explain what is currently staged
```

### Repository health

```bash
gent summary                  # branch counts, contributors, most-changed files, store size
gent summary --ai             # + a short AI-written health narrative
```

---

## Optional AI Features

All AI features are off by default and have a non-AI fallback.

```bash
export ANTHROPIC_API_KEY=sk-ant-...
export GENT_AI_MODEL=claude-haiku-4-5   # optional; default is claude-opus-4-8

gent commit --ai       # AI-suggested commit message
gent explain           # plain-language diff summary
gent resolve           # adds "Ask AI" option per conflict hunk
gent summary --ai      # health narrative
```

---

## Tips & Tricks

1. **Undo freely** — `gent undo` reverses history-changing commands without deleting files.
2. **Use `gent resolve` for conflicts** — faster than editing conflict markers by hand.
3. **Run `gent summary`** after a sprint to see who changed what and how big the repo has grown.
4. **`gent log --graph`** gives you a visual picture of your branch and merge history.
5. **Commit often** — small commits are easier to track and undo individually.
6. **Use `.gentignore`** — exclude `node_modules/`, `.env`, build artifacts.
7. **Descriptive messages** — `gent commit --ai` can help when you are stuck.
8. **Branch for features** — keep `main` stable.

---

## Troubleshooting

**Not a gent repository?**
```bash
gent init
```

**Nothing to commit?**
```bash
gent add <files>
gent status
```

**Command not found?**
```bash
# Run without linking
node src/index.js <command>
# Or link globally
npm link
```

**Merge left conflict markers?**
```bash
gent resolve       # interactive resolver
# or edit files, then:
gent add .
gent commit -m "Resolve conflicts"
```

**Undo went too far?**
```bash
gent redo
```

---

## Next Steps

- Full command reference: [docs/COMMANDS.md](docs/COMMANDS.md)
- How the algorithms work: [docs/ALGORITHMS.md](docs/ALGORITHMS.md)
- Architecture overview: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- Full workflow with remote sync: [README.md](README.md)
