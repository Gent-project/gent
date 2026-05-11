# Gent CLI

Gent is a Git-like version control CLI with cloud authentication and remote sync.

Global API URL:

```text
https://gent-api.onrender.com
```

The CLI is configured in `src/utils/constants.js` to use that deployed API. Do not use a local API URL for normal CLI work.

## Requirements

- Node.js 14 or newer
- Internet access to `https://gent-api.onrender.com`
- A Gent account, created with `gent register`

## Install

From npm:

```bash
npm install -g gent-cli
gent --help
```

From this repository:

```bash
cd apps/Cli
npm install
npm link
gent --help
```

Run without linking:

```bash
node src/index.js --help
```

## Full Step-by-Step Workflow

### 1. Create an account

Interactive:

```bash
gent register
```

Non-interactive:

```bash
gent register \
  -e user@example.com \
  -p StrongPass123! \
  --password-confirm StrongPass123! \
  --first-name YourFirstName \
  --last-name YourLastName
```

After registration, the CLI stores your encrypted auth tokens in:

```text
~/.gent/auth.json
```

### 2. Log in

Interactive:

```bash
gent login
```

Non-interactive:

```bash
gent login -e user@example.com -p StrongPass123!
```

### 3. Confirm the logged-in user

```bash
gent whoami
```

Expected result: your email, name, account ID, joined date, and active status.

### 4. Create a project folder

```bash
mkdir my-project
cd my-project
```

### 5. Initialize a Gent repository

```bash
gent init
```

This creates:

```text
.gent/
.gentignore
```

The `.gent` directory stores local commits, objects, branches, tags, staging data, and config.

### 6. Create a remote repository

```bash
gent repos --create my-project --description "My first Gent repository"
```

Expected output includes a remote path like:

```text
/api/repos/2/my-project
```

Keep this path. It is not a local URL. The CLI combines it with the global API URL:

```text
https://gent-api.onrender.com/api/repos/2/my-project
```

### 7. Link the local repo to the remote repo

Use the `/api/repos/<owner_id>/<repo_name>` path from the previous command:

```bash
gent remote add origin /api/repos/2/my-project
```

If the current folder is not initialized yet, `gent remote add` initializes `.gent` first, then adds the remote. You can still run `gent init` yourself before this step if you prefer the explicit flow.

Check it:

```bash
gent remote -v
```

Expected output:

```text
origin -> /api/repos/2/my-project
```

### 8. Create files

```bash
echo "Hello Gent" > README.md
mkdir src
echo "console.log('hello')" > src/index.js
```

### 9. Check status

```bash
gent status
```

Expected result: untracked files.

### 10. Stage files

Stage specific files:

```bash
gent add README.md src/index.js
```

Or stage everything:

```bash
gent add .
```

### 11. Review staged changes

```bash
gent diff --staged
```

Short summary:

```bash
gent diff --staged --stat
```

### 12. Commit

```bash
gent commit -m "Initial commit"
```

Expected result: a commit hash, author, date, tree hash, and file stats.

### 13. View history

```bash
gent log
gent log --oneline
gent show --no-patch
```

### 14. Push to the remote API

```bash
gent push
```

Expected result:

```text
Pushed 1 commit(s) to origin/main
```

Run it again to confirm nothing else needs syncing:

```bash
gent push
```

Expected result:

```text
Everything up-to-date
```

### 15. Clone from the remote API

Go outside your current project:

```bash
cd ..
gent clone /api/repos/2/my-project my-project-clone
cd my-project-clone
```

Check the cloned files:

```bash
cat README.md
gent status
gent log --oneline
```

### 16. Make another change in the original repo

```bash
cd ../my-project
echo "Second line" >> README.md
gent add README.md
gent commit -m "Update README"
gent push
```

### 17. Pull the change into the clone

```bash
cd ../my-project-clone
gent pull
cat README.md
gent status
```

Expected result: the clone fast-forwards, `README.md` includes the new line, and status shows no staged changes.

### 18. Create and sync a branch

From a repository with at least one commit and an `origin` remote:

```bash
gent branch feature-login
gent branch
```

Switch to the branch:

```bash
gent checkout feature-login
```

Make a change:

```bash
echo "feature work" > feature.txt
gent add feature.txt
gent commit -m "Add feature work"
gent push origin feature-login
```

Switch back to main:

```bash
gent checkout main
```

### 19. Merge a branch

```bash
gent merge feature-login
gent push
```

If there are conflicts, resolve the files, then:

```bash
gent add .
gent commit -m "Resolve merge"
gent push
```

