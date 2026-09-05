# Gent: independently implemented Git compatibility

## Goal and ownership

Gent remains a from-scratch version-control system across its Node CLI, Django API, and Next.js interface. Gent implements repository storage, staging, history traversal, checkout, merging, refs, packfiles, and remote transport. Compatibility comes from implementing Git's public formats and protocols.

No production operation invokes `git`, `git-http-backend`, libgit2, Dulwich, isomorphic-git, or another Git engine. General-purpose crypto, compression, HTTP, database, and filesystem libraries are permitted. Git is a development/test oracle and an external interoperability client only.

Deliverable claim: **Gent independently implements Git-compatible SHA-256 repositories and smart HTTP transport for the documented, tested workflow set.** Do not promise every plugin or full feature parity with Git.

This is an implementation plan, not evidence that compatibility already exists. Record tool versions and actual results before marking anything supported.

## Assumptions and trade-offs

- **Keep SHA-256**, assuming it is part of the presented project. SHA-1 would offer broader ecosystem compatibility but would change that design choice. A SHA-256-capable Git binary does not establish compatibility for every client built around it. Tool support must be tested individually.
- **Retain `.gent` plus a `.git` pointer for Gent-created repositories**, preserving the original plan's layout. A conventional `.git` directory is simpler for tools with hardcoded discovery; the pointer is a standard mechanism. Gent must read both layouts, including repositories created by ordinary Git clone. Directory branding must never control repository validity.
- **Keep Node and Python implementations.** Share a written format contract and byte fixtures across runtimes; do not introduce a third runtime solely for code sharing. The frontend consumes authoritative server objects and IDs instead of creating its own competing hash definition.
- **Use Postgres for canonical objects and refs initially.** This simplifies transactional durability for the graduation-project workload. Durable object storage can follow if measured repository sizes justify it; ephemeral files are temporary buffers only.
- **Deliver full clones and ordinary branch/tag workflows first.** Advanced features listed below are explicit follow-up work, not silently accepted input.

## Compatibility boundary

The release must support init, add, status, commit, log, show, diff, branch, checkout, tag, merge/conflict resolution, reset, stash, Gent undo/redo, clone, fetch, pull, and push within this boundary:

- SHA-256, normal full repositories, files-based refs, loose and packed objects.
- Both `.gent` gitfiles and conventional `.git` directories; discovery from child directories; linked-worktree discovery through `commondir` and per-worktree state.
- Regular files, executable files, symlinks, binary contents, nested directories, and conflicted index entries.
- Index versions 2/3/4 for reading; version 2 for writing when representable. Preserve supported entry flags. If flags or extensions cannot be represented faithfully, refuse mutation with an actionable error.
- Lightweight and annotated tags; signed/extended commit and tag objects remain byte-preserved even though signature verification is outside the first release.
- Smart HTTP full clone/fetch/push over a correctly implemented protocol-v0 baseline, including SHA-256 object-format negotiation. Verify normal modern Git clients fall back successfully when requesting v2; no special client flags should be needed for the supported workflow.

Initially unsupported: SHA-1 repositories, reftable, shallow/partial clones, sparse/split indexes, recursive submodule operations, arbitrary clean/smudge filters and Git LFS, SSH transport, and running Gent operations during an external rebase/cherry-pick/sequencer operation. Detect these before modifying state. Preserve gitlink entries for reading/transport; reject worktree operations that require unsupported submodule behavior.

Core text/EOL attributes and ignore behavior are part of worktree correctness, not optional polish. If an attribute or configuration requires an unimplemented transformation, fail the affected operation before writing anything. Document platform limitations for symlinks, executable bits, and filenames.

Unknown required repository/index extensions cause a clear refusal. Optional acceleration data can be ignored only where its specification permits it. No production fallback to the Git executable.

## Breaking changes and release policy

