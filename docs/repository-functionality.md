# Repository functionality and integration handoff

## Implemented: anonymous repository browsing

The existing `/dashboard/repository/{owner_id}/{repo_name}` URL now works without a frontend login requirement. Guests get a public header, sign-in return link, read-only files, commits, branches, tags, and clone instructions. The frontend only renders repository content for guests when `is_private` is explicitly `false`. Settings and dashboard routes still require authentication. Anonymous API 401 responses stay on the page instead of triggering session refresh or a login redirect.

Guest controls for file creation/upload/editing, branch/tag creation/deletion, settings, and server-side Git operations are unavailable. Signed-in behavior is preserved; authentication alone does not establish write permission, and backend authorization remains required for every mutation. The current Repository response has no collaborator permission fields, so role-aware signed-in controls require an agreed backend contract.

## Required backend verification

Use existing endpoints; no new API fields or endpoints were invented:

- Permit anonymous GET access to public repository details, branches, commits and diffs, tags, trees, and blobs used by the existing browser.
- Authorize every nested object against its repository. Reject anonymous private repository access, including direct tree/blob requests.
- Return access-denied/not-found responses without exposing private metadata.
- Keep mutation endpoints authenticated and enforce owner/collaborator roles server-side.
- Verify anonymous clone with the CLI separately; displaying the clone URL does not prove transport support.

The browser regression uses intercepted API fixtures, not live backend data. Run a real public repository and private repository through the same flows after backend changes.

## Next functionality stages

1. Public discovery and owner profiles: agree on a public repository listing/search contract; add Explore with filtering, pagination, and owner navigation.
2. Shareable code navigation: branch, folder, file, commit, and tag permalinks; browser back/forward; README rendering and repository-wide file search.
3. Collaboration: agreed read/write/admin permissions, invitations, forks, pull requests, reviews, merge conflict handling, and protected branches.
4. Project tracking: issues, labels, milestones, releases, stars/watch subscriptions, and activity notifications.
5. CLI/backend integration: verify clone/fetch/push, branch/tag transport, object integrity, authorization, and archive downloads against real repositories.

These are remaining features, not claims of GitHub parity. Implement them against confirmed backend contracts and real integration tests.

## Validation

- `npm run build`: passed.
- `npm run lint`: no errors; 20 existing warnings.
- `git diff --check`: passed.
- `tests/public-repository.cjs`: Playwright regression against the production server at port 3105; covers public reads, guest mutation controls, private/401 responses, absence of guest dashboard-list requests, and protected settings redirects. Requires an available Playwright installation (`NODE_PATH` may point to the bundled runtime).
