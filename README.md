# Gent Monorepo

A graduation project monorepo containing a Git-like version control system with a cloud-backed CLI and a planned Django REST API backend.

## Projects

| Project | Status | Description | Tech Stack |
|---|---|---|---|
| [CLI](apps/Cli/) | Active | Git-like VCS CLI with smart merge & cloud sync | Node.js 18+, Commander.js |
| [Server](apps/server/) | Planned | REST API backend for auth & repo hosting | Django (placeholder) |
| Web App | Planned | Web interface for repository management | React (not yet created) |

## What makes Gent "smart"

Beyond a faithful git-like workflow, the CLI adds:

- **diff3 three-way merge** with language-aware auto-resolution (JSON key merge, import unioning) that resolves more conflicts correctly and never merges unsafely.
- **`gent undo` / `gent redo`** — one-command safety net over an operation journal; friendlier than `git reflog`.
- **`gent resolve`** — interactive conflict resolver (Ours / Theirs / Both / Edit / Ask AI per hunk).
- **`gent summary`** — repository health dashboard; **`gent log --graph`** renders the commit DAG.
- **`gent explain`** — plain-language summary of any commit or staged diff.
- **Optional AI** (commit message suggestion, diff explanation, conflict resolution hint) — off by default, enabled with `ANTHROPIC_API_KEY`.

## Repository Structure

```
gent/
├── apps/
│   ├── Cli/              # Node.js CLI tool
│   │   ├── src/          # Commands and utilities
│   │   ├── tests/        # Unit + offline E2E tests (node:test)
│   │   └── docs/         # COMMANDS.md, ALGORITHMS.md, ARCHITECTURE.md
│   └── server/           # Django backend (placeholder)
├── README.md             # You are here
└── .gitignore
```

## Quick Start

### CLI

```bash
cd apps/Cli
npm install
npm link        # optional: make 'gent' available globally
gent --help
```

Run the test suite (syntax check + unit tests + offline E2E — no network needed):

```bash
cd apps/Cli
npm test
```

See the [CLI Quick Start](apps/Cli/QUICKSTART.md) for a guided workflow.

## Tech Stack

- **CLI**: Node.js **18+**, Commander.js, Axios, Chalk, Inquirer, Ora, Boxen
- **Backend**: Django REST Framework (planned)
- **Frontend**: React (planned)

## Documentation

| Document | What it covers |
|---|---|
| [CLI README](apps/Cli/README.md) | Full usage guide, all commands, remote workflow |
| [CLI Quick Start](apps/Cli/QUICKSTART.md) | Step-by-step tutorial + tips |
| [Command Reference](apps/Cli/docs/COMMANDS.md) | Every flag and option with examples |
| [Algorithms Deep Dive](apps/Cli/docs/ALGORITHMS.md) | diff3, LCS, merge-base, journal, AI layer |
| [Architecture](apps/Cli/docs/ARCHITECTURE.md) | Module layout, data formats, design decisions |

## Contributing

1. Fork the repository
2. Create a feature branch
3. Submit a Pull Request

## License

ISC

---

Built by [Abdalrahman Kanawati](https://github.com/abdo-ka)
