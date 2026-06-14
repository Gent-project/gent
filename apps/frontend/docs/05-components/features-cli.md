# Feature Components — CLI

Files: `src/components/features/cli/*`

These power the `/cli` page and the animated terminal hero on `/`.

| File                    | Component             | Purpose                                       |
|-------------------------|-----------------------|-----------------------------------------------|
| `animated-terminal.tsx` | `<AnimatedTerminal>`  | Faux-terminal that types out commands on loop |
| `command-card.tsx`      | `<CommandCard>`       | One CLI command with description + copy btn   |

---

## `<AnimatedTerminal>`

The terminal you see on the landing page. Cycles through a scripted sequence:

```text
$ gent login                       (typed char-by-char)
✓ Logged in as alice@gent.app
$ gent init my-app
✓ Initialised repository my-app
$ gent push origin main
↑ 3 objects, 12.3 KB
✓ Pushed to origin/main
```

Props:

```ts
type Props = {
  sequence?: TerminalLine[];   // override the default lines
  loop?: boolean;              // default true
  speed?: "slow" | "normal" | "fast";  // typing speed; "normal" by default
};
```

Implementation:

- Uses framer-motion to fade lines in.
- Typed output is rendered one character per `setTimeout` — wrapped in
  `useReducer` so it cleans up on unmount.
- The blinking caret is a pure-CSS `@keyframes` animation.
- Respects `prefers-reduced-motion`: when on, the sequence appears all at
  once with no typing animation.

---

## `<CommandCard>`

Used on `/cli` for each command in `src/lib/cli-commands.ts`.

Props:

```ts
type Props = {
  command: CliCommand;   // { name, summary, usage, examples, tags }
};
```

Renders:

- Command name (e.g. `gent push`) as a heading.
- One-line summary.
- A `usage:` block with the canonical signature.
- A list of `examples:`, each with a copy-to-clipboard button.
- Tags (e.g. `auth`, `network`, `safety`) as small badges that filter the
  list on the page.

The copy uses `navigator.clipboard.writeText`. We do not gate on permissions
because the API is broadly supported in target browsers — if it throws, we
fall back to a `<textarea>`-based copy and log a `console.warn`.
