# Gent CLI

![npm](https://img.shields.io/npm/v/gent-cli)
![downloads](https://img.shields.io/npm/dw/gent-cli)

> A modern, Git-like version control CLI with built-in cloud authentication and global user identity management.

Gent is a lightweight version control system that feels like Git but handles user identity automatically through the cloud. No more configuring `user.name` and `user.email` for every repository.

## Highlights

- **Cloud Authentication** — Login once, work everywhere. JWT-based auth with automatic token refresh.
- **Git-like Experience** — Familiar commands: `init`, `add`, `commit`, `status`, `log`, `branch`, `checkout`, `merge`, `push`, `pull`, `clone`, and more.
- **Zero Configuration** — `gent init` auto-detects your authenticated user profile.
- **Global Identity** — Commits are automatically authored with your cloud profile.
- **Content-Addressable Storage** — SHA-256 object store with zlib compression and deduplication.
- **Smart Diff & Merge** — Line-level LCS diff, three-way merge with conflict detection.
- **Remote Sync** — Push, pull, and clone repositories from the cloud backend.
- **Secure** — Tokens stored with AES encryption in `~/.gent/auth.json`.

## Table of Contents

- [Requirements](#requirements)
- [Installation](#installation)
- [Quickstart](#quickstart)
- [Authentication](#authentication)
- [Commands](#commands)
  - [Repository Setup](#repository-setup)
  - [Staging & Working Tree](#staging--working-tree)
  - [History](#history)
  - [Branching & Merging](#branching--merging)
  - [Remote & Sync](#remote--sync)
  - [Authentication Commands](#authentication-commands)
- [Usage Examples](#usage-examples)
- [Repository Structure](#repository-structure)
- [Configuration](#configuration)
- [Docs](#docs)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [License](#license)

## Requirements

- Node.js >= 14

## Installation

```bash
npm install -g gent-cli
```

Run locally without installing:

```bash
cd apps/Cli
npm install
node src/index.js --help
```

## Quickstart

```bash
# 1) Authenticate
gent login

# 2) Initialize a repo
gent init

# 3) Make a first commit
gent add .
gent commit -m "Initial commit"
```

## Authentication

Gent uses a global authentication system. You only need to log in once.

### Register a New Account

```bash
gent register
```

### Login

```bash
gent login
# or with flags
gent login -e user@example.com -p YourPassword
```

### Check Current User

```bash
gent whoami
```

### Logout

```bash
gent logout
```

## Commands

### Repository Setup

| Command | Description |
|---|---|
| `gent init [-y]` | Initialize a new Gent repository in the current directory. Use `-y` to skip prompts. |
| `gent clone <url> [directory]` | Clone a remote repository from the cloud backend. |

### Staging & Working Tree

| Command | Description |
|---|---|
| `gent status [-s]` | Show the working tree status. Use `-s` for short format. |
| `gent add <files...> [-A]` | Add files to the staging area. Use `-A` or `--all` to add all files. |
| `gent rm <files...> [--cached]` | Remove files from the working tree and staging area. Use `--cached` to keep the file on disk. |
| `gent reset [files...] [--hard <hash> \| --soft <hash>]` | Unstage files or reset HEAD to a specific commit. |
| `gent diff [files...] [--staged] [--stat]` | Show changes between working tree, staging area, and commits. |

### History

| Command | Description |
|---|---|
| `gent commit [-m <message>] [-a]` | Record changes to the repository. Use `-a` to auto-stage all modified files. |
| `gent log [-n <count>] [--oneline] [--stat]` | Show commit history. Default limit is 10 commits. |
| `gent show [ref] [--no-patch]` | Show commit details and diff. |
| `gent tag [name] [-m <message>] [-d <name>]` | Create, list, or delete tags. |

### Branching & Merging

| Command | Description |
|---|---|
| `gent branch [name] [-d <name>] [-a]` | List, create, or delete branches. |
| `gent checkout <branch> [-b]` | Switch branches. Use `-b` to create and switch to a new branch. |
| `gent merge <branch> [-m <message>]` | Merge a branch into the current branch using a three-way smart merge. |
| `gent stash [pop \| list \| drop \| apply] [-m <message>] [-i <index>]` | Stash working tree changes. |

### Remote & Sync

| Command | Description |
|---|---|
| `gent remote [add \| remove \| set-url] [args...] [-v]` | Manage remote connections. |
| `gent push [remote] [branch] [-f]` | Push local commits to the remote. Use `-f` to force push. |
| `gent pull [remote] [branch]` | Pull and merge remote commits into the current branch. |

### Authentication Commands

| Command | Description |
|---|---|
| `gent register` | Create a new user account interactively. |
| `gent login [-e <email>] [-p <password>]` | Log in to your account. |
| `gent logout` | Log out and clear stored tokens. |
| `gent whoami` | Display the currently logged-in user. |

## Usage Examples

### Initialize a Repository

```bash
gent init
# Output: Initialized empty Gent repository in /path/to/project
```

### Stage and Commit

```bash
gent add .
gent commit -m "Initial commit"
```

### Work with Branches

```bash
# Create and switch to a new branch
gent checkout -b feature-login

# List branches
gent branch

# Switch back to main
gent checkout main

# Delete a branch
gent branch -d feature-login
```

### View History

```bash
gent log
gent log --oneline
gent log -n 5
```

### Remote Workflow

```bash
# Add a remote
gent remote add origin https://gent-api.onrender.com/api/repos/123/

# Push to remote
gent push origin main

# Pull from remote
gent pull origin main

# Clone a repository
gent clone https://gent-api.onrender.com/api/repos/123/ my-project
```

## Repository Structure

Gent creates a `.gent` directory in your project root:

```
.gent/
├── config.json       # Project configuration, remotes, user info
├── commits.json      # Full commit history, branches, and tags
├── staging.json      # Current staging area
├── stash.json        # Stashed changes (created on first stash)
├── HEAD              # Current branch reference
├── objects/          # Content-addressable blob and tree store
│   ├── ab/           # First 2 characters of SHA-256 hash
│   │   └── cdef...   # zlib-compressed object
│   └── ...
└── refs/
    ├── heads/        # Branch references (reserved for future use)
    └── tags/         # Tag references (reserved for future use)
```

Your authentication tokens are stored globally in `~/.gent/auth.json`.

## Configuration

### Ignore Files

Create a `.gentignore` file in your repository root to exclude files from tracking:

```
node_modules/
dist/
.env
*.log
```

Default ignored patterns include: `.gent`, `node_modules`, `.git`, `.DS_Store`, `.env`, `dist`, `build`, `coverage`, `.vscode`, `.idea`, and `*.log`.

### Remotes

Remotes are stored in `.gent/config.json`:

```json
{
  "remotes": {
    "origin": {
      "url": "https://gent-api.onrender.com/api/repos/123/"
    }
  }
}
```

## Troubleshooting

**Command not found?**

Make sure the CLI is linked globally:
```bash
npm link
```

Or run it directly:
```bash
node src/index.js <command>
```

**Not a Gent repository?**

Run `gent init` in your project directory first.

**No changes to commit?**

Stage files with `gent add <files>` before committing.

**Authentication errors?**

Run `gent login` to refresh your session. Tokens expire automatically and should refresh; if not, log in again.

## Docs

- [QUICKSTART.md](QUICKSTART.md)
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)

## Contributing

Contributions are welcome! Please fork the repository and submit a Pull Request.

## License

ISC

---

Built with love by [Abdalrahman Kanawati](https://github.com/abdo-ka)
