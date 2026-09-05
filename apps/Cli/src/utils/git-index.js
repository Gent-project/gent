/**
 * ============================================================================
 * Git Index - binary staging area (DIRC)
 * ============================================================================
 *
 * PURPOSE:
 *   Read and write the index Git reads and writes, so `gent add` and
 *   `git status` agree without either re-scanning the other's state.
 *
 * VERSIONS:
 *   Read 2, 3 and 4. Write 2 whenever every entry is representable in it; an
 *   entry needing a v3-only flag (skip-worktree, intent-to-add) refuses with
 *   an actionable error rather than silently dropping the flag.
 *
 * ENTRY LAYOUT (SHA-256):
 *   ctime(8) mtime(8) dev(4) ino(4) mode(4) uid(4) gid(4) size(4)
 *   oid(32) flags(2) [extended flags(2)] path NUL-padded to a multiple of 8.
 *   v4 drops the padding and prefix-compresses the path against its
 *   predecessor.
 *
 * EXTENSIONS:
 *   An uppercase first signature byte means optional (TREE, REUC, UNTR, ...);
 *   lowercase means required (link, sdir). An unknown *required* extension
 *   refuses the operation before anything is written.
 *
 * RACY TIMESTAMPS:
 *   An entry whose mtime is not strictly older than the index file's own
 *   mtime cannot be trusted as clean on stat alone; isRacy() marks those so
 *   status falls back to comparing content.
 *
 * See docs/git-compat/format-contract.md section 8.
 * ============================================================================
 */

const fs = require('fs').promises;
const crypto = require('crypto');
const path = require('path');

const { OID_RAW_LENGTH, assertObjectId, MODE } = require('./git-objects');
const { withLock, readFileOrNull, writeAtomic } = require('./lockfile');
const { UnsupportedFeatureError, feature } = require('./feature-support');

const SIGNATURE = 0x44495243;                     // 'DIRC'
const SUPPORTED_READ_VERSIONS = new Set([2, 3, 4]);
const WRITE_VERSION = 2;
/** stat block (40) + oid (32) + flags (2) */
const FIXED_ENTRY_PREFIX = 40 + OID_RAW_LENGTH + 2;

const FLAG_ASSUME_VALID = 0x8000;
const FLAG_EXTENDED = 0x4000;
const FLAG_STAGE_MASK = 0x3000;
const FLAG_NAME_MASK = 0x0fff;
const EXT_FLAG_SKIP_WORKTREE = 0x4000;
const EXT_FLAG_INTENT_TO_ADD = 0x2000;

/** Extensions Gent understands well enough to keep meaningful. */
const UNDERSTOOD_EXTENSIONS = new Set(['TREE', 'REUC']);
/** Lowercase-signature extensions with a known meaning, for better errors. */
const KNOWN_REQUIRED_EXTENSIONS = {
    link: 'index.split',
    sdir: 'index.sparse'
};

class IndexError extends Error {
    constructor(message) {
        super(message);
        this.name = 'IndexError';
        this.code = 'GENT_BAD_INDEX';
    }
}

/**
 * One index entry. `stage` 0 is the normal staged state; 1/2/3 are the base,
 * ours and theirs sides of an unresolved conflict.
 */
class IndexEntry {
    constructor(fields) {
        this.ctimeSeconds = fields.ctimeSeconds || 0;
        this.ctimeNanoseconds = fields.ctimeNanoseconds || 0;
        this.mtimeSeconds = fields.mtimeSeconds || 0;
        this.mtimeNanoseconds = fields.mtimeNanoseconds || 0;
        this.dev = fields.dev || 0;
        this.ino = fields.ino || 0;
        this.mode = fields.mode;
        this.uid = fields.uid || 0;
        this.gid = fields.gid || 0;
        this.size = fields.size || 0;
        this.oid = assertObjectId(fields.oid, `index entry ${fields.path}`);
        this.path = fields.path;
        this.stage = fields.stage || 0;
        this.assumeValid = Boolean(fields.assumeValid);
        this.skipWorktree = Boolean(fields.skipWorktree);
        this.intentToAdd = Boolean(fields.intentToAdd);
    }

