# Gent CLI - A Git-like Version Control System

🚀 **Gent** is a lightweight, Git-inspired version control CLI tool built with Node.js. It provides essential version control features with an intuitive command-line interface.

## Features

- **Repository Initialization** - Set up new Gent repositories with custom configuration
- **File Staging** - Add files to staging area before committing
- **Commit Management** - Record changes with descriptive messages
- **Branch Operations** - Create, switch, and manage branches
- **Status Tracking** - View working tree status and changes
- **Commit History** - Browse commit logs with detailed information

## Installation

```bash
# Navigate to the CLI directory
cd apps/Cli

# Install dependencies
npm install

# Link globally (optional)
npm link
```

## Usage

### Initialize a Repository

Create a new Gent repository in the current directory:

```bash
gent init
```

With default configuration (skip prompts):

```bash
gent init -y
```

### Check Status

View the current state of your working tree:

```bash
gent status
```

Short format:

```bash
gent status -s
```

### Stage Files

Add files to the staging area:

```bash
# Add specific files
gent add file1.js file2.js

# Add all files
gent add --all
gent add .
```

### Commit Changes

Record changes to the repository:

```bash
# With inline message
gent commit -m "Your commit message"

# Interactive (will prompt for message)
gent commit
```

Auto-stage all modified files:

```bash
gent commit -a -m "Commit all changes"
```

### View Commit History

Display commit logs:

```bash
# Show last 10 commits (default)
gent log

# Show specific number of commits
gent log -n 5

# Compact oneline format
gent log --oneline
```

### Branch Management

List all branches:

```bash
gent branch
```

Create a new branch:

```bash
gent branch feature-name
```

Delete a branch:

```bash
gent branch -d branch-name
```

### Switch Branches

Switch to an existing branch:

```bash
gent checkout branch-name
```

Create and switch to a new branch:

```bash
gent checkout -b new-branch
```

## Project Structure

```
apps/Cli/
├── src/
│   ├── index.js              # Main entry point
│   ├── commands/             # Command implementations
│   │   ├── init.js          # Initialize repository
│   │   ├── status.js        # Show status
│   │   ├── add.js           # Stage files
│   │   ├── commit.js        # Create commits
│   │   ├── log.js           # View history
│   │   ├── branch.js        # Manage branches
│   │   └── checkout.js      # Switch branches
│   └── utils/               # Utility modules
│       ├── constants.js     # Application constants
│       ├── fileSystem.js    # File operations
│       └── helpers.js       # Helper functions
├── package.json             # Dependencies and scripts
└── README.md               # Documentation
```

## Repository Structure

When you initialize a Gent repository, it creates a `.gent` directory:

```
.gent/
├── config.json              # Repository configuration
├── staging.json             # Staged files
├── commits.json            # Commit history
├── HEAD                    # Current branch reference
├── objects/                # File objects (future use)
└── refs/                   # Branch references
    ├── heads/             # Branch pointers
    └── tags/              # Tag references
```

## Configuration

Gent stores configuration in `.gent/config.json`:

```json
{
  "user": {
    "name": "Your Name",
    "email": "your.email@example.com"
  },
  "repository": {
    "name": "project-name",
    "description": "Project description",
    "created": "2025-11-06T00:00:00.000Z"
  }
}
```

## Ignore Patterns

Create a `.gentignore` file to exclude files from tracking:

```
# Dependencies
node_modules/

# Build outputs
dist/
build/

# Environment files
.env
.env.local

# Logs
*.log

# OS files
.DS_Store
```

## Command Reference

| Command | Description | Options |
|---------|-------------|---------|
| `gent init` | Initialize repository | `-y, --yes` Skip prompts |
| `gent status` | Show working tree status | `-s, --short` Short format |
| `gent add <files>` | Stage files | `-A, --all` Stage all files |
| `gent commit` | Record changes | `-m <msg>` Message, `-a` Stage all |
| `gent log` | Show commit history | `-n <num>` Limit, `--oneline` Compact |
| `gent branch [name]` | Manage branches | `-d <name>` Delete, `-a` List all |
| `gent checkout <branch>` | Switch branches | `-b` Create new |
| `gent help [command]` | Show help | |

## Dependencies

- **commander** - CLI framework
- **chalk** - Terminal styling
- **inquirer** - Interactive prompts
- **ora** - Elegant terminal spinners
- **boxen** - Create boxes in terminal
- **date-fns** - Date formatting utilities

## Development

```bash
# Run locally
npm start

# Run specific command
node src/index.js init
node src/index.js status
```

## Examples

### Complete Workflow

```bash
# Initialize repository
gent init

# Add some files
echo "console.log('Hello');" > app.js
gent add app.js

# Commit changes
gent commit -m "Initial commit"

# Create a feature branch
gent branch feature-login
gent checkout feature-login

# Make changes and commit
echo "// Login logic" >> app.js
gent add app.js
gent commit -m "Add login feature"

# View history
gent log

# Switch back to main
gent checkout main
```

## Error Handling

Gent provides clear error messages:

- **Not a gent repository** - Run `gent init` first
- **No changes to commit** - Stage files with `gent add`
- **Branch not found** - Check available branches with `gent branch`

## Best Practices

1. **Commit Often** - Make small, focused commits
2. **Write Clear Messages** - Describe what and why
3. **Use Branches** - Isolate features and experiments
4. **Check Status** - Review changes before committing
5. **Update .gentignore** - Exclude unnecessary files

## Future Enhancements

- [ ] Diff visualization
- [ ] Remote repository support
- [ ] Merge functionality
- [ ] Tag management
- [ ] Stash implementation
- [ ] File restoration
- [ ] Conflict resolution

## License

ISC

## Author

Built with ❤️ using Node.js

---

**Note**: Gent is a learning project and educational tool. For production use, consider established version control systems like Git.
