# 06 — Testing and Evaluation

## Test Strategy

The project uses Node.js built-in testing for core algorithms and local behavior.

Test command from `package.json`:

```bash
npm test
```

It runs:

```bash
node --check src/index.js
node --test tests/diff.test.js tests/merge.test.js tests/hash.test.js tests/merge-base.test.js
node tests/offline-e2e.js
```

## Test Files

| Test File | Focus |
|---|---|
| `tests/hash.test.js` | SHA-256 blob hashing, object storage, binary round-trip, tree hashing, remote blob decoding. |
| `tests/diff.test.js` | LCS operations, prefix/suffix trimming, diff reconstruction, unified diff output. |
| `tests/merge.test.js` | Three-way merge, conflict markers, import union, JSON merge, conflict marker parsing. |
| `tests/merge-base.test.js` | Merge-base search in linear, branched, and DAG histories. |
| `tests/offline-e2e.js` | End-to-end local workflow without backend dependency. |
| `tests/remote-e2e.js` | Remote workflow test, requiring backend availability and authentication setup. |

## Current Verification

Run:

```bash
npm test
```

Expected result:

- JavaScript syntax check passes.
- Unit tests pass.
- Offline end-to-end test passes.

## Important Tested Cases

### Hash Engine

| Case | Expected Result |
|---|---|
| Same content hashed twice | Same 64-character SHA-256 hash. |
| Different content | Different hash. |
| Store and read text blob | Exact text round-trip. |
| Store and read binary blob | Exact byte-for-byte round-trip. |
| Same blob stored twice | Object is deduplicated. |
| Tree entries in different order | Same tree hash. |

### Diff Engine

| Case | Expected Result |
|---|---|
| Identical files | Only `equal` operations. |
| Modified file | Correct insert/delete operations. |
| Empty old or new input | Correct add/delete behavior. |
| Prefix/suffix trimming | Same result as full LCS. |
| Unified diff | Contains file headers, hunk headers, and plus/minus lines. |

### Merge Engine

| Case | Expected Result |
|---|---|
| One-sided change | Takes changed side. |
| Same change on both sides | Auto-resolves. |
| Different insertions at same location | Conflict markers. |
| Overlapping edits | Conflict. |
| Whitespace-only difference | Takes ours. |
| Different imports added | Unions imports. |
| Disjoint JSON key changes | Auto-merges JSON. |
| Same JSON key changed differently | Falls back to conflict markers. |

### Merge-Base

| History Shape | Expected Result |
|---|---|
| Linear history | Older ancestor is merge base. |
| Branch split | Fork point is merge base. |
| Merge commit DAG | Traverses both `parent` and `mergeParent`. |
| Unrelated histories | No merge base. |

## Evaluation Criteria

| Criterion | Evaluation |
|---|---|
| Correctness | Core algorithms have unit tests and end-to-end workflow tests. |
| Usability | Commands are grouped and include interactive prompts for common cases. |
| Reliability | Undo/redo journal reduces impact of mistakes. |
| Maintainability | Commands and engines are separated into modules. |
| Extensibility | New commands can be registered in `src/index.js` and implemented in `src/commands/`. |
| Security awareness | Uses JWT tokens, token refresh, and local token obfuscation. |
| Educational value | Core algorithms are implemented in project code and can be explained clearly. |

## Known Limitations

| Limitation | Explanation | Possible Improvement |
|---|---|---|
| LCS memory usage | Worst-case changed region still requires `O(m*n)` memory. | Use Myers diff or Hirschberg optimization. |
| Commit hash model | Commit hashes are generated from timestamp/random data. | Hash full canonical commit content. |
| Token encryption | Uses fixed AES key for local obfuscation. | Use OS keychain or credential manager. |
| Merge semantics | Merge engine is mostly text-based with limited language awareness. | Add AST-aware merge for JavaScript/Python. |
| Remote dependency | Push/pull require backend compatibility. | Add protocol versioning and stronger schema validation. |
| File permissions | Tree entries use simple mode `100644`. | Track executable bit and symlinks. |

## Suggested Future Work

1. Implement Myers diff for better performance on large files.
2. Hash full commit content for deterministic commit hashes.
3. Store secrets using OS keychain integration.
4. Add rename detection.
5. Add binary diff metadata.
6. Add signed commits.
7. Add stronger remote conflict handling and fetch-only command.
8. Add web dashboard integration for repository visualization.
9. Add AST-aware merge strategies for common programming languages.
10. Add more end-to-end tests for remote collaboration.

## Defense Notes

If asked whether Gent is a full Git replacement, answer:

> No. Gent is an educational version control system that implements core Git-like ideas in a readable way: object storage, commits, branches, diffs, merges, remote sync, and authentication. It is suitable for demonstrating algorithms and system design, but Git remains more complete and optimized.