    /**
     * Build an entry from a worktree lstat. Pass a `{ bigint: true }` stat for
     * true nanosecond fidelity; a plain stat degrades to millisecond
     * precision, which only costs an occasional extra content comparison.
     * @param {fs.Stats|fs.BigIntStats} stat
     * @param {String} relativePath
     * @param {String} oid
     * @param {Number} mode - one of MODE.*
     * @returns {IndexEntry}
     */
    static fromStat(stat, relativePath, oid, mode) {
        return new IndexEntry({
            ctimeSeconds: Math.floor(Number(stat.ctimeMs) / 1000),
            ctimeNanoseconds: nanosecondsOf(stat.ctimeNs, stat.ctimeMs),
            mtimeSeconds: Math.floor(Number(stat.mtimeMs) / 1000),
            mtimeNanoseconds: nanosecondsOf(stat.mtimeNs, stat.mtimeMs),
            dev: truncate32(stat.dev),
            ino: truncate32(stat.ino),
            mode,
            uid: truncate32(stat.uid),
            gid: truncate32(stat.gid),
            size: truncate32(stat.size),
            oid,
            path: relativePath
        });
    }

    /**
     * Cheap "unchanged" test. Deliberately conservative: any difference, or a
     * racy timestamp, sends the caller to a content comparison.
     * @param {fs.Stats} stat
     * @returns {Boolean}
     */
    matchesStat(stat) {
        if (this.assumeValid) return true;
        return this.mtimeSeconds === Math.floor(Number(stat.mtimeMs) / 1000) &&
            this.size === truncate32(stat.size) &&
            this.ino === truncate32(stat.ino) &&
            this.dev === truncate32(stat.dev) &&
            this.mode === modeFromStat(stat, this.mode);
    }

    /**
     * @param {Number} indexMtimeSeconds
     * @returns {Boolean} true when stat data cannot prove cleanliness
     */
    isRacy(indexMtimeSeconds) {
        return this.mtimeSeconds >= indexMtimeSeconds;
    }
}

/**
 * @param {Number|BigInt} value
 * @returns {Number}
 */
function truncate32(value) {
    return Number(BigInt.asUintN(32, BigInt(Math.trunc(Number(value || 0)))));
}

/**
 * Sub-second part of a timestamp, preferring the bigint nanosecond field.
 * @param {BigInt|undefined} nanoseconds
 * @param {Number|BigInt} milliseconds
 * @returns {Number}
 */
function nanosecondsOf(nanoseconds, milliseconds) {
    if (typeof nanoseconds === 'bigint') return Number(nanoseconds % BigInt(1e9));
    return Math.round((Number(milliseconds || 0) % 1000) * 1e6);
}

/**
 * Git's view of a worktree file's mode.
 * @param {fs.Stats} stat
 * @param {Number} [fallback] - used when the platform has no executable bit
 * @returns {Number}
 */
function modeFromStat(stat, fallback) {
    if (stat.isSymbolicLink()) return MODE.SYMLINK;
    if (stat.isDirectory()) return MODE.GITLINK;
    if (fallback === MODE.EXECUTABLE || fallback === MODE.REGULAR) {
        return (stat.mode & 0o111) ? MODE.EXECUTABLE : MODE.REGULAR;
    }
    return (stat.mode & 0o111) ? MODE.EXECUTABLE : MODE.REGULAR;
}

/**
 * Index order: path bytes ascending, then stage ascending.
 * @param {IndexEntry} a
 * @param {IndexEntry} b
 * @returns {Number}
 */
function compareEntries(a, b) {
    const cmp = Buffer.compare(Buffer.from(a.path, 'utf8'), Buffer.from(b.path, 'utf8'));
    if (cmp !== 0) return cmp;
    return a.stage - b.stage;
}

class GitIndex {
    constructor() {
        this.version = WRITE_VERSION;
        /** @type {Array<IndexEntry>} kept sorted */
        this.entries = [];
        /** @type {Map<String, Buffer>} understood extensions, verbatim */
        this.extensions = new Map();
        /** @type {Number} mtime of the file we read, for racy detection */
        this.readMtimeSeconds = 0;
        this.dirty = false;
        this.sourceBytes = null;
    }

    /**
     * @param {String} indexPath
     * @returns {Promise<GitIndex>} an empty index when the file does not exist
     */
    static async read(indexPath) {
        const raw = await readFileOrNull(indexPath);
        const index = raw ? GitIndex.parse(raw) : new GitIndex();
        index.sourceBytes = raw;
        if (raw) {
            const stat = await fs.stat(indexPath).catch(() => null);
            index.readMtimeSeconds = stat ? Math.floor(stat.mtimeMs / 1000) : 0;
        }
        return index;
    }

