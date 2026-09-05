# Feature Components — Projects

Files: `src/components/features/projects/*`

The domain widgets that make up the dashboard, the project detail screen, and
the file browser. Each one is a focused, composable piece that reads from a
hook and renders UI.

| File                            | Component                  | Calls                              | Used by                                  |
|---------------------------------|----------------------------|------------------------------------|------------------------------------------|
| `project-card.tsx`              | `<ProjectCard>`            | props only                          | `/app` dashboard                         |
| `create-project-modal.tsx`      | `<CreateProjectModal>`     | `useCreateRepo`                     | `/app` dashboard CTA                     |
| `commit-timeline.tsx`           | `<CommitTimeline>`         | props (from `useCommits`)           | `/app/[ownerId]/[name]`                  |
| `commit-diff.tsx`               | `<CommitDiffPanel>`        | props (from `useCommitDiff`)        | `<CommitDiffModal>`                      |
| `commit-diff-modal.tsx`         | `<CommitDiffModal>`        | `useCommitDiff`                     | `/app/[ownerId]/[name]`, `…/files`       |
| `branch-list.tsx`               | `<BranchList>`             | props (from `useBranches`)          | `/app/[ownerId]/[name]`                  |
| `tag-list.tsx`                  | `<TagList>`                | props (from `useTags`)              | `/app/[ownerId]/[name]`                  |
| `file-viewer.tsx`               | `<FileViewer>`             | props (from `useBlob`)              | `/app/[ownerId]/[name]/files`            |
| `interactive-guide-modal.tsx`   | `<InteractiveGuideModal>`  | none                                | `/app/[ownerId]/[name]`                  |

---

## `<ProjectCard>`

```tsx
<ProjectCard repo={repo} />
```

Renders a clickable card with:

- Repo name + private/public `<Badge>`.
- Owner avatar + email.
- Description (or a muted "No description" placeholder).
- Default branch + `updatedAt` rendered via `timeAgo()`.
- Hover lift + framer-motion `whileHover` scale.

Links to `PATHS.app.project(repo.owner_id, repo.name)`.

---

## `<CreateProjectModal>`

Wraps a `<Modal>` with a form. Submits via `useCreateRepo().mutate(...)`.

Fields:

- `name` — required, lowercase + dashes only (validated locally).
- `description` — optional.
- `is_private` — toggle, defaults to `false`.
- `default_branch` — defaults to `main`.

On success:

- The modal closes.
- The query cache for the repo list is invalidated, so the new card appears.
- A toast confirms creation.
- Optionally redirects to the new project page (see `useCreateRepo`).

The dashboard uses this. The standalone `/app/new` page uses the same form
but renders it inline (no modal), because some users want a full-page flow
with the CLI snippet helper alongside.

---

## `<CommitTimeline>`

```tsx
<CommitTimeline commits={commits} isLoading={isLoading} onSelect={(c) => setDiffSha(c.sha)} />
```

A vertical timeline of `Commit` objects.

For each commit:

- Left rail: short SHA chip (`shortSha(sha)` from `src/lib/utils.ts`).
- Right: commit message (first line), author chip, `timeAgo(committed_at)`.
- Connector dots use the theme accent color and animate in with `staggerChildren`.
- Empty / loading: renders a `<Skeleton>` while `isLoading`, and a "no commits
  yet" empty state when the list is empty.

**Props:**

- `commits` — the `Commit[]` to render (typically from `useCommits`).
- `isLoading` — toggles the skeleton.
- `onSelect?` — optional. When provided, each row becomes an interactive card
  (button role, keyboard-activatable) and a "Changes ›" affordance appears.
  The project detail page passes `onSelect={(c) => setDiffSha(c.sha)}` to open
  `<CommitDiffModal>`. Omit it for a read-only timeline.

---

## `<CommitDiffPanel>`

```tsx
<CommitDiffPanel diff={diffQuery.data} isLoading={diffQuery.isLoading} error={diffQuery.error} />
```

Renders "what changed in this commit". Purely presentational — it takes a
`CommitDiffResult` (assembled by `useCommitDiff`) and never fetches anything
itself, so it can live in a modal, a drawer, or a page.

