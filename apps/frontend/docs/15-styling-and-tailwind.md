# 15 — Styling & Tailwind

The app uses **Tailwind v4** with the PostCSS plugin. There is no
`tailwind.config.ts` — configuration lives in CSS via `@theme` blocks and
custom properties.

---

## How the styles get applied

1. `postcss.config.mjs` registers `@tailwindcss/postcss`.
2. `src/app/globals.css` imports Tailwind:

   ```css
   @import "tailwindcss";
   ```

3. The same file declares design tokens in a `:root { ... }` block and
   inverts them in `.dark { ... }`.
4. Tailwind exposes those tokens as utilities (`bg-card`, `text-foreground`,
   etc.) via its `@theme` mapping.
5. Components compose those utilities with `cn(...)` from `src/lib/utils.ts`.

There is no `globals.css` import in any component — it is imported once by
`src/app/layout.tsx` and Tailwind handles the rest.

---

## Layout of `globals.css`

In order:

1. `@import "tailwindcss";`
2. `@theme { ... }` — declarations that map CSS variables to Tailwind tokens.
3. `:root { ... }` — the **light** palette tokens.
4. `.dark { ... }` — the **dark** palette tokens.
5. **Base layer** — global resets (`html, body { ... }`), font setup.
6. **Custom utilities** — small one-offs:
   - `.theme-transition *` — fades colors during a theme swap.
   - Animated keyframes (`@keyframes pulse`, ...).

When adding a token, change it in all four places: `@theme` mapping, `:root`,
`.dark`, and (if relevant) any utility class that hardcodes a value.

---

## `cn()` — class composition

```ts
import { cn } from "@/lib/utils";

<button
  className={cn(
    "rounded-md px-3 py-2 text-sm font-medium",
    "bg-primary text-primary-foreground hover:bg-primary/90",
    isLoading && "opacity-50 cursor-not-allowed",
    className,
  )}
/>
```

Always use `cn` when you compose classes from props, conditionals, or
multiple sources. It dedupes (`p-2 p-4` → `p-4`), merges variants correctly,
and produces a clean class string.

---

## Class ordering convention

We follow the Tailwind plugin's recommended order:

1. Layout (`flex`, `grid`, `block`, ...)
2. Sizing (`w-`, `h-`, `min-h-`, `max-w-`)
3. Spacing (`p-`, `m-`, `space-`)
4. Position (`relative`, `absolute`, `top-`)
5. Typography (`text-`, `font-`, `leading-`, `tracking-`)
6. Colors (`bg-`, `text-`, `border-`)
7. Borders (`border`, `rounded-`)
8. Effects (`shadow-`, `opacity-`, `backdrop-`)
9. States (`hover:`, `focus:`, `disabled:`, `dark:`)

Don't agonize over this — Prettier with the Tailwind plugin sorts it
automatically when configured. If you don't have that plugin set up, keep
the order roughly above and move on.

---

## Responsive

Use Tailwind's mobile-first breakpoints (`sm`, `md`, `lg`, `xl`, `2xl`).
Patterns we use a lot:

- Two-column grid that collapses: `grid grid-cols-1 md:grid-cols-2 gap-6`.
- Hide on small screens: `hidden md:block`.
- Larger padding on big screens: `p-4 md:p-6 lg:p-8`.

Avoid container-queries unless you need them; they are supported but the
team isn't fluent in them yet.

---

## Custom CSS

Reach for raw CSS only for:

- Keyframes (`@keyframes`).
- Properties Tailwind doesn't ship (e.g. `text-wrap: balance`).
- The bootstrap script's transition class (`.theme-transition *`).

If you find yourself writing more than 5 lines of CSS that aren't keyframes,
something is wrong — there's probably a utility, or you're missing a
primitive.

---

## Variants pattern (cva)

For primitives like `<Button>` and `<Badge>`, we use
`class-variance-authority`:

```ts
const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-md font-medium transition-colors",
  {
    variants: {
      variant: {
        default:     "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground",
        outline:     "border border-input bg-transparent",
        ghost:       "hover:bg-accent",
        // ...
      },
      size: {
        sm:      "h-8 px-3 text-sm",
        default: "h-10 px-4",
        lg:      "h-12 px-6 text-base",
        icon:    "h-10 w-10 p-0",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);
```

Use cva when:

- You have **2+ variants** of a primitive.
- Variants compose (variant × size).
- You want exhaustive types: `VariantProps<typeof buttonVariants>` gives the
  prop types for free.

Don't reach for cva on one-off composed components — `cn()` is enough.

---

## Tailwind v4 gotchas

- No `tailwind.config.ts`. Theme config lives in CSS.
- The `@apply` directive is still supported but discouraged — prefer
  composing classes via `cn` and cva.
- Tailwind v4 ships with built-in container queries, OKLCH colors, and
  modern color spaces. We do not lean on these yet, but they are available.
- Tailwind IntelliSense in VS Code works out of the box because it reads
  `@import "tailwindcss"` directly.
