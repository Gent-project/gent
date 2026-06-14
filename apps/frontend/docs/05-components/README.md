# 05 — Components

The component library is split into four buckets, by **responsibility** rather
than by domain.

```
src/components/
├─ ui/           ← primitives — styled, themed, stateless
├─ layout/       ← page shells — own navigation and chrome
├─ features/     ← domain widgets — composed from `ui/`, call hooks for data
└─ providers/    ← global context glue (Redux, TanStack, toasts)
```

The rule of thumb:

- **`ui/`** never calls hooks (other than React's own). Pass data via props.
- **`layout/`** can call `useAuth()` and `useTheme()` because it owns the
  surrounding chrome.
- **`features/`** can call any custom hook because they *are* the domain.

Detailed reference, one file per bucket:

- [ui-primitives.md](./ui-primitives.md)
- [layout.md](./layout.md)
- [features-projects.md](./features-projects.md)
- [features-cli.md](./features-cli.md)
- [providers.md](./providers.md)
