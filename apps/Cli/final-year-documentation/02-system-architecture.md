# 02 — System Architecture

## Architecture Summary

Gent CLI is organized into layers. The entry point parses commands, command modules coordinate workflows, utility engines perform core algorithms, and local files under `.gent/` store repository state.

```mermaid
flowchart TB
    A["src/index.js<br/>CLI entry point"] --> B["src/commands/<br/>Command handlers"]
    B --> C["src/utils/<br/>Core utilities and engines"]
    B --> D["src/services/<br/>Authentication service"]

    C --> E["Local project .gent/"]
    C --> F["Global ~/.gent/"]
    D --> G["Remote REST API"]
    B --> G

    E --> E1["objects/"]
    E --> E2["commits.json"]
    E --> E3["staging.json"]
    E --> E4["config.json"]
    E --> E5["journal.json"]

    F --> F1["auth.json"]
    F --> F2["cli-config.json"]
```

## Main Source Folders

| Path | Responsibility |
|---|---|
| `src/index.js` | Registers every CLI command using Commander.js and configures grouped help. |
| `src/commands/` | One module per user command, such as `add`, `commit`, `merge`, `push`, and `login`. |
| `src/utils/` | Reusable engines and helpers: hashing, diffing, merging, API client, storage, config, journal, AI. |
| `src/services/` | Service wrappers, currently authentication operations. |
| `tests/` | Unit and end-to-end tests. |
| `docs/` | Existing technical documentation. |
| `final-year-documentation/` | This final-year report package. |

## Runtime Command Flow

When the user runs a command:

1. Node executes `src/index.js` through the `gent` binary.
2. Commander.js parses the command name, arguments, and options.
3. The matching file in `src/commands/` runs.
4. The command reads local repository files from `.gent/`.
5. The command uses utility engines when algorithms are required.
6. If the command is remote/auth-related, it calls the backend through `api-client.js`.
7. The command prints a result to the terminal.

```mermaid
flowchart LR
    User["Terminal user"] --> Bin["gent command"]
    Bin --> Index["src/index.js"]
    Index --> Parser["Commander parser"]
    Parser --> Handler["Command handler"]
    Handler --> RepoFiles[".gent repository files"]
    Handler --> Engines["hash / diff / merge / journal engines"]
    Handler --> ApiClient["api-client.js"]
    ApiClient --> Backend["Gent backend API"]
```

## Layer Responsibilities

| Layer | Modules | Main Responsibility |
|---|---|---|
| CLI entry | `src/index.js` | Define command names, options, help groups, and global error handling. |
| Command layer | `src/commands/*.js` | Implement user workflows and coordinate storage/engines/API calls. |
| Engine layer | `hash-engine.js`, `diff-engine.js`, `merge-engine.js`, `journal.js` | Implement core version-control algorithms. |
| Storage layer | `fileSystem.js`, `.gent/*` | Read and write repository data. |
| Config/auth layer | `auth-storage.js`, `user-config.js`, `auth-service.js` | Store user identity, tokens, API URL, and AI config. |
| Network layer | `api-client.js`, `constants.js` | Communicate with backend endpoints using JWT authentication. |
| Optional AI layer | `ai-service.js` | Generate explanations, reviews, docs, changelogs, and commit messages if configured. |

## Local Repository Architecture

Each initialized project has a `.gent/` directory.

```mermaid
flowchart TD
    GentDir[".gent/"] --> Config["config.json<br/>repository config and remotes"]
    GentDir --> Commits["commits.json<br/>commits, branches, tags"]
    GentDir --> Staging["staging.json<br/>staged changes and merge state"]
    GentDir --> Objects["objects/<prefix>/<hash-rest><br/>compressed blobs and trees"]
    GentDir --> Head["HEAD<br/>current branch reference"]
    GentDir --> Journal["journal.json<br/>undo/redo snapshots"]
    GentDir --> Stash["stash.json<br/>temporary working changes"]
```

## Important Local Files

| File | Used By | Description |
|---|---|---|
| `.gent/config.json` | Remote, commit, init, push, pull | Repository metadata, user identity, remotes, and remote refs. |
| `.gent/commits.json` | Commit, log, branch, merge, checkout | Commit history, branch pointers, current branch, and tags. |
| `.gent/staging.json` | Add, status, diff, commit, resolve | Staged entries and active merge state. |
| `.gent/objects/` | Hash engine, commit, checkout, merge, push, pull | Compressed content-addressed blob and tree objects. |
| `.gent/journal.json` | Undo, redo | Operation history for recovery. |
| `.gent/stash.json` | Stash | Saved working-tree changes. |
| `.gentignore` | Add, status | Ignore rules for scanning working files. |

