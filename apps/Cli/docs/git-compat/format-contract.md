# Gent canonical format contract

Normative for **both** runtimes: `apps/Cli/src/utils/*` (Node) and
`apps/server/gent_api/api/gitcore/*` (Python). Both are validated against the
same byte fixtures in `apps/Cli/tests/fixtures/`, which the Python suite loads
directly. When this document and an implementation disagree, this document and
the fixtures win.

Referenced specifications: gitrepository-layout, gitformat-index,
gitformat-pack, http-protocol, pack-protocol, hash-function-transition.

## 1. Object identity

- Hash function: **SHA-256**. `objectFormat = sha256`.
- Raw object id: 32 bytes. Hex object id: 64 lowercase hex characters.
- Framing hashed is `"<type> <decimal byte length of payload>\0" + payload`,
  where `<type>` is one of `blob`, `tree`, `commit`, `tag` and the length is
  the payload length in bytes with no leading zeros and no sign.
- `oid = hex(sha256(framing))`. The payload is exact bytes; there is no text
  decoding step anywhere in the identity path.

## 2. Loose object files

Path: `<gitdir>/objects/<oid[0:2]>/<oid[2:]>`.
Content: `zlib.compress(framing)` (zlib format, i.e. RFC 1950 with header and
Adler-32, **not** raw deflate).

Writes are atomic: compress into `<gitdir>/objects/<xx>/tmp_obj_<random>`,
`fsync`, then `rename` into place. An existing target is left untouched
(content addressing makes rewriting pointless and racy).

On read the framing is re-parsed and **must** satisfy: a known type, a
`\0` terminator, a declared length equal to the remaining byte count, and —
for untrusted sources (network, import, migration) — a recomputed oid equal to
the requested one. A mismatch is an error, never a miss.

## 3. Tree objects

Payload is the concatenation, with no separators, of entries:

```
<mode> <name> NUL <32-byte raw oid>
```

- `<mode>` is ASCII octal with **no leading zero**: `40000` (tree),
  `100644` (regular), `100755` (executable), `120000` (symlink),
  `160000` (gitlink). No other value may be written; other values are
  preserved on read only for pass-through transport.
- `<name>` is a **basename**. It contains no `/`, and is never `.`, `..` or
  `.git`. Nested directories are separate tree objects.
- Names are stored in Git's `base_name_compare` order: bytewise `memcmp` over
  the common prefix, then compare the next byte where a tree's virtual next
  byte is `/` and a non-tree's is `\0`. Practically: `a` < `a.c` < `a/`
  (i.e. directory `a` sorts after the file `a.c`).
- Symlink blobs hold the **link target bytes** read with `readlink`, not the
  content of the target.

## 4. Commit objects

```
tree <oid>\n
parent <oid>\n            (zero or more, in order, duplicates preserved)
author <identity>\n
committer <identity>\n
<other headers, verbatim and in order>
\n
<message bytes, verbatim>
```

`<identity>` is `Name <email> <epoch seconds> <±HHMM>`. `Name` may be empty;
`email` is the bytes between the first `<` and the matching `>`.

Header ordering, unknown headers (`gpgsig`, `encoding`, `mergetag`, …) and
their continuation lines (a following line beginning with a single space, with
that space stripped on parse and re-added on serialize) are **byte-preserved**.
Parsing exists for display only: for any object read from the store,
`serialize(parse(payload)) === payload` must hold, and implementations must
carry the raw payload rather than rely on that round trip when re-emitting.

## 5. Tag objects

```
object <oid>\n
type <blob|tree|commit|tag>\n
tag <name>\n
tagger <identity>\n       (optional)
<other headers, verbatim>
\n
<message bytes>
```

Lightweight tags are refs under `refs/tags/` pointing straight at a
non-tag object. Peeling follows `tag` objects with a depth limit of 32 and a
visited-set cycle check; exceeding either is a malformed-object error.

## 6. Refs

- Loose ref file: 64 hex characters plus a single `\n`.
- Symbolic ref file: `ref: <refname>\n`.
- `HEAD` is symbolic (`ref: refs/heads/<branch>`), detached (an oid), or
  unborn (symbolic to a ref that does not exist).
- `packed-refs`: first line `# pack-refs with: peeled fully-peeled sorted `,
  then `<oid> <refname>` lines sorted by refname, each optionally followed by
  `^<peeled-oid>` for annotated tags. A loose ref **shadows** the packed
  value; deleting a ref must remove both.
