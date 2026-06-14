# 14 — Design System

A small, opinionated design system: one font, one color palette (light + dark),
a small set of primitives, and a consistent motion vocabulary.

---

## Palette

Tokens live in `src/app/globals.css` as CSS custom properties. The light
theme is the default; the `dark` class on `<html>` swaps the values.

```css
:root {
  --background:   color;     /* the page background */
  --foreground:   color;     /* default text color */
  --card:         color;     /* surface above the page */
  --card-foreground: color;
  --muted:        color;     /* secondary surfaces (e.g. inputs) */
  --muted-foreground: color;
  --border:       color;
  --ring:         color;     /* focus ring */
  --accent:       color;     /* brand color — used sparingly */
  --accent-foreground: color;
  --destructive:  color;
  --destructive-foreground: color;
  /* ...semantic state tokens: success, warning */
}

.dark {
  /* same names, inverted values */
}
```

Tailwind v4 maps these to utility classes (`bg-card`, `text-foreground`,
`border-border`, `ring-ring`). Use the semantic name, never a hex value, in
component code.

---

## Typography

**Cairo** — Latin + Arabic, loaded via `next/font/google` in `app/layout.tsx`:

```ts
import { Cairo } from "next/font/google";

const cairo = Cairo({
  subsets: ["latin", "arabic"],
  display: "swap",
  variable: "--font-sans",
});
```

Applied as `className={cairo.variable}` on `<html>`. Tailwind picks it up via
the `--font-sans` custom property.

Scale (Tailwind sizes):

| Token       | Use                              |
|-------------|----------------------------------|
| `text-xs`   | Helper text, tag badges          |
| `text-sm`   | Body, form helpers               |
| `text-base` | Default body                     |
| `text-lg`   | Card subheads                    |
| `text-xl`   | Section headings                 |
| `text-2xl`  | Page subheads                    |
| `text-3xl`+ | Hero, marketing                  |

Weights used: `400` (default), `500` (medium emphasis), `600` (headings),
`700` (logos, big hero).

---

## Spacing

Tailwind's default 4px scale. We prefer:

- Inside cards: `p-4` (small), `p-6` (default), `p-8` (large).
- Between sections: `gap-6` or `space-y-6`.
- Between cards on a grid: `gap-4` on mobile, `gap-6` on desktop.

Avoid pixel-perfect tweaks (`p-[13px]`) — if you reach for a custom number,
you are probably solving a different problem (alignment, content size).

---

## Radii

| Token             | Use                                  |
|-------------------|--------------------------------------|
| `rounded`         | Inputs, badges                       |
| `rounded-md`      | Buttons (default)                    |
| `rounded-lg`      | Cards                                |
| `rounded-xl`      | Modals, big surfaces                 |
| `rounded-full`    | Avatars, pill badges                 |

---

## Shadows & elevation

Two real shadows, plus a hover state:

| Token            | Use                                           |
|------------------|-----------------------------------------------|
| `shadow-sm`      | Buttons, default cards                        |
| `shadow-md`      | Hovered cards, popovers                       |
| (modal backdrop) | Black at `opacity-50` plus `backdrop-blur-sm` |

We avoid stacking shadows or adding ambient `box-shadow` glows — the design
relies on color, type, and motion, not heavy depth.

---

## Motion

Powered by `framer-motion` 12. Patterns:

### Page enter

```tsx
<motion.div
  initial={{ opacity: 0, y: 8 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.25, ease: "easeOut" }}
>
```

### Stagger children

```tsx
<motion.ul variants={listV} initial="hidden" animate="visible">
  {items.map((item) => (
    <motion.li key={item.id} variants={itemV}>{item.name}</motion.li>
  ))}
</motion.ul>
```

Where:

```ts
const listV = { hidden: {}, visible: { transition: { staggerChildren: 0.05 } } };
const itemV = {
  hidden:  { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.2 } },
};
```

### Theme swap

`useTheme().setTheme()` adds a `.theme-transition` class on `<html>` for
~400ms. The class enables a global CSS `transition: background-color 400ms,
color 400ms` so the page fades between modes instead of snapping.

### Live pulse

The "live" dot on the project page is a pure CSS keyframe (`@keyframes pulse`)
applied via Tailwind's `animate-pulse` utility on a small `<span>`.

### Reduced motion

We respect `prefers-reduced-motion` in the animated terminal and the modal
backdrops by short-circuiting framer's transitions to 0 ms. Add the same
guard if you build a new heavily-animated component.

---

## Iconography

`lucide-react` 0.562. Use the default stroke width and 16/20/24 px sizes.

```tsx
import { GitBranch, Plus, X } from "lucide-react";
<GitBranch className="h-4 w-4" />
```

Conventions:

- Always set `className="h-X w-X"` — never inline `size={...}` — so the icon
  reflows with the surrounding type.
- `lucide` icons inherit `currentColor`. Wrap in a span that has
  `text-foreground`, `text-muted-foreground`, or `text-accent` as
  appropriate; never set `stroke` directly.

`react-icons` is also installed for cases where a brand icon (GitHub, npm)
is needed.

---

## Dark mode

- Enabled via the `dark` class on `<html>`.
- The bootstrap script in `app/layout.tsx` reads `localStorage.gent-theme`
  before paint, so users never see a flash of the wrong theme.
- `useTheme().toggle()` is the canonical way to swap modes from the UI.
- Test every change in both modes. The CI build does not check this — you do.

---

## Voice & tone (copy)

- Direct, technical, not chirpy. "Connect" not "Let's get you connected!".
- Buttons are verbs ("Create", "Save", "Delete"). Avoid trailing punctuation.
- Empty states say *why* the screen is empty and what the user should do next.
- Errors say *what failed* and, when possible, *how to fix it*. Never just
  "Something went wrong" if `readApiError(err)` returns something better.