Commit and tree IDs change during migration. Existing random commit IDs cannot be retained as canonical IDs. Correctly stored blobs retain their SHA-256 IDs; validate this rather than assuming every legacy blob is intact.

Legacy JSON history, staging, and configuration cease to be authoritative. Ignore behavior changes to match Git: the current implicit exclusions, including `.gitignore`, must not remain hidden Gent-only rules. Convert intended legacy exclusions into explicit shared rules during migration and report behavior changes.

Release as CLI v13 with an explicit format marker and `gent migrate`. V13 detects legacy repositories and explains migration without modifying them. Do not release a half-converted CLI. Deploy compatible server functionality before enabling migration of connected repositories. Legacy API writes must not corrupt converted repositories.

## Phase 0 — fixtures, contracts, and baseline

1. Run and record the existing CLI and API suites; investigate failures before using them as a baseline. Do not assume counts from the previous proposal remain accurate.
2. Inventory every read/write of legacy history, staging, refs, objects, config, tags, stashes, remote metadata, and journal state.
3. Define canonical byte fixtures for blobs, nested trees, commits, tags, refs, indexes, packs, and transport exchanges. Include malformed input and SHA-256 lengths/checksums.
4. Define one feature-support manifest used by repository opening, command preflight, documentation, and tests.
5. Add a separate interoperability suite allowed to invoke Git. Add a runtime-independence suite with Git unavailable and a subprocess audit for production paths.

Gate: reproducible baseline and explicit ownership of every persistent format. Proposed new modules below are responsibilities; align filenames with existing conventions during implementation.

## Phase 1 — canonical object engine

Extend or replace `apps/Cli/src/utils/hash-engine.js` behind a single object-store interface. Remove `object-store.js` only after confirming it has no consumers.

- Hash canonical `<type> <byte-length>\0<payload>` framing with SHA-256; persist zlib-compressed loose objects atomically. Validate type, declared size, and ID on untrusted reads/imports.
- Serialize nested binary trees with Git byte ordering, directory comparison rules, supported modes, and 32-byte object IDs. Paths within each tree are basenames, not flat slash-separated entries.
- Serialize commits with ordered parents, distinct author/committer identities, epoch timestamps and timezone offsets, and exact message bytes. Preserve raw received objects, unknown headers, multiline signatures, and encoding information; parsing for display must never rewrite object identity.
- Implement annotated tags as objects and lightweight tags as refs. Resolve tag chains with cycle/depth protection for malformed input.
- Read symlink target bytes through `lstat`/`readlink`; do not follow the target and store its file content. Honor executable modes and configured filesystem capabilities.
- Validate tree names and checkout destinations, including metadata-path protection, traversal, symlink-parent traversal, and platform path collisions.

Legacy migration reads the old format as written. Do not “fix” old JSON serialization and accidentally reinterpret stored IDs before migration.

Gate: Gent-produced bytes and IDs match Git fixtures; Git reads all four object types; arbitrary binary bytes round-trip. Compare raw tree output with `git cat-file tree <oid>`, not pretty-printed `cat-file -p`.

## Phase 2 — repository discovery, refs, config, and locks

Implement repository discovery, `refs.js`, and `git-config.js`:

- Walk parent directories; resolve `.git` files, standard gitdirs, common directories, and per-worktree HEAD/index/operation state. Recognize bare repositories where applicable.
- Initialize `.gent/config` with repository format version 1 and `extensions.objectFormat=sha256`; create `.git` containing `gitdir: .gent`. Exclude `/.gent/` through `info/exclude`.
- Support symbolic, unborn, and detached HEAD; loose refs and `packed-refs`, including peeled annotated tags. Correctly handle updates/deletion when a packed value exists.
- Validate ref names. Use Git-compatible lockfiles, atomic replacement, and expected-old-ID checks to prevent lost updates against external Git writers. Implement safe reflog updates and crash recovery; never steal an active lock.
- Implement Git config syntax, quoting, repeated values, subsections and relevant precedence/includes. Preserve unrelated settings. Detect unsupported behavior-affecting configuration instead of guessing.
- Store Gent metadata under the resolved gitdir's `gent/` namespace. Credentials stay in existing user-level secure storage, not committed files.

