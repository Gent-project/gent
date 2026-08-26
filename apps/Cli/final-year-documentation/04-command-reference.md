# 04 — Command Reference

This file explains all CLI commands currently registered in `src/index.js`.

## Command Categories

| Category | Commands |
|---|---|
| Start here | `auto`, `setup`, `init`, `clone` |
| Work on changes | `status`, `add`, `rm`, `reset`, `diff`, `commit` |
| History | `log`, `show`, `tag`, `explain`, `summary` |
| Branching and merging | `branch`, `checkout`, `merge`, `resolve`, `stash`, `undo`, `redo` |
| Remote and sync | `remote`, `repos`, `members`, `push`, `pull`, `search`, `web`, `share` |
| Account | `register`, `login`, `logout`, `whoami`, `password` |
| AI | `ai`, `ask`, `review`, `docs`, `changelog` |
| Templates | `template` |
| Help | `help` |

## Typical Local Workflow

```bash
gent init
gent status
gent add -A
gent diff --staged
gent commit -m "Initial commit"
gent log
```

## Typical Remote Workflow

```bash
gent register
gent login
gent repos --create my-project --description "Final year project"
gent remote add origin /api/repos/2/my-project
gent push
gent pull
```

## Setup Commands

| Command | Syntax | Description |
|---|---|---|
| `auto` | `gent auto` | Guided flow: sign in/register, initialize repo, link or create remote, stage, commit, and push. |
| `setup` | `gent setup` | Interactive first-run wizard for backend URL, login, AI key, and identity. |
| `init` | `gent init [-y] [--remote [name]]` | Creates `.gent/`, default config, staging file, commits file, refs, and `.gentignore`. |
| `clone` | `gent clone [url] [directory]` | Downloads a remote repository from the backend. |
| `doctor` | `gent doctor [--ai]` | Checks Node version, CLI version, repo status, auth, API connection, and optionally AI key. |
| `config` | `gent config list|get|set|unset|path` | Manages global CLI config such as AI key, API base URL, and default identity. |

## Working Tree and Staging Commands

| Command | Syntax | Description |
|---|---|---|
| `status` | `gent status [-s]` | Shows staged, modified, untracked, and deleted files. |
| `add` | `gent add <files...>` or `gent add -A` | Stores selected files as blobs and stages them. |
| `rm` | `gent rm <files...> [--cached]` | Removes files from tracking and optionally from disk. |
| `reset` | `gent reset [files...]` | Unstages files. |
| `reset --soft` | `gent reset --soft <hash>` | Moves branch pointer but keeps staging and working tree. |
| `reset --hard` | `gent reset --hard <hash>` | Moves branch pointer and restores working files to that commit. |
| `diff` | `gent diff [files...] [--staged] [--stat]` | Shows working or staged changes using unified diff. |
| `commit` | `gent commit [-m <message>] [-a] [--ai]` | Creates a commit from staged changes. |

## History Commands

| Command | Syntax | Description |
|---|---|---|
| `log` | `gent log [-n <count>] [--oneline] [--graph] [--stat]` | Shows commit history. |
| `show` | `gent show [ref] [--no-patch]` | Shows a commit and optionally its diff. |
| `tag` | `gent tag [name] [-m <message>] [-d <name>]` | Lists, creates, or deletes tags. |
| `summary` | `gent summary [--ai]` | Shows repository statistics and health summary. |
| `explain` | `gent explain [ref] [--staged]` | Explains a commit or staged changes. |

## Branching and Merge Commands

| Command | Syntax | Description |
|---|---|---|
| `branch` | `gent branch [name] [-d <name>] [-a]` | Lists, creates, or deletes branches. |
| `checkout` | `gent checkout <branch> [-b]` | Switches to a branch or creates then switches with `-b`. |
| `merge` | `gent merge <branch> [-m <message>]` | Merges another branch into the current branch using three-way merge. |
| `resolve` | `gent resolve` | Interactively resolves conflict markers created by merge. |
| `stash` | `gent stash [push|pop|list|drop|apply] [-m <message>] [-i <index>]` | Saves and restores temporary working-tree changes. |
| `undo` | `gent undo [-l]` | Reverses the last history-changing operation or lists operation history. |
| `redo` | `gent redo` | Re-applies the last undone operation. |

## Remote and Collaboration Commands

| Command | Syntax | Description |
|---|---|---|
| `remote` | `gent remote [add|remove|set-url] [args...] [-v]` | Manages remote repository URLs. |
| `repos` | `gent repos [--create <name>] [--description <text>] [--private] [--default-branch <name>]` | Lists or creates backend repositories. |
| `members` | `gent members [list|add|remove] [email] [--role <role>]` | Manages collaborators for a remote repository. |
| `push` | `gent push [remote] [branch] [-f]` | Uploads local commits, trees, blobs, branches, and tags. |
| `pull` | `gent pull [remote] [branch]` | Fetches and merges remote commits. |
| `search` | `gent search [query] [--mine] [--json]` | Searches repositories on the backend. |
| `web` | `gent web [--branch <name>] [--commit <hash>] [--print]` | Opens or prints a web URL for the current repo. |
| `share` | `gent share [--branch <name>] [--commit <hash>]` | Prints a shareable repository/branch/commit link. |

## Account Commands

| Command | Syntax | Description |
|---|---|---|
| `register` | `gent register [-e <email>] [-p <password>] [--password-confirm <password>] [--first-name <name>] [--last-name <name>]` | Creates a new account. |
| `login` | `gent login [-e <email>] [-p <password>]` | Logs in and stores JWT tokens locally. |
| `logout` | `gent logout` | Logs out and clears local authentication data. |
| `whoami` | `gent whoami` | Displays the current authenticated user. |
| `password` | `gent password [change|reset|reset-confirm] [-e <email>]` | Changes or resets account password. |

## AI and Productivity Commands

| Command | Syntax | Description |
|---|---|---|
| `ai` | `gent ai [status|test|models]` | Checks AI integration and available model guidance. |
| `ask` | `gent ask [question]` | Asks an AI question about the current repository. |
| `review` | `gent review [ref] [--staged] [--head]` | Performs an AI code review of staged changes, HEAD, or a commit. |
| `docs` | `gent docs [--write] [--section <name>]` | Generates a README draft using AI. |
| `changelog` | `gent changelog [range] [--plain]` | Generates a changelog from commit history. |

## Template Commands

| Command | Syntax | Description |
|---|---|---|
| `template list` | `gent template list` | Lists built-in starter templates. |
| `template use` | `gent template use <name> [directory]` | Creates a starter project from a built-in template. |

Available templates in the code include:

| Template | Description |
|---|---|
| `node` | Minimal Node.js project. |
| `python` | Minimal Python project. |
| `react` | Vite-style React skeleton. |
| `django` | Minimal Django project shell. |

## Demo Script for Presentation

Use this flow during the defense:

```bash
mkdir gent-demo
cd gent-demo
gent init -y
echo "Hello Gent" > app.txt
gent status
gent add app.txt
gent diff --staged
gent commit -m "Initial commit"
gent branch feature
gent checkout feature
echo "Feature line" >> app.txt
gent add app.txt
gent commit -m "Add feature line"
gent checkout main
echo "Main line" >> app.txt
gent add app.txt
gent commit -m "Add main line"
gent merge feature
gent log --graph
gent undo
gent redo
```

If the merge creates a conflict, show:

```bash
gent resolve
```

