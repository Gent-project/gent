# 18 — Testing

There are **no automated tests in the repo yet**. This document captures the
strategy we plan to follow when we add them, and the manual loop we use
today to verify changes.

---

## Current verification loop (manual)

1. `npm run dev`.
2. Log in with one of the test credentials in
   [01-getting-started.md](./01-getting-started.md).
3. Touch the area you changed:
   - Auth code → log in, log out, refresh after token expiry.
   - Repo code → create a repo, view detail, delete.
   - Git/file viewer → push a commit from the CLI, watch it appear.
   - UI primitive → exercise each variant in a story-like scratch page.
4. Open the React Query devtools and confirm caches behave as expected.
5. Run `npm run lint`.
6. Run `npm run build` to catch TS / type-route issues.

This loop catches roughly 90% of what we ship. It is also the bare minimum
before opening a PR.

---

## Planned test pyramid

```
                      ┌──────────────┐
                      │   E2E        │  Playwright, against the staging API
                      └──────────────┘
                  ┌──────────────────────┐
                  │   Component tests    │  Vitest + RTL, jsdom
                  └──────────────────────┘
              ┌─────────────────────────────┐
              │   Unit tests (utils, hooks) │  Vitest, no DOM
              └─────────────────────────────┘
```

### Unit tests (when added)

- Stack: **Vitest** (we want Vite's speed; Vitest is a drop-in JEST clone).
- Target: pure functions in `src/lib/`, plain reducers in `src/store/slices/`,
  and isolated logic in services (mocked axios).

Suggested file layout: colocated `*.test.ts(x)` next to the source.

### Component tests

- Stack: **Vitest + @testing-library/react + happy-dom (or jsdom)**.
- Target: primitives in `src/components/ui/` (variants render, ARIA roles
  exposed, keyboard navigation in `<Modal>`) and small feature components.
- Wrap renders in a helper that mounts the same provider stack we use in
  production (Redux store + QueryClient).

### E2E tests

- Stack: **Playwright**.
- Target: smoke flows — `/auth/login → /app → click into a repo → see
  commits`. Run against a long-lived test account on the staging API.
- Run on CI only; do not block local dev.

---

## What we explicitly **do not** want to test

- TanStack Query internals.
- framer-motion animations (too brittle, easy to break the test, no real
  signal).
- Static marketing copy.
- The Next App Router itself.

If a test takes more effort to keep green than the value it provides, delete
it. Tests are code, not credit-score points.

---

## Manual checks that should become automated

When we set up Vitest, these are the highest-value flows to start with:

| Area               | Test                                                                |
|--------------------|---------------------------------------------------------------------|
| `tokenStore`       | round-trip set/get/clear; handles missing localStorage              |
| `readApiError`     | each of the four error shapes returns a clean string                |
| `<Button>`         | all variants render the right Tailwind classes                      |
| `<Modal>`          | ESC closes; focus is trapped; backdrop click closes                 |
| `useAuth.login`    | sets Redux + TanStack cache on success; toasts on error             |
| `useDeleteRepo`    | optimistic remove + rollback on error                               |

---

## Linting & types

Until we have proper tests, `npm run lint` + `npm run build` are the safety
net.

- ESLint catches unused imports, missing keys, hooks-rule violations.
- `strict: true` in `tsconfig.json` catches the bulk of contract drift —
  most "did the API change?" failures show up as a red squiggle in `api.ts`.

---

## CI (recommended)

When we add CI, the pipeline should be:

```yaml
- npm ci
- npm run lint
- npm run build
- (when tests exist) npm test -- --run
```

Anything more is gold-plating; anything less doesn't catch real bugs.
