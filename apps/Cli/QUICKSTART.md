# Quick Start Guide - Gent CLI

## Installation & Setup

```bash
# Navigate to the CLI directory
cd apps/Cli

# Install dependencies
npm install

# Test the CLI
node src/index.js --help
```

## Make it Globally Available (Optional)

```bash
# Link the CLI globally
npm link

# Now you can use 'gent' from anywhere
gent --help
```

## Your First Repository

### 1. Initialize
```bash
# Create a new directory
mkdir my-project
cd my-project

# Initialize gent repository
gent init
```

You'll be prompted for:
- Your name
- Your email
- Repository name
- Repository description

Or skip prompts with `-y`:
```bash
gent init -y
```

### 2. Add Files
```bash
# Create some files
echo "console.log('Hello');" > index.js

# Add to staging area
gent add index.js

# Or add all files
gent add .
```

### 3. Check Status
```bash
gent status
```

### 4. Commit Changes
```bash
# With message flag
gent commit -m "Initial commit"

# Or interactive
gent commit
```

### 5. View History
```bash
# See all commits
gent log

# Compact view
gent log --oneline

# Limit commits shown
gent log -n 5
```

## Working with Branches

### Create a Branch
```bash
gent branch feature-name
```

### Switch to Branch
```bash
gent checkout feature-name
```

### Create and Switch
```bash
gent checkout -b new-feature
```

### List Branches
```bash
gent branch
```

### Delete Branch
```bash
gent branch -d old-feature
```

## Common Workflows

### Feature Development
```bash
# Start a new feature
gent checkout -b feature-login

# Make changes
echo "// Login code" > login.js
gent add login.js
gent commit -m "Add login feature"

# View your work
gent log

# Switch back to main
gent checkout main
```

### Quick Commit All
```bash
# Stage and commit all changes
gent add .
gent commit -m "Update all files"
```

### Check What Changed
```bash
# See status
gent status

# Short format
gent status -s
```

## Tips & Tricks

1. **Use .gentignore** - Exclude files like `node_modules/`
2. **Commit Often** - Small commits are easier to track
3. **Descriptive Messages** - Write clear commit messages
4. **Branch for Features** - Keep main branch stable
5. **Check Status** - Always review before committing

## Running the Demo

See the CLI in action:

```bash
chmod +x demo.sh
./demo.sh
```

## Troubleshooting

**Not a gent repository error?**
```bash
# Make sure you initialized
gent init
```

**No changes to commit?**
```bash
# Add files first
gent add <files>
```

**Command not found?**
```bash
# Use node directly
node src/index.js <command>

# Or link globally
npm link
```

## Next Steps

- Read the full [README.md](README.md)
- Explore the [source code](src/)
- Try the [demo script](demo.sh)
- Build your own commands!

---

**Happy coding with Gent! 🚀**
