# Phase 0 — recorded baseline

Recorded 2026-09-05 on darwin 25.6.0 (arm64).

## Tool versions

| Tool | Version |
| --- | --- |
| Node | v26.0.0 |
| Git (oracle / interop client only) | 2.50.1 (Apple Git-155) |
| Python | see `apps/server` baseline below |

Git is **never** invoked by production code. It appears only in
`tests/interop/**`, which is excluded from the default `npm test` run.

## CLI suite baseline (`npm test`)

```
node --check src/index.js                 ok
tests/diff.test.js
tests/merge.test.js
tests/hash.test.js
tests/merge-base.test.js
tests/file-system.test.js
tests/web-urls.test.js
  tests 65   pass 65   fail 0
tests/offline-e2e.js
  4 scenarios, all passed
```

No pre-existing failures were recorded. This is the regression floor: every phase must keep
these green, and legacy-format assertions may only change when the phase that
replaces that format lands with a documented breaking-change note.

## New suites added during review remediation

| Script | Purpose | Git allowed? |
| --- | --- | --- |
| `npm test` | Unit + offline e2e. Default gate. | no |
| `npm run test:independence` | Runs the engine with `git` removed from `PATH`, plus a source audit for subprocess use. | no (asserts absence) |
| `npm run test:interop` | Cross-checks Gent bytes against a real `git` binary. Skips with a recorded reason when git is absent or lacks SHA-256. | yes |

## Git SHA-256 capability probe

`git init --object-format=sha256` is supported by 2.50.1. The interop suite
records the probe result in its output; a `--object-format` failure marks the
whole interop suite `unsupported`, never `pass`.

The original implementation did not include the two additional scripts listed
above. Review remediation added executable runners and canonical regressions.
See [review-fixes.md](review-fixes.md) for current scope and limitations. The
original baseline above remains a record of the legacy tests, not evidence of
canonical-engine coverage.