Gate: alternate Gent/Git ref updates, detached/unborn HEAD, packed refs, nested working directories, linked worktrees, and simultaneous mutation attempts without lost changes.

## Phase 3 — index and worktree correctness

Implement `git-index.js` and a common worktree-update layer used by checkout, merge, reset, stash, and undo.

- Parse required index versions, paths, SHA-256 IDs/checksum, modes, stat data, flags, padding, and stages 0/1/2/3. Validate checksums and extension semantics.
- Write under `index.lock`; invalidate derived caches after mutation. Do not retain stale cache-tree data. Treat racy timestamps correctly rather than trusting equal stat fields blindly.
- Implement shared Git ignore rules and supported attributes/EOL transformations consistently across add/status/diff/checkout. Exclusions apply to untracked discovery, not permission to ignore tracked changes.
- Perform checkout preflight for staged/unstaged changes, untracked collisions, path safety, and unsupported features before updating files. Preserve binary data, deletions, symlinks, and modes.
- Plan multi-file updates and persist recovery information. A filesystem checkout is not one atomic transaction; interrupted operations must be detectable and recoverable.
- Represent merge conflicts in index stages plus standard merge state. Clear state only after successful completion or abort.

Gate: Git and Gent agree on staged/unstaged/untracked/conflicted status across binary, symlink, executable, EOL, deletion, and interrupted-operation fixtures.

## Phase 4 — packed-object interoperability

Implement a Gent pack reader/writer and index reader. This is required locally as well as remotely: Git maintenance and clone can leave objects available only in packs.

- Read pack v2/v3 and pack-index v2, including large offsets, CRC validation and SHA-256 checksums. Scan individual pack indexes when optional acceleration indexes are absent or ignored.
- Decode normal objects, OFS_DELTA and REF_DELTA, delta chains, and copy/insert instructions with bounds, depth, size and corruption checks.
- Resolve thin incoming packs against authorized repository objects; materialize complete objects or a self-contained pack before durable publication.
- Initially emit valid full-object packs without delta compression. This trades transfer size for a smaller correct encoder; delta decoding remains mandatory for externally produced packs.
- Keep reads valid during pack replacement/maintenance through open-file handles and bounded rescan on legitimate disappearance. Corruption is an error, not a missing-object success.

Gate: Gent reads a Git-cloned repository and continues after `git gc`/`git repack`; Git validates Gent-emitted packs. Malformed packs fail without publishing refs.

## Phase 5 — command integration and undo

Move commands onto the canonical engine; remove random commit hash generation and legacy authoritative JSON reads.

- Init/add/commit/status use the new config, index, objects, and refs.
- Log/show/diff walk the actual DAG; retain all parents and distinguish author from committer time.
- Checkout updates worktree/index/HEAD together through the recovery layer. Preserve the existing Gent merge algorithm where correct, feeding it canonical trees and writing standard merge results.
- Implement real stash commit topology and `refs/stash` reflog behavior, including index state and supported untracked-file handling. A stash ref alone is insufficient.
- Journal undo/redo stores expected before/after states. Reject undo when external changes invalidate its preconditions. Retain journal object roots under private `refs/gent/...` so Git pruning cannot delete required objects; never push these refs by default. Document their visibility to tools showing all refs.
- Detect external in-progress operations and refuse conflicting Gent writes. External Git commits and merges completed between Gent commands must work.

Gate: all supported commands operate in both directions with Git; divergence creates a genuine two-parent merge; stashes can be created/applied across implementations; retained undo history survives Git maintenance.

## Phase 6 — transactional server object store

Introduce Python canonical-object/pack modules validated against the same fixtures as the CLI.

