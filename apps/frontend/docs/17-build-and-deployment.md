# 17 — Build & Deployment

This app is a stock Next.js 16 project. Anywhere Next runs, this runs.

---

## Local build

```bash
npm run build
npm start              # serves the production build on :3000
```

`npm run build` runs Next 16 with Turbopack. Output goes to `.next/`.

What to expect:

- 20–60 seconds on a recent laptop.
- A warning about route caching configuration is benign — every route is a
  client component, so SSR caching is moot.
- Type errors **fail the build**. So do lint errors flagged by the Next ESLint
  config. Fix them rather than silencing them.

`npm start` starts the production server on port 3000 (override with `PORT`).

---

## Production bundle anatomy

After `npm run build`:

```
.next/
├─ server/          ← server runtime + per-route data
├─ static/          ← hashed JS/CSS chunks for the browser
├─ types/           ← Next's generated route types
├─ trace            ← build telemetry (safe to ignore)
└─ BUILD_ID
```

Things that affect bundle size:

- **`framer-motion`** is the biggest single import (~50 KB gzipped). Worth it.
- **`lucide-react`** tree-shakes properly — every `<Icon />` imports only
  the icons used.
- **`@tanstack/react-query-devtools`** is excluded from production builds
  automatically by the package.

Do not introduce a heavy library (charts, editors) without measuring its
impact. `next build --analyze` (with `@next/bundle-analyzer`) is the
intended path; we haven't wired it up because we haven't needed to yet.

---

## Deploying to Vercel (recommended)

1. Push the repo to GitHub.
2. Import it in Vercel, accept the default Next.js settings.
3. Set the env var `NEXT_PUBLIC_GENT_API_URL` if it differs from the default.
4. Done — every push to `main` deploys, every PR gets a preview URL.

Vercel handles:

- Edge caching of static assets.
- Per-route SSR / ISR (we have neither, but the runtime supports them).
- Automatic image optimization (we use `<img>` directly today; switch to
  `next/image` if you start using product imagery).

---

## Deploying to Render

A `render.yaml` is not committed; here is the minimal setup:

- Service type: **Web Service**.
- Build command: `npm install && npm run build`.
- Start command: `npm start`.
- Env: `NEXT_PUBLIC_GENT_API_URL=https://gent-api.onrender.com/api`.
- Region: pick the same one as the API to minimise latency.

Render does not currently support per-PR preview URLs for Next — Vercel is
better if you want them.

---

## Deploying to a Node host (Docker, EC2, etc.)

1. Build:

   ```bash
   npm ci --omit=dev=false
   npm run build
   ```

2. Trim to runtime:

   ```bash
   npm prune --omit=dev
   ```

3. Run with `node`:

   ```bash
   PORT=3000 npm start
   ```

If you want a smaller image, enable Next's standalone output in
`next.config.ts`:

```ts
output: "standalone",
```

Then copy `.next/standalone` and `.next/static` into the runtime image and
run `node server.js`. This produces a ~150 MB image instead of ~400 MB.

---

## Build-time vs runtime env vars

- `NEXT_PUBLIC_*` is **inlined at build time** — you cannot change it after
  `next build` finishes. If you need it to vary by environment, build once
  per environment (Vercel/Render do this automatically) or use a runtime
  shim (e.g. a `/public/config.js` written by an entrypoint script — not
  recommended unless necessary).
- Non-prefixed env vars are only readable in server components and API
  routes. We have none today; we run pure client-side.

---

## Caching headers

Next sets sensible defaults:

- `_next/static/**` — `Cache-Control: public, max-age=31536000, immutable`.
- HTML responses — `Cache-Control: private, no-cache, no-store, max-age=0`.

If you front the app with a CDN, make sure it honors these. Don't override
the immutable headers — they're correct, and overriding them defeats most
of Next's deploy story.

---

## Health checks

There is no `/health` route. If the host needs one, the cheapest
implementation is a Next API route:

```ts
// src/app/api/health/route.ts
export const dynamic = "force-dynamic";
export function GET() {
  return new Response("ok", { status: 200 });
}
```

Add it only when a deploy target asks for it.
