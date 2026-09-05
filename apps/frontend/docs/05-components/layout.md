# Layout Components

Files: `src/components/layout/*`

Layouts are the **page shells**. They own navigation, the surrounding chrome,
and any cross-page concerns (theme toggle, brand). Routes plug their content
in as children.

| File                   | Component            | Used by                                          |
|------------------------|----------------------|--------------------------------------------------|
| `marketing-nav.tsx`    | `<MarketingNav>`     | `/`, `/cli`, `/faq`, `/privacy`, `/terms`        |
| `marketing-footer.tsx` | `<MarketingFooter>`  | Same as above                                    |
| `marketing-page.tsx`   | `<MarketingPage>`    | Convenience wrapper = nav + content + footer     |
| `auth-shell.tsx`       | `<AuthShell>`        | `/auth/login`, `/auth/signup`                    |
| `app-shell.tsx`        | `<AppShell>`         | Everything under `/app/*`                        |
| `theme-toggle.tsx`     | `<ThemeToggle>`      | `MarketingNav`, `AppShell`, `/app/settings`      |

---

## `<MarketingNav>`

The top bar on public pages.

Contents:

- Logo (links to `/`)
- Inline nav: `Features`, `CLI`, `FAQ`
- `<ThemeToggle>`
- Conditional CTA:
  - If `useAuth().isAuthenticated` → "Open app" → `/app`
  - Else → "Sign in" (`/auth/login`) + "Sign up" (`/auth/signup`)

Implementation notes:

- Sticky to top, with a translucent backdrop blur when scrolled (CSS only).
- On mobile, collapses into a hamburger that opens a sliding sheet.

## `<MarketingFooter>`

Three columns: brand + tagline, link groups (product / company / legal), and a
"Made with React + Tailwind" credit line. Edit in place — there is no CMS.

## `<MarketingPage>`

Tiny composition helper:

```tsx
export default function MarketingPage({ children }: { children: ReactNode }) {
  return (
    <>
      <MarketingNav />
      <main className="min-h-[60vh]">{children}</main>
      <MarketingFooter />
    </>
  );
}
```

Use it in any new marketing-style page so the nav/footer are consistent.

---

## `<AuthShell>`

A split-screen layout for `/auth/login` and `/auth/signup`.

```
┌──────────────────────────┬────────────────────────┐
│                          │                        │
│  Branded panel           │   Form (children)      │
│  (gradient, logo, copy)  │                        │
│                          │                        │
└──────────────────────────┴────────────────────────┘
```

On mobile, the branded panel collapses to a small header and the form expands.

```tsx
<AuthShell title="Welcome back" subtitle="Sign in to continue.">
  <LoginForm />
</AuthShell>
```

---

## `<AppShell>`

The chrome around every authenticated page.

Contents:

- **Topbar**:
  - Logo → `/app`
  - Search field (currently UI-only — wires to nothing yet)
  - `<ThemeToggle>`
  - User chip: avatar + name (from `useAuth()`); clicking opens a menu with
    *Settings* and *Sign out*.
- **Main content**: receives `children`, with the standard page padding.
- **Auth guard**: if `useAuth().isAuthenticated` is false on mount,
  `router.replace("/auth/login")`.
- **Session check spinner**: while `useAuth().isCheckingSession` is true,
  shows a centered skeleton instead of the children — prevents content
  flicker when the page first loads with a stale cache.

---

## `<ThemeToggle>`

Sun ↔ moon button that calls `useTheme().toggle()`.

- Renders a `Sun` or `Moon` from `lucide-react` based on the current theme.
- Adds a `.theme-transition` class to `<html>` for ~400ms during the swap so
  colors fade instead of snapping.
- Persists in `localStorage.gent-theme` (the bootstrap script in
  `app/layout.tsx` reads this before paint to avoid flashes).

See [14-design-system.md](../14-design-system.md) for the theme tokens
themselves.