- Add `GitObject(repository, oid, type, size, data)` with repository-scoped uniqueness; `data` is exact uncompressed payload bytes. Reconstruct framing for hashing. Use durable binary storage, never decoded text or ephemeral paths as authority.
- Add canonical `GitRef(repository, name, target)` and repository default-branch/format metadata. Objects and refs are authoritative; existing models are derived API indexes.
- Change `Commit.sha` from global uniqueness to repository-scoped uniqueness. Allow authors without accounts; optional account links must not delete historical commits when accounts are removed. Preserve author/committer metadata separately.
- Model tag targets and object types correctly; do not flatten annotated tags into commit IDs. Adapt tree/blob endpoints to nested trees and binary data while preserving existing response contracts where possible.
- Route REST and smart-HTTP mutations through one validation/transaction service. Every API that creates objects must compute canonical IDs; every supplied ID must be checked, including tags.
- Quarantine incoming data until validation completes. Validate reachable object closure and type relationships, excluding gitlink targets from same-repository closure requirements. Bound object counts, inflated sizes, delta depth, and processing time.
- Under a per-repository database lock, recheck permissions and expected old refs, enforce update policy, persist validated objects, update refs and essential derived indexes in one transaction. Send successful ref status only after commit.
- On rollback, no ref changes become visible. On a lost response after commit, clients can rediscover refs safely. Caches are keyed by committed state and rebuildable; no worker-local repository cache is authoritative.

Gate: shared commits across repositories, arbitrary authors, binary objects, concurrent pushes, rollback, process death and restart preserve acknowledged history. Existing frontend workflows pass integration tests against canonical data.

## Phase 7 — Gent smart HTTP server and client

Implement the public HTTP and pack protocol in Django and Node, with no Git subprocesses.

Routes:

```text
GET  /<owner>/<repo>.git/info/refs?service=git-upload-pack
GET  /<owner>/<repo>.git/info/refs?service=git-receive-pack
POST /<owner>/<repo>.git/git-upload-pack
POST /<owner>/<repo>.git/git-receive-pack
```

Register exact routes and MIME types without redirecting protocol POSTs. An extensionless alias is optional; clients must use the configured URL rather than relying on suffix probing.

- Implement pkt-line framing, advertisement, empty repositories, symref HEAD, SHA-256 capability negotiation, want/have/done negotiation, and pack streaming. Advertise only capabilities actually implemented.
- Implement push commands, expected-old-ID verification, creation/deletion policy, unpack/ref status responses, and negotiated sideband behavior. Advertise atomic push only after the server transaction semantics support it.
- Start with protocol v0 and minimal legal negotiation; defer v2 and transfer optimizations until baseline interoperability passes. Reject unauthorized object wants, not just unauthorized ref updates.
- Support HTTP Basic with scoped, hashed, revocable personal access tokens over HTTPS and anonymous reads for public repositories. Reuse repository access policy. Gent's own authenticated requests can retain supported Bearer authentication.
- Implement Gent clone/fetch/push against these routes. Pull remains Gent fetch plus Gent merge. Share the same canonical storage path with existing REST compatibility endpoints; retire duplicate mutation paths after migration.
- Use bounded streaming/spooling, cancellation, timeout handling, and deployment request-size limits. Validate behavior through the actual proxy/worker stack; a streaming response alone does not solve worker occupancy or request buffering.

Gate: ordinary `git clone`, fetch and push against Gent; Gent-to-Gent transport with Git absent; Git Graph fetch/push where the installed version supports the repository. Database failure before commit produces no success acknowledgement.

## Phase 8 — recoverable migration and coordinated rollout

Implement `gent migrate --dry-run` and a matching server migration before enabling v13 upgrades.

