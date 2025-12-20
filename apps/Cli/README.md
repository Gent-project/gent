# Gent CLI

> A modern, Git-like version control CLI with built-in cloud authentication and global user identity management.

`gent` is a lightweight version control system that feels exactly like Git but handles user identity automatically through the cloud. No more configuring `user.name` and `user.email` for every repository!

## 🚀 Features

- **Cloud Authentication**: Login once, work everywhere. Your identity follows you across projects.
- **Git-like Experience**: Familiar commands (`init`, `add`, `commit`, `status`, `log`, `branch`, `checkout`).
- **Zero Configuration**: `gent init` is silent and auto-detects your authenticated user profile.
- **Global Identity**: Commits are automatically authored with your cloud profile.
- **Secure**: Tokens stored securely in your home directory.

## 📦 Installation

```bash
npm install -g gent-cli
```

## 🔐 Authentication (The Magic mmss)

Gent uses a global authentication system. You only need to login once.

### Create an Account

```bash
gent register
```

### Login

```bash
gent login
# or
gent login -e user@example.com -p YourPassword
```

### Check Status

```bash
gent whoami
```

### Logout

```bash
gent logout
```

## 🛠 Usage

### 1. Initialize a Repository

Just like Git, `gent init` is silent and sets up a new repository in your current directory. It automatically uses your logged-in identity for configuration.

```bash
gent init
# Output: Initialized empty Gent repository in /path/to/project
```

### 2. Check Status

See which files are modified or untracked.

```bash
gent status
```

### 3. Stage Files

Add files to the staging area.

```bash
gent add filename.js
# or add all files
gent add .
```

### 4. Commit Changes

Create a commit. Gent automatically fetches your name and email from your global login session.

```bash
gent commit -m "Initial commit"
# Output: [main a1b2c3d] Initial commit
# Author: Your Name <your.email@example.com>
```

### 5. View History

See your commit history.

```bash
gent log
# or compact view
gent log --oneline
```

## 🌿 Branching

Manage branches just like you're used to.

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

## 📂 Repository Structure

Gent creates a `.gent` directory in your project root:

```
.gent/
├── config.json       # Project configuration
├── objects/          # Stored file contents
├── refs/             # Branch pointers
└── HEAD             # Current branch reference
```

Your authentication tokens are stored globally in `~/.gent/auth.json`.

## 🤝 Contributing

We welcome contributions! Please fork the repository and submit a Pull Request.

## 📄 License

ISC

---

Built with ❤️ by [Abdalrahman Kanawati](https://github.com/SaadShaya7)
