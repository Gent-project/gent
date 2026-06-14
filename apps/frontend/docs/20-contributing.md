# 20 — Contributing

A small guide for everyone working on the frontend.

---

## Branches

- `main` — always deployable. Protected; merge via PR.
- `frontend` — the long-running development branch most work lands on first.
- `feat/<short-name>` — feature branches; squash-merge into `frontend`.
- `fix/<short-name>` — bug fixes.

Avoid long-lived personal branches. Merge or rebase frequently.

---

## Commits

We use lightweight prefixes:

| Prefix     | Meaning                                                |
|------------|--------------------------------------------------------|
| `feat:`    | A new feature.                                         |
| `fix:`     | A bug fix.                                             |
| `chore:`   | Tooling, deps, non-functional changes.                 |
| `docs:`    | Documentation only.                                    |
| `refactor:`| Internal restructure with no behavior change.          |
| `style:`   | Whitespace / formatting only.                          |

Message format:

```
feat: add interactive guide modal to project page

The guide walks new users through clone → edit → push and persists the
last completed step in localStorage so closing mid-flow resumes correctly.
```

- Subject line: short, present tense, no trailing period.
- Body (optional): wrap at ~72 chars, focus on **why**.
- No emojis in commits. Save them for PR descriptions if you want.

---

## Pull requests

A good PR has:

1. **A short title** describing the change.
2. **A body** with:
   - What the PR does.
   - Why it's needed (link any issue/Slack/Linear context).
   - A short test plan — what you exercised manually.
3. **Small scope.** If you change 30 files, the PR is too big. Split it.
4. **No mixed concerns** — formatting + behavior changes in one PR are hard
   to review. Land them separately.

Reviewers should look for:

- The code change matches the PR description.
- New components have a primitive parent where appropriate.
- New API calls are typed and go through the service/hook layers.
- No `console.log` left in.
- Tailwind classes use semantic tokens (`bg-card`, not `bg-zinc-900`).
- Docs in `docs/` updated when an architectural facet changed.

---

## Code style

- **Imports**: use the `@/` alias. Order: external → `@/` → relative.
- **Types**: declare props as `type Props = { ... }` next to the component.
  Use `interface` only when you need declaration merging (rare).
- **Files**: one default-exported component per file. Internal helpers can
  be named exports in the same file if they're small.
- **Comments**: only when the *why* isn't obvious. Don't comment what the
  code does — the code already does that.
- **Naming**: be specific. `loadingState` is fine; `state` is not.

---

## Performance hygiene

- Don't `useMemo` reflexively. Most things don't need it.
- Don't `useCallback` reflexively. If you're passing the function to a
  memoized child, do it; otherwise skip.
- The big wins are not micro-memoization — they are not fetching what you
  don't need, and not animating things off-screen.

---

## Accessibility

- Every interactive element has a discernible label.
- Forms use `<TextField>` (which wires `<Label>`).
- Modals trap focus (handled by `<Modal>`).
- Color contrast follows the design tokens — don't hand-pick custom shades.
- Test keyboard navigation: Tab through every focusable element on your
  page before opening the PR.

---

## When in doubt

- Read the relevant `docs/` file before writing new code.
- If the doc is wrong, update it in the same PR as the code.
- If you can't find the doc, ask — that's a hint that we should write it.
