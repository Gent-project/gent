# Gent Frontend Fixes and QA

This document records the frontend fixes applied on top of the old shared
frontend design baseline and the checks used to verify compatibility with the
Gent backend and CLI.

## Branches

- Frontend branch: `frontend2`
- CLI/root pointer branch: `apps/Cli`
- Backend branch for API compatibility: `development/server`

## Public Website

- Home page was simplified to describe only the current Gent product:
  CLI, API, dashboard, repositories, commits, branches, tags, files, members,
  push, pull, and clone.
- Top banner was simplified to real routes:
  `Home`, `CLI Docs`, `FAQ`, and `Dashboard`.
- Bottom banner was simplified to real Gent copy and the CLI install command.
- `/cli` was added as an in-site CLI documentation page with command groups for
  repository setup, staging, history, branches, remote sync, account, safety,
  and inspection.
- `/faq` was rebuilt with real project answers. Unsupported demo, pricing,
  notification, token, testimonials, analytics, and SaaS support copy was
  removed from the touched public pages.

## Dashboard Fixes

- Recent Activity is loaded from authenticated backend repository and commit
  data instead of static mock activity.
- Recent Activity `View` now uses a real Next.js link to the repository route:
  `/dashboard/repository/<owner_id>/<repo_name>`.
- Repository sorting now applies newest, oldest, and name ordering to the
  dashboard repository list.
- Sidebar repository links now use the same repository route shape as the
  repository page.
- The username display uses authenticated profile/user data instead of falling
  back to a generic `user` label.
- Dark-mode dropdown options were styled so menu text remains readable.

## Repository Actions

- Repository creation uses the backend endpoint `POST /api/repos/create/`.
- Repository update uses `PATCH /api/repos/<owner_id>/<repo_name>/`.
- Repository delete uses `DELETE /api/repos/<owner_id>/<repo_name>/delete/`.
- Create/update hooks unwrap backend responses shaped as `{ repository }`.
- Repository-name validation now matches the backend exactly:
  letters, numbers, dashes, and underscores only.
- Backend `400` validation messages are shown in the create repository modal
  instead of only the generic Axios error.
- Empty repositories can create the first file through the Code tab by pushing
  a CLI-compatible pack.
- Branch file browsing is tied to the selected branch commit and tree.
- Repository settings renders the backend member list directly. The owner row
  comes from the backend and is not duplicated by the UI.
- The owner cannot be removed from the UI because the backend rejects owner
  removal.

## CLI Compatibility

The website clone URL format matches the CLI parser:

```text
https://gent-api.onrender.com/api/repos/<owner_id>/<repo_name>
```

The CLI parses the `/api/repos/<owner_id>/<repo_name>` part and calls:

```text
GET /api/repos/<owner_id>/<repo_name>/clone/
```

The web first-file flow sends the same CLI-shaped push payload accepted by the
backend:

```text
POST /api/repos/<owner_id>/<repo_name>/push/
```

## Verified Checks

Frontend:

```text
npm run lint
npm run build
curl -I http://localhost:3000/home
curl -I http://localhost:3000/cli
curl -I http://localhost:3000/faq
```

Live backend smoke with the test account:

```text
POST /api/auth/login/
GET /api/repos/
POST /api/repos/create/
DELETE /api/repos/<owner_id>/<repo_name>/delete/
POST /api/repos/<owner_id>/<repo_name>/push/
GET /api/repos/<owner_id>/<repo_name>/clone/
```

CLI compatibility smoke:

```text
gent clone https://gent-api.onrender.com/api/repos/<owner_id>/<repo_name> cloned-repo
```

Result: the CLI clone completed with exit code `0` and restored the pushed
`README.md` from the temporary backend repository.

## Known Verification Boundary

The Codex in-app browser environment used here does not expose `localStorage`
for localhost pages, while this frontend stores auth tokens in `localStorage`.
Because of that browser limitation, authenticated dashboard UI actions were
verified by direct live API smoke tests and CLI smoke tests. Public pages were
verified in the browser for rendering, route response, unsupported copy, console
errors, and horizontal overflow.
