# Gent Monorepo

A graduation project monorepo containing a Git-like version control system with a cloud-backed CLI and a planned Django REST API backend.

## Projects

| Project | Status | Description | Tech Stack |
|---|---|---|---|
| [CLI](apps/Cli/) | Active | Git-like VCS CLI with cloud sync | Node.js, Commander.js |
| [Server](apps/server/) | Planned | REST API backend for auth & repo hosting | Django (placeholder) |
| Web App | Planned | Web interface for repository management | React (not yet created) |

## Repository Structure

```
gent/
├── apps/
│   ├── Cli/              # Node.js CLI tool
│   └── server/           # Django backend (placeholder)
├── README.md             # You are here
└── .gitignore
```

## Quick Start

### CLI

```bash
cd apps/Cli
npm install
npm link        # Optional: make 'gent' available globally
gent --help
```

See the [CLI README](apps/Cli/) for full documentation.

## Tech Stack

- **CLI**: Node.js 14+, Commander.js, Axios, Chalk, Inquirer, Ora
- **Backend**: Django REST Framework (planned)
- **Frontend**: React (planned)

## Documentation

- [CLI README](apps/Cli/README.md) — Full CLI usage guide
- [CLI Quick Start](apps/Cli/QUICKSTART.md) — Step-by-step tutorial
- [CLI Architecture](apps/Cli/docs/ARCHITECTURE.md) — Deep technical docs

## Contributing

1. Fork the repository
2. Create a feature branch
3. Submit a Pull Request

## License

ISC

---

Built by [Abdalrahman Kanawati](https://github.com/abdo-ka)