1. Inventory legacy branches, tags, commits, staged/unstaged/untracked contents, stashes, merge state, journal roots and remote references. Block with a specific recovery instruction if a legacy state cannot be faithfully migrated.
2. Acquire exclusive migration access and create a verified backup outside the candidate active store. Never overwrite an existing unrelated `.git` directory or pointer.
3. Build a separate candidate store. Traverse parents topologically; reuse verified blobs; rebuild nested trees, commits, tags, stashes and index state. Missing historical modes or committer metadata require a documented deterministic fallback, not invented claims of exact preservation.
4. Write old-to-new mappings and migration-version metadata. Preserve available author timestamps and topology; use identical deterministic rules on client and server so shared history receives matching new IDs.
5. Validate reachable objects, index/worktree relationships and refs with Gent's own checker. Git may validate test fixtures, but migration itself must work without Git installed.
6. Coordinate server cutover, translate stored references to old IDs where possible, and block legacy writers. Preserve a mapping for old links. Do not treat an uncoordinated force-push as migration.
7. Activate through an explicit crash-recoverable cutover journal, including the pointer file. Retain backups and allow rollback before subsequent new-format writes; after new writes, recovery must preserve that new history.

Gate: dry run is read-only; interrupted migrations resume or roll back safely; staged and unstaged changes remain distinct; client/server mappings agree; migrated repositories contain no unresolved reachable legacy IDs.

## Phase 9 — release evidence and graduation demonstration

Run existing CLI/API/frontend checks plus focused new suites. Record results and failures, not assumed test counts.

Required evidence:

- A clean runtime/container without Git completes Gent init, add, commit, branch, checkout, divergent merge, stash, undo, clone, fetch, pull and push.
- Git reads Gent objects and passes `git fsck --full --strict`; Gent independently validates the same history.
- Alternate Gent/Git commits and merges, then pack objects and refs with Git; Gent still reads and writes correctly.
- Exercise nested paths, binary bytes, symlinks, executable modes, detached HEAD, annotated tags, staged/unstaged separation, conflicts and rejected unsafe checkouts.
- Exercise ordinary Git clone into a conventional `.git` directory, followed by Gent operations, and supported linked-worktree operations.
- Test malformed input, permission rejection, stale-old-ref pushes, concurrent writers, transport cancellation, restart and migration recovery.
- Maintain a tool matrix for Git CLI, VS Code SCM, Git Graph, lazygit, tig and GitKraken, listing exact versions, platforms and pass/fail/unsupported results separately for discovery, graph, status, checkout, fetch and push. Never infer one tool's support from another.
- Demonstrate a Git-originated push appearing correctly in Gent's frontend, and a Gent-originated commit appearing in an external graph.

Frontend DAG rendering is optional after these gates. Correct canonical IDs, author metadata, tree browsing and binary-file handling are required integration work.

## Sequencing and completion

Implement Phases 0–5 as one coherent local-engine milestone; complete Phases 6–7 as the remote milestone. Develop migration fixtures early, but enable Phase 8 cutover only after both milestones pass. Release follows Phase 9 evidence.

Highest uncertainty: index/worktree semantics, delta/pack parsing, protocol negotiation and migration recovery. Estimate effort after fixture-driven prototypes, not a speculative line count. Each milestone must be runnable and reviewed before expanding scope.

Completion means Gent owns the implementation, works without Git installed, and exchanges the supported repository states with independently tested Git tools. Unsupported features remain explicit errors with documented follow-up scope.

## Normative references

Use these public specifications for implementation details and fixtures; record the tested Git version alongside them:

- [Git repository layout](https://git-scm.com/docs/gitrepository-layout)
- [Git index format](https://git-scm.com/docs/gitformat-index)
- [Git pack format](https://git-scm.com/docs/gitformat-pack)
- [Git HTTP protocol](https://git-scm.com/docs/http-protocol)
- [Git pack protocol](https://git-scm.com/docs/pack-protocol)
- [Git hash-function transition](https://git-scm.com/docs/hash-function-transition)