    /**
     * @param {Buffer} buffer
     * @returns {GitIndex}
     */
    static parse(buffer) {
        if (buffer.length < 12 + OID_RAW_LENGTH) throw new IndexError('index is too short to be valid');
        if (buffer.readUInt32BE(0) !== SIGNATURE) throw new IndexError('index does not start with DIRC');

        const version = buffer.readUInt32BE(4);
        if (!SUPPORTED_READ_VERSIONS.has(version)) {
            throw new IndexError(`index version ${version} is not supported (Gent reads 2, 3 and 4)`);
        }

        const body = buffer.subarray(0, buffer.length - OID_RAW_LENGTH);
        const stored = buffer.subarray(buffer.length - OID_RAW_LENGTH).toString('hex');
        const actual = crypto.createHash('sha256').update(body).digest('hex');
        if (stored !== actual) {
            throw new IndexError(`index checksum mismatch: file says ${stored.slice(0, 12)}, contents hash to ${actual.slice(0, 12)}`);
        }

        const index = new GitIndex();
        index.version = version;

        const count = buffer.readUInt32BE(8);
        let offset = 12;
        let previousPath = '';

        for (let i = 0; i < count; i++) {
            const parsed = parseEntry(buffer, offset, version, previousPath);
            index.entries.push(parsed.entry);
            previousPath = parsed.entry.path;
            offset = parsed.offset;
        }

        while (offset + 8 <= body.length) {
            const signature = body.toString('latin1', offset, offset + 4);
            const size = body.readUInt32BE(offset + 4);
            const start = offset + 8;
            const end = start + size;
            if (end > body.length) throw new IndexError(`index extension '${signature}' claims ${size} bytes but the file ends first`);

            const optional = /^[A-Z]/.test(signature);
            if (!optional) {
                const featureId = KNOWN_REQUIRED_EXTENSIONS[signature];
                throw new UnsupportedFeatureError(
                    [featureId
                        ? feature(featureId)
                        : {
                            id: `index.${signature}`,
                            status: 'unsupported',
                            title: `Required index extension '${signature}'`,
                            detail: 'The index cannot be interpreted without it.',
                            remedy: 'Rewrite the index with Git, or remove the feature that produced this extension.'
                        }],
                    'reading the index'
                );
            }
            if (UNDERSTOOD_EXTENSIONS.has(signature)) {
                index.extensions.set(signature, body.subarray(start, end));
            }
            offset = end;
        }

        index.entries.sort(compareEntries);
        return index;
    }

    /**
     * @param {String} filePath
     * @param {Number} [stage]
     * @returns {IndexEntry|undefined}
     */
    get(filePath, stage = 0) {
        return this.entries.find(e => e.path === filePath && e.stage === stage);
    }

    /**
     * Every entry for a path, any stage.
     * @param {String} filePath
     * @returns {Array<IndexEntry>}
     */
    getAll(filePath) {
        return this.entries.filter(e => e.path === filePath);
    }

    /**
     * Stage-0 entries only — the normal "what will be committed" view.
     * @returns {Array<IndexEntry>}
     */
    staged() {
        return this.entries.filter(e => e.stage === 0);
    }

    /**
     * @returns {Map<String, {base?: IndexEntry, ours?: IndexEntry, theirs?: IndexEntry}>}
     */
    conflicts() {
        const byPath = new Map();
        for (const entry of this.entries) {
            if (entry.stage === 0) continue;
            if (!byPath.has(entry.path)) byPath.set(entry.path, {});
            byPath.get(entry.path)[['', 'base', 'ours', 'theirs'][entry.stage]] = entry;
        }
        return byPath;
    }

    /**
     * @returns {Boolean}
     */
    hasConflicts() {
        return this.entries.some(e => e.stage !== 0);
    }

    /**
     * Insert or replace a stage-0 entry, clearing any conflict on that path.
     * @param {IndexEntry} entry
     */
    add(entry) {
        this.remove(entry.path);
        this.entries.push(entry);
        this.entries.sort(compareEntries);
        this._invalidateDerived(entry.path);
    }

    /**
     * Insert an entry at a specific stage without touching the others.
     * @param {IndexEntry} entry
     */
    addStage(entry) {
        this.entries = this.entries.filter(e => !(e.path === entry.path && e.stage === entry.stage));
        this.entries.push(entry);
        this.entries.sort(compareEntries);
        this._invalidateDerived(entry.path);
    }

