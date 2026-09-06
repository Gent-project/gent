# Git compatibility release evidence

Recorded 2026-09-06 on macOS 26.6 arm64.

## Automated gates

| Gate | Result |
|---|---|
| Gent canonical suite | Pass: 25 tests |
| Gent with `git` removed from `PATH` | Pass: 25 tests |
| Independent Git byte/index/pack interoperability | Pass: 4 tests |
| Live smart-HTTP Git/Gent round trips | Pass: Git push/clone/fetch and Gent clone/fetch/pull/push |
| Django API suite | Pass: 208 tests; 1 platform skip |
| PostgreSQL publication concurrency | Pass: PostgreSQL 16 Alpine; exactly one concurrent stale update won |
| Frontend ESLint and TypeScript | Pass; ESLint reports 21 pre-existing warnings and no errors |
| Frontend production build | Earlier pass; final rerun blocked while fetching configured Google Fonts by exhausted Codex approval usage |

## Tool matrix

`Pass` means that operation was exercised. `Not installed` is distinct from a protocol failure. UI checks must be rerun on the graduation machine after changing a tool version.

| Tool | Exact version | Discovery | Graph | Status | Checkout | Fetch | Push |
|---|---|---:|---:|---:|---:|---:|---:|
| Git CLI | Apple Git 2.50.1, SHA-256 enabled | Pass | Pass | Pass | Pass | Pass | Pass |
| VS Code SCM | 1.136.1 arm64 | SHA-256 check pending | n/a | SHA-256 check pending | SHA-256 check pending | SHA-256 check pending | SHA-256 check pending |
| Git Graph | 1.30.0 | SHA-256 check pending | SHA-256 check pending | n/a | SHA-256 check pending | SHA-256 check pending | SHA-256 check pending |
| GitLens | 18.1.0 | SHA-256 check pending | SHA-256 check pending | SHA-256 check pending | SHA-256 check pending | SHA-256 check pending | SHA-256 check pending |
| lazygit | Not installed | Not installed | Not installed | Not installed | Not installed | Not installed | Not installed |
| tig | Not installed | Not installed | Not installed | Not installed | Not installed | Not installed | Not installed |
| GitKraken | Not installed | Not installed | Not installed | Not installed | Not installed | Not installed | Not installed |

VS Code integrations are installed, but their SHA-256 operation cells remain pending until each operation is exercised against a canonical Gent repository. Results are never inferred from Git CLI behavior.

## Deployment contract

- Smart HTTP uses exact, redirect-free `.git` routes and protocol MIME types.
- Receive requests are capped at 128 MiB compressed and inflated, with 32 MiB per object and delta-depth limits.
- Upload responses are assembled in a 4 MiB memory spool and streamed in 64 KiB chunks. Client disconnect closes the spool.
- Gunicorn defaults to four workers with a 300-second timeout; both values are configurable through `GENT_GUNICORN_WORKERS` and `GENT_GUNICORN_TIMEOUT`. PostgreSQL serializes ref publication through a repository row lock; this was exercised against PostgreSQL 16 Alpine.
- Render must preserve request bodies and streaming responses on the four smart-HTTP routes. Re-run the live HTTP interoperability suite after each proxy or worker configuration change.

Unsupported repository features remain explicit in `src/utils/feature-support.json`.