- Ref names are validated per `git check-ref-format`: no component starting
  with `.` or ending `.lock`, no `..`, no ASCII control characters, no
  ` ~^:?*[\`, no `//`, no trailing `/`, no trailing `.`, not `@`, no `@{`.

## 7. Locking

`<target>.lock` is created with `O_CREAT|O_EXCL`. The new content is written
into the lock file, then `rename`d over the target. A lock held by a live
process is never stolen; a stale lock is reported with its path and age, and
removing it is the operator's decision.

Ref updates take an `expected old oid`: `null` for "must not exist",
a 64-hex value for "must currently be exactly this", or `undefined` for
"no check". A mismatch aborts before the rename.

## 8. Index

Header `DIRC`, version `2`, `3` or `4` on read; version `2` on write when
every entry is representable. Entries are the canonical
`gitformat-index` layout with 32-byte oids and 62-byte fixed prefix, NUL
padded to a multiple of 8 (v2/v3) with path compression in v4.

- Stage is bits 12-13 of the flags word. Stages 1/2/3 represent conflicts.
- The trailing checksum is SHA-256 over all preceding bytes and is verified.
- Extensions: `TREE` (cache-tree) and `REUC` are understood. Per
  `gitformat-index`, an extension whose first signature byte is uppercase
  (`A`-`Z`) is **optional** and may be dropped; a lowercase signature
  (`link` for split index, `sdir` for sparse directories) is **required**, and
  an unknown required extension refuses the operation before anything is
  written. Optional extensions Gent does not maintain are dropped on write
  rather than carried forward stale.
- Writing an index that came in as v3 with `skip-worktree`/`intent-to-add`
  flags set, or as v4/split/sparse, refuses with an actionable error rather
  than silently downgrading.

## 9. Packs

- Pack: `PACK`, 4-byte version `2` or `3`, 4-byte object count, then objects,
  then a 32-byte SHA-256 trailer over everything before it.
- Object header is the variable-length size encoding with type in bits 4-6 of
  the first byte: 1 `commit`, 2 `tree`, 3 `blob`, 4 `tag`, 6 `OFS_DELTA`,
  7 `REF_DELTA`.
- `OFS_DELTA` is followed by the big-endian-ish negative offset encoding;
  `REF_DELTA` by a 32-byte raw oid.
- Delta payload: source size, target size (both varint), then copy
  (`0x80` set) and insert instructions. Copies are bounds-checked against the
  source; the produced length must equal the declared target size.
- Delta chain depth is capped at 50 and inflated size at 2 GiB per object.
- Pack index v2: `\377tOc`, version 2, 256 fanout entries, sorted oids,
  CRC32 table, 4-byte offsets with the high bit selecting an 8-byte large
  offset, pack trailer, index trailer.
- Gent **writes** full (non-delta) objects only. Gent **reads** all of the
  above, because Git will hand it deltas.

## 10. Smart HTTP (protocol v0)

- pkt-line: 4 hex length bytes covering the whole line including the length
  itself; `0000` flush; `0001` delimiter. Maximum payload 65516 bytes.
- `GET info/refs?service=git-upload-pack` returns
  `Content-Type: application/x-git-upload-pack-advertisement`, first packet
  `# service=git-upload-pack\n`, flush, then the advertisement.
- The first advertised ref line carries capabilities after a `\0`. Gent
  advertises exactly: `object-format=sha256`, `agent=gent/<version>`, and
  `symref=HEAD:<ref>` when HEAD is symbolic — plus `side-band-64k` and
  `report-status` on receive-pack. Nothing is advertised that is not
  implemented.
- Empty repository: advertisement is the capability line for the
  all-zero oid on `capabilities^{}`, then flush.
- A v2-capable client that sends `Git-Protocol: version=2` receives a v0
  advertisement and falls back; this must work with no client flags.

## 11. Deterministic migration rules (Phase 8)

Both runtimes must derive identical new ids for shared legacy history:

- `author` = legacy `author.name` / `author.email`; `committer` = the same.
- Timestamp = legacy ISO `timestamp` parsed to epoch seconds; timezone offset
  is `+0000` because the legacy format did not record one.
- Mode = `100644` for every legacy entry; the legacy format recorded no other.
- Message = legacy `message` encoded UTF-8, with exactly one trailing `\n`.
- Parents = `[parent]` then `[mergeParent]` when present, skipping nulls.
- Tree = legacy flat `tree`/`files` paths rebuilt into nested trees by
  splitting on `/`.

Any legacy record that cannot be expressed under these rules blocks migration
with the specific record identified. Nothing is invented.