    /**
     * Remove every stage of a path.
     * @param {String} filePath
     * @returns {Boolean} whether anything was removed
     */
    remove(filePath) {
        const before = this.entries.length;
        this.entries = this.entries.filter(e => e.path !== filePath);
        if (this.entries.length !== before) this._invalidateDerived(filePath);
        return this.entries.length !== before;
    }

    /**
     * Replace the conflict stages of a path with a resolved stage-0 entry.
     * @param {IndexEntry} entry
     */
    resolve(entry) {
        this.add(entry);
    }

    /**
     * Cached trees and resolve-undo data stop being true the moment an entry
     * moves. Dropping them entirely is correct and cheap; a stale cache-tree
     * would make Git write a wrong commit.
     */
    _invalidateDerived() {
        this.extensions.delete('TREE');
        this.extensions.delete('REUC');
        this.dirty = true;
    }

    /**
     * @returns {Buffer}
     */
    serialize() {
        const unrepresentable = this.entries.filter(e => e.skipWorktree || e.intentToAdd);
        if (unrepresentable.length) {
            throw new IndexError(
                `cannot write this index as version ${WRITE_VERSION}: ` +
                `${unrepresentable.map(e => e.path).join(', ')} carry skip-worktree or intent-to-add flags that only version 3 can express.\n` +
                `Clear those flags with Git, or commit through Git for these paths.`
            );
        }

        const header = Buffer.alloc(12);
        header.writeUInt32BE(SIGNATURE, 0);
        header.writeUInt32BE(WRITE_VERSION, 4);
        header.writeUInt32BE(this.entries.length, 8);

        const parts = [header];
        for (const entry of [...this.entries].sort(compareEntries)) {
            parts.push(serializeEntry(entry));
        }

        // Optional extensions Gent does not maintain are dropped rather than
        // written back stale; TREE/REUC are only kept when still valid.
        for (const [signature, data] of this.extensions) {
            const head = Buffer.alloc(8);
            head.write(signature, 0, 'latin1');
            head.writeUInt32BE(data.length, 4);
            parts.push(head, data);
        }

        const body = Buffer.concat(parts);
        return Buffer.concat([body, crypto.createHash('sha256').update(body).digest()]);
    }

    /**
     * Write under index.lock. Returns the mtime so callers can reason about
     * racy entries immediately afterwards.
     * @param {String} indexPath
     * @returns {Promise<Number>} mtime in seconds
     */
    async write(indexPath) {
        const bytes = this.serialize();
        await withLock(indexPath, async (lock) => {
            const current = await lock.readTarget();
            if (!(current === null && this.sourceBytes === null) &&
                !(current && this.sourceBytes && current.equals(this.sourceBytes))) {
                throw new IndexError("index changed since it was read; retry the operation");
            }
            const recoveryPath = path.join(path.dirname(indexPath), 'gent', 'checkout-plan.json');
            const recovery = await readFileOrNull(recoveryPath);
            if (recovery) {
                const record = JSON.parse(recovery.toString());
                record.nextIndex = bytes.toString('base64');
                await writeAtomic(recoveryPath, JSON.stringify(record));
            }
            await lock.write(bytes);
        });
        this.sourceBytes = bytes;
        this.dirty = false;
        const stat = await fs.stat(indexPath);
        this.readMtimeSeconds = Math.floor(stat.mtimeMs / 1000);
        return this.readMtimeSeconds;
    }
}

/**
 * @param {Buffer} buffer
 * @param {Number} offset
 * @param {Number} version
 * @param {String} previousPath
 * @returns {{entry: IndexEntry, offset: Number}}
 */
