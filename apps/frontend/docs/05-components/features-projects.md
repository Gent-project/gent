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
| `branch-list.tsx`               | `<BranchList>`             | props (from `useBranches`)          | `/app/[ownerId]/[name]`                  |
| `tag-list.tsx`                  | `<TagList>`                | props (from `useTags`)              | `/app/[ownerId]/[name]`                  |
| `file-tree-row.tsx`             | `<FileTreeRow>`            | props (from `useTree`)              | `/app/[ownerId]/[name]/files`            |
| `file-viewer.tsx`               | `<FileViewer>`             | `useBlob`                           | `/app/[ownerId]/[name]/files`            |
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
<CommitTimeline commits={commits} ownerId={ownerId} name={name} />
```

A vertical timeline of `Commit` objects.

For each commit:

- Left rail: short SHA chip (`shortSha(sha)` from `src/lib/utils.ts`).
- Right: commit message (first line), author chip, `timeAgo(committed_at)`.
- Connector dots use the theme accent color and animate in with `staggerChildren`.
- Empty branches (placeholder SHA all zeroes) show a "no commits yet" empty state.

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

## `<FileTreeRow>`

```tsx
<FileTreeRow entry={entry} onOpen={(e) => setBlobSha(e.sha)} />
```

A single row in the tree:

- Folder icon vs file icon (based on `entry.type`).
- File mode (e.g. `100644`) as a muted suffix.
- Click handler differs by type:
  - `tree` → recurse into the subtree (the parent component swaps `currentSha`).
  - `blob` → opens the `<FileViewer>` with the blob's SHA.

---

## `<FileViewer>`

```tsx
<FileViewer ownerId={ownerId} name={name} sha={blobSha} onClose={...} />
```

- Calls `useBlob(ownerId, name, sha)`.
- If `blob.encoding === "utf-8"`, renders the content with simple line
  numbers and a monospace font.
- If `blob.encoding === "base64"`, shows a "Binary file" placeholder with the
  size in KB.
- Includes a copy-content button (utf-8 only).

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