### 20. Create and sync a tag

Create a lightweight tag:

```bash
gent tag v1.0.0
```

Create an annotated tag:

```bash
gent tag v1.0.1 -m "Release v1.0.1"
```

List tags:

```bash
gent tag
```

Delete a tag:

```bash
gent tag -d v1.0.0
```

### 21. Use stash when needed

Save local work:

```bash
gent stash
```

List stashes:

```bash
gent stash list
```

Apply latest stash:

```bash
gent stash pop
```

### 22. Log out

```bash
gent logout
```

Confirm:

```bash
gent whoami
```

Expected result: not logged in.

## One-Command Remote Repo Setup

You can initialize a local repo and create the remote repo in one command:

```bash
mkdir another-project
cd another-project
gent init --remote another-project
gent remote -v
```

This creates the remote repository on `https://gent-api.onrender.com` and configures `origin` automatically.

## Command Reference

### Authentication

```bash
gent register
gent register -e user@example.com -p StrongPass123! --password-confirm StrongPass123!
gent login
gent login -e user@example.com -p StrongPass123!
gent whoami
gent logout
```

### Repository Setup

```bash
gent init
gent init --remote my-repo
gent clone /api/repos/<owner_id>/<repo_name> [directory]
```

### Staging and Working Tree

```bash
gent status
gent status -s
gent add <files...>
gent add .
gent rm <files...>
gent rm <files...> --cached
gent reset [files...]
gent reset --soft <commit_hash>
gent reset --hard <commit_hash>
gent diff
gent diff --staged
gent diff --stat
```

### History

```bash
gent commit -m "Message"
gent log
gent log --oneline
gent log -n 5
gent show
gent show <commit_hash>
gent show --no-patch
```

### Branching and Merging

```bash
gent branch
gent branch <name>
gent branch -d <name>
gent checkout <branch>
gent checkout -b <branch>
gent merge <branch>
gent merge <branch> -m "Merge message"
```

### Tags

```bash
gent tag
gent tag <name>
gent tag <name> -m "Message"
gent tag -d <name>
```

### Remotes and Sync

```bash
gent repos
gent repos --create <name>
gent repos --create <name> --description "Description"
gent repos --create <name> --private
gent remote
gent remote -v
gent remote add origin /api/repos/<owner_id>/<repo_name>
gent remote set-url origin /api/repos/<owner_id>/<repo_name>
gent remote remove origin
gent push
gent push origin main
gent pull
gent pull origin main
```

## Remote URL Rules

The global API base is fixed:

```text
https://gent-api.onrender.com
```

Remote repository paths should be stored like this:

```text
/api/repos/<owner_id>/<repo_name>
```

Example:

```bash
gent remote add origin /api/repos/2/my-project
```

Do not use:

```text
http://localhost:8000
http://127.0.0.1:8000
```

## Files Created by Gent

Inside each repo:

```text
.gent/
├── config.json
├── commits.json
├── staging.json
├── HEAD
├── objects/
└── refs/

.gentignore
```

Global auth:

```text
~/.gent/auth.json
```

## Ignore Rules

Gent creates a `.gentignore` file by default:

```text
node_modules/
.DS_Store
*.log
.env
.gent/
```

Add project-specific ignored files there.

## Test the Full Remote Flow

This repository includes a remote-only E2E test. It uses only:

```text
https://gent-api.onrender.com
```

Run syntax checks:

```bash
npm test
```

Run the full remote scenario:

```bash
npm run test:remote:e2e
```

The test covers:

- API health check
- Register, login, whoami, logout
- Create and list remote repositories
- Init, remote add, status, add, diff, commit
- Push and up-to-date push
- Branch sync
- Tag sync
- Clone from remote
- Second commit and push
- Pull into clone and verify working tree content
- `init --remote`
- Unauthenticated guard
- Version flag

## Troubleshooting

### Command not found

Install or link the CLI:

```bash
npm install -g gent-cli
```

or:

```bash
cd apps/Cli
npm link
```

### Not authenticated

Log in again:

```bash
gent login
```

### Not a Gent repository

Run commands inside a folder initialized with:

```bash
gent init
```

### Remote not found

Add an origin remote:

```bash
gent remote add origin /api/repos/<owner_id>/<repo_name>
```

### Push says everything up-to-date

That means the local branch has no new commits compared to the last pushed remote ref.

### Render cold start

The deployed API may take several seconds to respond after inactivity. Retry the command if the first request times out.

## Version

Show the CLI version:

```bash
gent -V
gent --version
```

## License

ISC