function parseEntry(buffer, offset, version, previousPath) {
    const start = offset;
    if (offset + FIXED_ENTRY_PREFIX > buffer.length) throw new IndexError('index entry is truncated');

    const fields = {
        ctimeSeconds: buffer.readUInt32BE(offset),
        ctimeNanoseconds: buffer.readUInt32BE(offset + 4),
        mtimeSeconds: buffer.readUInt32BE(offset + 8),
        mtimeNanoseconds: buffer.readUInt32BE(offset + 12),
        dev: buffer.readUInt32BE(offset + 16),
        ino: buffer.readUInt32BE(offset + 20),
        mode: buffer.readUInt32BE(offset + 24),
        uid: buffer.readUInt32BE(offset + 28),
        gid: buffer.readUInt32BE(offset + 32),
        size: buffer.readUInt32BE(offset + 36)
    };
    offset += 40;

    fields.oid = buffer.toString('hex', offset, offset + OID_RAW_LENGTH);
    offset += OID_RAW_LENGTH;

    const flags = buffer.readUInt16BE(offset);
    offset += 2;

    fields.assumeValid = Boolean(flags & FLAG_ASSUME_VALID);
    fields.stage = (flags & FLAG_STAGE_MASK) >> 12;
    const extended = Boolean(flags & FLAG_EXTENDED);

    if (extended) {
        if (version < 3) throw new IndexError('an extended-flag entry appeared in a version 2 index');
        const extraFlags = buffer.readUInt16BE(offset);
        offset += 2;
        fields.skipWorktree = Boolean(extraFlags & EXT_FLAG_SKIP_WORKTREE);
        fields.intentToAdd = Boolean(extraFlags & EXT_FLAG_INTENT_TO_ADD);
    }

    let nameLength = flags & FLAG_NAME_MASK;

    if (version >= 4) {
        const stripped = readVarint(buffer, offset);
        offset = stripped.offset;
        if (stripped.value > previousPath.length) {
            throw new IndexError('version 4 path prefix removes more bytes than the previous path has');
        }
        const prefix = previousPath.slice(0, previousPath.length - stripped.value);

        const nul = buffer.indexOf(0, offset);
        if (nul < 0) throw new IndexError('index entry path is not NUL-terminated');
        fields.path = prefix + buffer.toString('utf8', offset, nul);
        offset = nul + 1;
    } else {
        if (nameLength === FLAG_NAME_MASK) {
            const nul = buffer.indexOf(0, offset);
            if (nul < 0) throw new IndexError('index entry path is not NUL-terminated');
            nameLength = nul - offset;
        }
        fields.path = buffer.toString('utf8', offset, offset + nameLength);
        const entrySize = (FIXED_ENTRY_PREFIX + (extended ? 2 : 0) + nameLength + 8) & ~7;
        offset = start + entrySize;
    }

    if (fields.path.includes('\0')) throw new IndexError('index entry path contains NUL');
    return { entry: new IndexEntry(fields), offset };
}

/**
 * @param {IndexEntry} entry
 * @returns {Buffer}
 */
function serializeEntry(entry) {
    const name = Buffer.from(entry.path, 'utf8');
    const size = (FIXED_ENTRY_PREFIX + name.length + 8) & ~7;
    const buffer = Buffer.alloc(size);

    buffer.writeUInt32BE(entry.ctimeSeconds >>> 0, 0);
    buffer.writeUInt32BE(entry.ctimeNanoseconds >>> 0, 4);
    buffer.writeUInt32BE(entry.mtimeSeconds >>> 0, 8);
    buffer.writeUInt32BE(entry.mtimeNanoseconds >>> 0, 12);
    buffer.writeUInt32BE(entry.dev >>> 0, 16);
    buffer.writeUInt32BE(entry.ino >>> 0, 20);
    buffer.writeUInt32BE(entry.mode >>> 0, 24);
    buffer.writeUInt32BE(entry.uid >>> 0, 28);
    buffer.writeUInt32BE(entry.gid >>> 0, 32);
    buffer.writeUInt32BE(entry.size >>> 0, 36);
    Buffer.from(entry.oid, 'hex').copy(buffer, 40);

    let flags = Math.min(name.length, FLAG_NAME_MASK);
    flags |= (entry.stage & 0x3) << 12;
    if (entry.assumeValid) flags |= FLAG_ASSUME_VALID;
    buffer.writeUInt16BE(flags, 40 + OID_RAW_LENGTH);

    name.copy(buffer, FIXED_ENTRY_PREFIX);
    return buffer;
}

/**
 * Git's offset varint (most-significant group first, with an implicit +1).
 * @param {Buffer} buffer
 * @param {Number} offset
 * @returns {{value: Number, offset: Number}}
 */
function readVarint(buffer, offset) {
    let byte = buffer[offset++];
    let value = byte & 0x7f;
    while (byte & 0x80) {
        byte = buffer[offset++];
        if (byte === undefined) throw new IndexError('truncated varint in index');
        value = ((value + 1) << 7) | (byte & 0x7f);
    }
    return { value, offset };
}

module.exports = {
    GitIndex,
    IndexEntry,
    IndexError,
    compareEntries,
    modeFromStat,
    WRITE_VERSION,
    FIXED_ENTRY_PREFIX
};