- **Header**: the commit (author, message, short SHA, time, parent SHA) plus a
  roll-up of files-changed and total `+additions` / `−deletions`.
- **Body**: one collapsible block per changed file. Each block has a status
  badge (`added` / `removed` / `modified`), the path, per-file `+/−` counts,
  and a unified two-gutter (old/new line number) line diff.
- Binary files, files above the diff size cap (`tooLarge`), and no-op changes
  render a short notice instead of a line table.

The diff data is computed client-side — see `src/lib/diff.ts` and
[10-hooks-reference.md](../10-hooks-reference.md) (`useCommitDiff`).

---

## `<CommitDiffModal>`

```tsx
<CommitDiffModal open={!!diffSha} onClose={() => setDiffSha(null)}
  ownerId={ownerId} name={name} sha={diffSha} />
```

A wide (`size="xl"`) `<Modal>` wrapper around `<CommitDiffPanel>`.

- Calls `useCommitDiff(ownerId, name, open && sha ? sha : undefined)` — the
  query only runs while the modal is open, so **opening it** is what triggers
  the tree/blob fetches. Commits are immutable, so the result is cached forever.
- Opened from the project detail **Commits** tab (`<CommitTimeline onSelect>`)
  and from the files page (the latest-commit bar and per-row commit messages).

---

## `<BranchList>`

```tsx
<BranchList branches={branches} ownerId={ownerId} name={name} />
```

Each row:

- Branch name (with a `default` badge for `repo.default_branch`).
- Latest commit short SHA (clickable, scrolls to the commit in the timeline).
- `updatedAt` via `timeAgo()`.
- "View files" button → `/app/[ownerId]/[name]/files?branch=<name>`.

---

## `<TagList>`

```tsx
<TagList tags={tags} />
```

Rows show the tag name, target short SHA, "annotated" badge if applicable,
and the tag message (truncated).

---

> **Note:** the file table on the files page is rendered by an inline `FileRow`
> in `files/page.tsx`, not a shared component. The old `<FileTreeRow>` (the
> left-tree row of the previous design) was removed when the page became the
> GitHub-style explorer.

## `<FileViewer>`

```tsx
<FileViewer
  fileName={pathToFile}
  blob={blobQuery.data}
  isLoading={blobQuery.isLoading}
  error={blobQuery.error}
/>
```

Presentational viewer for a single `Blob`. It no longer fetches — the files
page owns the `useBlob` query and passes the result (and `fileName`, the full
slash-joined path) down as props.

- If `blob.encoding === "utf-8"`, renders the content with line numbers and a
  monospace font, plus copy-to-clipboard and download buttons.
- If `blob.encoding === "base64"`, shows a "binary file" notice with a download
  button (it reconstructs the bytes from base64) instead of printing raw bytes.
- Header shows the encoding, size (`formatBytes`), and the blob's short SHA.

The viewer does **not** do syntax highlighting yet — adding `shiki` or
`highlight.js` is on the roadmap, but is intentionally not done yet to keep
the bundle small.

---

## `<InteractiveGuideModal>`

A multi-step modal that walks new users through their first push:

1. **Install** — copy `npm i -g @gent/cli` (or the equivalent).
2. **Login** — `gent login` with their account.
3. **Clone** — `gent clone <url>` (URL filled from the current repo).
4. **Edit** — make a change.
5. **Push** — `gent push origin main`.

Each step shows the command, an annotated screenshot, and "Next/Back" controls.
Persists `last completed step` in `localStorage.gent-guide-step` so closing
mid-flow resumes where the user left off.

---

## Patterns for adding a new feature component

1. Decide which hook it consumes. If none exists, add it under
   `src/hooks/` and a corresponding service function.
2. Compose from `ui/` primitives. Resist the urge to write new low-level CSS
   — there's almost always a primitive that fits.
3. Animations go through framer-motion's `motion.div` / `AnimatePresence`.
   The standard transitions live in `src/lib/utils.ts` (`stagger`, `fadeUp`).
4. Empty states use `<EmptyState>`. Loading states use `<Skeleton>`.
5. Add it to this doc.
