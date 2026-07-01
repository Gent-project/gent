# UI Primitives

Files: `src/components/ui/*`

These are the building blocks every other component reaches for. They are
**themed** (use CSS custom properties from `globals.css`), **typed**, and
**stateless** — no data fetching, no Redux, no router.

| File              | Component         | Purpose                                                      |
|-------------------|-------------------|--------------------------------------------------------------|
| `avatar.tsx`      | `<Avatar>`        | Circular avatar with initial fallback + deterministic color  |
| `badge.tsx`       | `<Badge>`         | Pill-shaped label (status, count, "private", etc.)           |
| `button.tsx`      | `<Button>`        | All buttons — variants, sizes, loading state, `asChild`      |
| `card.tsx`        | `<Card>`          | Container with shadow, hover lift, optional header/footer    |
| `empty-state.tsx` | `<EmptyState>`    | Icon + headline + body + CTA for zero-results screens        |
| `input.tsx`       | `<Input>`         | Bare styled input (used inside `<TextField>` mostly)         |
| `label.tsx`       | `<Label>`         | Radix `Label` re-export with project styling                 |
| `logo.tsx`        | `<Logo>`          | Animated G-shaped logo, light/dark aware                     |
| `modal.tsx`       | `<Modal>`         | Centered modal with backdrop, focus trap, scale-in animation |
| `skeleton.tsx`    | `<Skeleton>`      | Pulsing rectangle for loading states                         |
| `text-field.tsx`  | `<TextField>`     | Label + Input + helper/error text, accessible by default     |

---

## `<Button>`

The most-used primitive. Powered by `class-variance-authority` (cva).

```tsx
<Button>Save</Button>
<Button variant="secondary">Cancel</Button>
<Button variant="ghost" size="sm">Edit</Button>
<Button variant="destructive">Delete</Button>
<Button disabled isLoading>Saving…</Button>

// asChild — turns the Button into a styled wrapper around another element
<Button asChild>
  <Link href={PATHS.app.dashboard}>Go to dashboard</Link>
</Button>
```

Variants: `default | secondary | ghost | outline | destructive | link`
Sizes:    `sm | default | lg | icon`

When you need a *button-shaped link*, use `asChild` and put `<Link>` inside —
do not duplicate styling on the link itself.

---

## `<TextField>`

The form input you should use 95% of the time. Renders `<Label>` + `<Input>` +
optional helper or error text, with the right `aria-*` wiring.

```tsx
<TextField
  label="Email"
  type="email"
  value={email}
  onChange={(e) => setEmail(e.target.value)}
  error={errors.email}                 // turns the border red and shows the message
  helper="We never share your email."  // shown when there is no error
  autoComplete="email"
  required
/>
```

Rules:

- If you find yourself writing a bare `<input>`, you are reinventing this.
- Errors are strings, not booleans — pass the message, not just `true`.
- The label is always rendered (visually hidden if you pass `srOnly`).

---

## `<Card>`

```tsx
<Card>
  <Card.Header>
    <h3>Repo name</h3>
    <Badge>private</Badge>
  </Card.Header>
  <Card.Body>...</Card.Body>
  <Card.Footer>
    <span>Updated 2 hours ago</span>
  </Card.Footer>
</Card>
```

Cards hover-lift by default. To opt out for a static card, pass `interactive={false}`.

---

## `<Modal>`

Powered by a focus-trap + backdrop + framer-motion scale-in.

```tsx
const [open, setOpen] = useState(false);

<Modal open={open} onClose={() => setOpen(false)} title="Create project">
  <CreateProjectForm onDone={() => setOpen(false)} />
</Modal>
```

Conventions:

- Always pass a `title` — it's the accessible name.
- The modal handles ESC and clicking the backdrop. Do not duplicate that logic.
- For destructive confirmations, use `variant="destructive"` on the Modal —
  the primary button becomes red.

---

## `<Avatar>`

```tsx
<Avatar email={user.email} name={user.first_name} />
<Avatar email="alice@example.com" size="lg" />
```

If no image URL is provided, it picks a stable color from
`avatarColors(email)` in `src/lib/utils.ts` and renders the first letter of
the name (or the email).

---

## `<Badge>`

```tsx
<Badge>private</Badge>
<Badge variant="success">live</Badge>
<Badge variant="warning">stale</Badge>
<Badge variant="muted">draft</Badge>
```

Variants: `default | success | warning | destructive | muted`.

---

## `<EmptyState>`

For zero-results, zero-data, or "you haven't done X yet" screens.

```tsx
<EmptyState
  icon={<GitBranch />}
  title="No branches yet"
  description="Push from the CLI to create your first branch."
  action={<Button asChild><Link href={PATHS.cli}>See CLI docs</Link></Button>}
/>
```

---

## `<Skeleton>`

Used inside loading states.

```tsx
<Card>
  <Skeleton className="h-6 w-1/2" />
  <Skeleton className="h-4 w-3/4 mt-2" />
</Card>
```

Pulses via Tailwind's `animate-pulse`. Always match the dimensions of the real
content — sliding skeletons into different sizes is the cardinal sin.

---

## Theming

Every primitive uses CSS variables defined in `src/app/globals.css`. The
notable ones are listed in [14-design-system.md](../14-design-system.md), but
in practice you don't need to know them — Tailwind utilities like
`bg-card`, `text-foreground`, `border-border` resolve to the right token
automatically.

---

## When to add a new primitive

Add a primitive when **the same JSX appears in three or more places** and
none of the existing ones fit. Premature primitives are worse than copy-paste
— if you only have two callers, leave them as `<div>` blocks until the third
one shows you the right shape.