## Command Categories

```mermaid
mindmap
  root((Gent CLI))
    Setup
      auto
      setup
      init
      clone
      doctor
      config
    Local changes
      status
      add
      rm
      reset
      diff
      commit
    History
      log
      show
      tag
      summary
      explain
    Branching
      branch
      checkout
      merge
      resolve
      stash
      undo
      redo
    Remote
      remote
      repos
      members
      push
      pull
      search
      web
      share
    Account
      register
      login
      logout
      whoami
      password
    AI
      ai
      ask
      review
      docs
      changelog
    Templates
      template
```

## Commit Creation Architecture

```mermaid
sequenceDiagram
    participant User
    participant Commit as commit.js
    participant Stage as staging.json
    participant Hash as hash-engine.js
    participant Commits as commits.json
    participant Journal as journal.js

    User->>Commit: gent commit -m "message"
    Commit->>Stage: Read staged entries
    Commit->>Commits: Read current branch and parent commit
    Commit->>Hash: Store tree object
    Commit->>Journal: Record pre-operation branch state
    Commit->>Commits: Append commit and move branch pointer
    Commit->>Stage: Clear staging area
    Commit-->>User: Print commit summary
```

## Branch Merge Architecture

```mermaid
sequenceDiagram
    participant User
    participant MergeCmd as merge.js
    participant Repo as commits.json
    participant MergeEngine as merge-engine.js
    participant Store as object store
    participant Stage as staging.json

    User->>MergeCmd: gent merge feature
    MergeCmd->>Repo: Read current and source branch heads
    MergeCmd->>MergeEngine: findMergeBase()
    MergeCmd->>MergeEngine: mergeTreeEntries()
    MergeEngine->>Store: Read base/ours/theirs blobs
    MergeEngine->>Store: Store merged blob/tree
    alt clean merge
        MergeCmd->>Repo: Create merge commit
        MergeCmd-->>User: Merge completed
    else conflicts
        MergeCmd->>Stage: Save mergeState
        MergeCmd-->>User: Ask user to run gent resolve
    end
```

## Remote Synchronization Architecture

```mermaid
flowchart LR
    Local["Local Gent repository"] --> Push["gent push"]
    Push --> Pack["Build pack<br/>commits + trees + blobs + tags"]
    Pack --> Backend["Remote backend API"]
    Backend --> BranchRef["Update remote branch"]

    Backend --> Pull["gent pull"]
    Pull --> Store["Store fetched blobs"]
    Store --> MergeDecision{"Local branch<br/>fast-forward?"}
    MergeDecision -->|Yes| FF["Move branch pointer"]
    MergeDecision -->|No| Merge["Run three-way merge"]
```

## Authentication Architecture

Gent stores encrypted/obfuscated authentication state in the user-level `.gent` directory.

```mermaid
sequenceDiagram
    participant User
    participant Login as login/register command
    participant AuthService as auth-service.js
    participant API as Backend API
    participant Storage as ~/.gent/auth.json
    participant Client as api-client.js

    User->>Login: gent login
    Login->>AuthService: login(email, password)
    AuthService->>API: POST /api/auth/login/
    API-->>AuthService: user + access + refresh tokens
    AuthService->>Storage: Save encrypted tokens
    Client->>Storage: Read access token before requests
    Client->>API: Authenticated request
    API-->>Client: 401 if expired
    Client->>API: Refresh token request
    API-->>Client: New access/refresh tokens
    Client->>Storage: Persist rotated tokens
```

## Design Strengths

| Strength | Explanation |
|---|---|
| Modular design | Each command is isolated in its own file, making the code easier to maintain. |
| Clear engine separation | Hashing, diffing, merging, and journaling are reusable and testable. |
| Local-first behavior | Core commands work offline; remote commands are optional. |
| Recoverability | Journal-based undo/redo reduces risk during history operations. |
| Educational value | Algorithms are implemented directly rather than hidden behind Git libraries. |
| Extensibility | New commands can be added by creating a command module and registering it in `index.js`. |

