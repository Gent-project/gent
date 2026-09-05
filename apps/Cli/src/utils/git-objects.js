/**
 * ============================================================================
 * Git Objects - canonical serialization and parsing
 * ============================================================================
 *
 * PURPOSE:
 *   Byte-exact encoding and decoding of the four Git object types under
 *   SHA-256. This module owns object identity: nothing else in Gent may
 *   compute an object id.
 *
 * FRAMING:
 *   "<type> <payload byte length>\0" + payload, hashed with SHA-256.
 *
 * BYTE PRESERVATION:
 *   Commits and tags carry unknown headers, multi-line signatures and exact
 *   message bytes. Parsing is for display only — serialize(parse(x)) === x for
 *   every object this module accepts. Callers re-emitting a stored object must
 *   still prefer its raw payload; the round trip is a safety net, not a
 *   licence to rewrite history.
 *
 * See docs/git-compat/format-contract.md sections 1, 3, 4, 5.
 * ============================================================================
 */

const crypto = require('crypto');

const OID_RAW_LENGTH = 32;
const OID_HEX_LENGTH = 64;
const OBJECT_TYPES = Object.freeze(['blob', 'tree', 'commit', 'tag']);
const NULL_OID = '0'.repeat(OID_HEX_LENGTH);

/** Modes Gent is allowed to write. Others are read-only pass-through. */
const MODE = Object.freeze({
    TREE: 0o40000,
    REGULAR: 0o100644,
    EXECUTABLE: 0o100755,
    SYMLINK: 0o120000,
    GITLINK: 0o160000
});
const WRITABLE_MODES = new Set(Object.values(MODE));

const MAX_TAG_PEEL_DEPTH = 32;

/** Raised for any object that does not satisfy the format contract. */
class MalformedObjectError extends Error {
    constructor(message, details) {
        super(message);
        this.name = 'MalformedObjectError';
        this.code = 'GENT_MALFORMED_OBJECT';
        Object.assign(this, details || {});
    }
}

// ─── Object ids ──────────────────────────────────────────

/**
 * @param {String} value
 * @returns {Boolean}
 */
function isObjectId(value) {
    return typeof value === 'string' && /^[0-9a-f]{64}$/.test(value);
}

/**
 * @param {String} value
 * @param {String} [what]
 * @returns {String} the same value
 */
function assertObjectId(value, what) {
    if (!isObjectId(value)) {
        throw new MalformedObjectError(`${what || 'object id'} is not a 64-character lowercase hex SHA-256: ${JSON.stringify(value)}`);
    }
    return value;
}

/**
 * @param {String} hex
 * @returns {Buffer} 32 raw bytes
 */
function oidToRaw(hex) {
    return Buffer.from(assertObjectId(hex), 'hex');
}

/**
 * @param {Buffer} buf
 * @param {Number} [offset]
 * @returns {String} 64 hex characters
 */
function rawToOid(buf, offset = 0) {
    if (buf.length < offset + OID_RAW_LENGTH) {
        throw new MalformedObjectError('truncated object id');
    }
    return buf.toString('hex', offset, offset + OID_RAW_LENGTH);
}

// ─── Framing ─────────────────────────────────────────────

/**
 * Build the exact bytes that are hashed and stored.
 * @param {String} type
 * @param {Buffer} payload
 * @returns {Buffer}
 */
function frameObject(type, payload) {
    if (!OBJECT_TYPES.includes(type)) {
        throw new MalformedObjectError(`unknown object type '${type}'`);
    }
    if (!Buffer.isBuffer(payload)) {
        throw new TypeError('object payload must be a Buffer — no implicit text encoding on the identity path');
    }
    return Buffer.concat([Buffer.from(`${type} ${payload.length}\0`, 'latin1'), payload]);
}

/**
 * @param {String} type
 * @param {Buffer} payload
 * @returns {String} object id
 */
function hashObject(type, payload) {
    return crypto.createHash('sha256').update(frameObject(type, payload)).digest('hex');
}

/**
 * Split stored bytes back into type and payload, validating the declared size.
 * @param {Buffer} framed
 * @returns {{type: String, size: Number, payload: Buffer}}
 */
function unframeObject(framed) {
    const nul = framed.indexOf(0);
    if (nul < 0) throw new MalformedObjectError('object header has no NUL terminator');

    const header = framed.toString('latin1', 0, nul);
    const space = header.indexOf(' ');
    if (space < 0) throw new MalformedObjectError(`object header has no size: ${JSON.stringify(header)}`);

    const type = header.slice(0, space);
    const sizeText = header.slice(space + 1);
    if (!OBJECT_TYPES.includes(type)) {
        throw new MalformedObjectError(`unknown object type '${type}'`);
    }
    if (!/^(0|[1-9][0-9]*)$/.test(sizeText)) {
        throw new MalformedObjectError(`object size is not a canonical decimal: ${JSON.stringify(sizeText)}`);
    }

    const size = Number(sizeText);
    const payload = framed.subarray(nul + 1);
    if (payload.length !== size) {
        throw new MalformedObjectError(`object size mismatch: header says ${size}, payload is ${payload.length}`);
    }
    return { type, size, payload };
}

// ─── Trees ───────────────────────────────────────────────

/**
 * Git's base_name_compare: bytewise, with a directory's virtual next byte '/'.
 * @param {{name: String, mode: Number}} a
 * @param {{name: String, mode: Number}} b
 * @returns {Number}
 */
function compareTreeEntries(a, b) {
    const an = Buffer.from(a.name, 'utf8');
    const bn = Buffer.from(b.name, 'utf8');
    const common = Math.min(an.length, bn.length);
    const cmp = an.compare(bn, 0, common, 0, common);
    if (cmp !== 0) return cmp;

    let ac = an.length > common ? an[common] : (a.mode === MODE.TREE ? 0x2f : 0);
    let bc = bn.length > common ? bn[common] : (b.mode === MODE.TREE ? 0x2f : 0);
    return ac < bc ? -1 : ac > bc ? 1 : 0;
}

/**
 * Reject names that cannot appear inside a tree object.
 * @param {String} name
 */
function assertTreeEntryName(name) {
    if (typeof name !== 'string' || name.length === 0) {
        throw new MalformedObjectError('tree entry name is empty');
    }
    if (name.includes('/')) {
        throw new MalformedObjectError(`tree entry name must be a basename, got '${name}'`);
    }
    if (name.includes('\0')) {
        throw new MalformedObjectError('tree entry name contains NUL');
    }
    if (name === '.' || name === '..') {
        throw new MalformedObjectError(`tree entry name '${name}' is reserved`);
    }
    if (name.toLowerCase() === '.git') {
        throw new MalformedObjectError("tree entry name '.git' is reserved");
    }
}

/**
 * @param {Array<{mode: Number, name: String, oid: String}>} entries
 * @returns {Buffer}
 */
function serializeTree(entries) {
    const sorted = [...entries].sort(compareTreeEntries);

    const parts = [];
    let previous = null;
    for (const entry of sorted) {
        assertTreeEntryName(entry.name);
        if (!WRITABLE_MODES.has(entry.mode)) {
            throw new MalformedObjectError(`tree entry '${entry.name}' has mode ${entry.mode.toString(8)}, which Gent does not write`);
        }
        if (previous && previous.name === entry.name) {
            throw new MalformedObjectError(`duplicate tree entry '${entry.name}'`);
        }
        previous = entry;
        parts.push(Buffer.from(`${entry.mode.toString(8)} ${entry.name}\0`, 'utf8'));
        parts.push(oidToRaw(entry.oid));
    }
    return Buffer.concat(parts);
}

/**
 * @param {Buffer} payload
 * @returns {Array<{mode: Number, name: String, oid: String, type: String}>}
 */
function parseTree(payload) {
    const entries = [];
    let offset = 0;

    while (offset < payload.length) {
        const space = payload.indexOf(0x20, offset);
        if (space < 0) throw new MalformedObjectError('tree entry has no mode separator');

        const modeText = payload.toString('latin1', offset, space);
        if (!/^[0-7]{5,6}$/.test(modeText)) {
            throw new MalformedObjectError(`tree entry mode is not octal: ${JSON.stringify(modeText)}`);
        }
        if (modeText[0] === '0') {
            throw new MalformedObjectError(`tree entry mode has a leading zero: ${modeText}`);
        }

        const nul = payload.indexOf(0, space + 1);
        if (nul < 0) throw new MalformedObjectError('tree entry name has no NUL terminator');

        const name = payload.toString('utf8', space + 1, nul);
        const oid = rawToOid(payload, nul + 1);
        const mode = parseInt(modeText, 8);

        entries.push({ mode, name, oid, type: modeToType(mode) });
        offset = nul + 1 + OID_RAW_LENGTH;
    }

    if (offset !== payload.length) throw new MalformedObjectError('trailing bytes in tree object');
    return entries;
}

/**
 * @param {Number} mode
 * @returns {String} 'tree' | 'blob' | 'commit' (gitlink)
 */
function modeToType(mode) {
    if (mode === MODE.TREE) return 'tree';
    if (mode === MODE.GITLINK) return 'commit';
    return 'blob';
}

// ─── Identities ──────────────────────────────────────────

/**
 * @param {{name: String, email: String, timestamp: Number, timezone: String}} identity
 * @returns {String}
 */
function formatIdentity(identity) {
    const { name = '', email = '', timestamp, timezone } = identity;
    if (!Number.isInteger(timestamp)) {
        throw new MalformedObjectError(`identity timestamp must be integer epoch seconds, got ${timestamp}`);
    }
    if (!/^[+-][0-9]{4}$/.test(timezone)) {
        throw new MalformedObjectError(`identity timezone must be ±HHMM, got ${JSON.stringify(timezone)}`);
    }
    if (name.includes('<') || name.includes('>') || name.includes('\n')) {
        throw new MalformedObjectError(`identity name may not contain '<', '>' or a newline: ${JSON.stringify(name)}`);
    }
    if (email.includes('<') || email.includes('>') || email.includes('\n')) {
        throw new MalformedObjectError(`identity email may not contain '<', '>' or a newline: ${JSON.stringify(email)}`);
    }
    return `${name} <${email}> ${timestamp} ${timezone}`;
}

/**
 * Tolerant parse — display only. Never used to re-derive an object id.
 * @param {String} value
 * @returns {{name, email, timestamp, timezone, raw}}
 */
function parseIdentity(value) {
    const open = value.indexOf('<');
    const close = value.indexOf('>', open + 1);
    if (open < 0 || close < 0) {
        return { name: value.trim(), email: '', timestamp: 0, timezone: '+0000', raw: value };
    }
    const name = value.slice(0, open).trimEnd();
    const email = value.slice(open + 1, close);
    const rest = value.slice(close + 1).trim().split(/\s+/);
    const timestamp = Number.parseInt(rest[0], 10);
    const timezone = /^[+-][0-9]{4}$/.test(rest[1] || '') ? rest[1] : '+0000';
    return {
        name,
        email,
        timestamp: Number.isFinite(timestamp) ? timestamp : 0,
        timezone,
        raw: value
    };
}

/**
 * Local timezone offset in ±HHMM form for a Date.
 * @param {Date} date
 * @returns {String}
 */
function timezoneOffset(date) {
    const minutes = -date.getTimezoneOffset();
    const sign = minutes < 0 ? '-' : '+';
    const abs = Math.abs(minutes);
    return `${sign}${String(Math.floor(abs / 60)).padStart(2, '0')}${String(abs % 60).padStart(2, '0')}`;
}

// ─── Header block (shared by commit and tag) ─────────────

/**
 * Split "header\n...\n\nmessage" preserving order, unknown headers and the
 * one-leading-space continuation encoding used by multi-line signatures.
 * @param {Buffer} payload
 * @returns {{headers: Array<[String, String]>, message: Buffer}}
 */
function parseHeaderBlock(payload) {
    const headers = [];
    let offset = 0;

    while (offset < payload.length) {
        if (payload[offset] === 0x0a) {                 // blank line ends headers
            offset += 1;
            break;
        }
        let end = payload.indexOf(0x0a, offset);
        if (end < 0) end = payload.length;

        const line = payload.toString('utf8', offset, end);
        const space = line.indexOf(' ');
        const key = space < 0 ? line : line.slice(0, space);
        let value = space < 0 ? '' : line.slice(space + 1);
        offset = end + 1;

        // Continuation lines begin with a single space.
        while (offset < payload.length && payload[offset] === 0x20) {
            let contEnd = payload.indexOf(0x0a, offset);
            if (contEnd < 0) contEnd = payload.length;
            value += '\n' + payload.toString('utf8', offset + 1, contEnd);
            offset = contEnd + 1;
        }

        headers.push([key, value]);
    }

    return { headers, message: payload.subarray(offset) };
}

/**
 * @param {Array<[String, String]>} headers
 * @param {Buffer} message
 * @returns {Buffer}
 */
function serializeHeaderBlock(headers, message) {
    const parts = [];
    for (const [key, value] of headers) {
        if (key.includes(' ') || key.includes('\n')) {
            throw new MalformedObjectError(`invalid object header key ${JSON.stringify(key)}`);
        }
        const encoded = String(value).split('\n').join('\n ');
        parts.push(Buffer.from(`${key} ${encoded}\n`, 'utf8'));
    }
    parts.push(Buffer.from('\n', 'utf8'));
    parts.push(Buffer.isBuffer(message) ? message : Buffer.from(String(message), 'utf8'));
    return Buffer.concat(parts);
}

/**
 * @param {Array<[String, String]>} headers
 * @param {String} key
 * @returns {String|null}
 */
function headerValue(headers, key) {
    const found = headers.find(([k]) => k === key);
    return found ? found[1] : null;
}

// ─── Commits ─────────────────────────────────────────────

/**
 * @param {Object} commit
 * @param {String} commit.tree
 * @param {Array<String>} [commit.parents]
 * @param {Object} commit.author
 * @param {Object} commit.committer
 * @param {Buffer|String} commit.message
 * @param {Array<[String, String]>} [commit.extraHeaders] - emitted after committer
 * @returns {Buffer}
 */
function serializeCommit(commit) {
    const headers = [['tree', assertObjectId(commit.tree, 'commit tree')]];
    for (const parent of commit.parents || []) {
        headers.push(['parent', assertObjectId(parent, 'commit parent')]);
    }
    headers.push(['author', formatIdentity(commit.author)]);
    headers.push(['committer', formatIdentity(commit.committer)]);
    for (const [key, value] of commit.extraHeaders || []) {
        headers.push([key, value]);
    }
    const message = Buffer.isBuffer(commit.message) ? commit.message : Buffer.from(commit.message || '', 'utf8');
    return serializeHeaderBlock(headers, message);
}

/**
 * @param {Buffer} payload
 * @returns {Object} parsed commit, carrying `raw` and `headers` for fidelity
 */
function parseCommit(payload) {
    const { headers, message } = parseHeaderBlock(payload);

    const tree = headerValue(headers, 'tree');
    if (!tree) throw new MalformedObjectError('commit has no tree header');
    assertObjectId(tree, 'commit tree');

    const parents = headers.filter(([k]) => k === 'parent').map(([, v]) => assertObjectId(v, 'commit parent'));
    const authorRaw = headerValue(headers, 'author');
    const committerRaw = headerValue(headers, 'committer');

    return {
        type: 'commit',
        tree,
        parents,
        author: authorRaw ? parseIdentity(authorRaw) : null,
        committer: committerRaw ? parseIdentity(committerRaw) : null,
        encoding: headerValue(headers, 'encoding'),
        extraHeaders: headers.filter(([k]) => !['tree', 'parent', 'author', 'committer'].includes(k)),
        headers,
        message,
        raw: payload
    };
}

// ─── Tags ────────────────────────────────────────────────

/**
 * @param {Object} tag
 * @returns {Buffer}
 */
function serializeTag(tag) {
    if (!OBJECT_TYPES.includes(tag.targetType)) {
        throw new MalformedObjectError(`tag target type '${tag.targetType}' is not an object type`);
    }
    const headers = [
        ['object', assertObjectId(tag.object, 'tag object')],
        ['type', tag.targetType],
        ['tag', tag.tag]
    ];
    if (tag.tagger) headers.push(['tagger', formatIdentity(tag.tagger)]);
    for (const [key, value] of tag.extraHeaders || []) headers.push([key, value]);

    const message = Buffer.isBuffer(tag.message) ? tag.message : Buffer.from(tag.message || '', 'utf8');
    return serializeHeaderBlock(headers, message);
}

/**
 * @param {Buffer} payload
 * @returns {Object}
 */
function parseTag(payload) {
    const { headers, message } = parseHeaderBlock(payload);

    const object = headerValue(headers, 'object');
    const targetType = headerValue(headers, 'type');
    const name = headerValue(headers, 'tag');
    if (!object) throw new MalformedObjectError('tag has no object header');
    assertObjectId(object, 'tag object');
    if (!OBJECT_TYPES.includes(targetType)) {
        throw new MalformedObjectError(`tag type header '${targetType}' is not an object type`);
    }

    const taggerRaw = headerValue(headers, 'tagger');
    return {
        type: 'tag',
        object,
        targetType,
        tag: name,
        tagger: taggerRaw ? parseIdentity(taggerRaw) : null,
        extraHeaders: headers.filter(([k]) => !['object', 'type', 'tag', 'tagger'].includes(k)),
        headers,
        message,
        raw: payload
    };
}

module.exports = {
    OID_RAW_LENGTH,
    OID_HEX_LENGTH,
    OBJECT_TYPES,
    NULL_OID,
    MODE,
    WRITABLE_MODES,
    MAX_TAG_PEEL_DEPTH,
    MalformedObjectError,

    isObjectId,
    assertObjectId,
    oidToRaw,
    rawToOid,

    frameObject,
    hashObject,
    unframeObject,

    compareTreeEntries,
    assertTreeEntryName,
    serializeTree,
    parseTree,
    modeToType,

    formatIdentity,
    parseIdentity,
    timezoneOffset,

    parseHeaderBlock,
    serializeHeaderBlock,
    headerValue,

    serializeCommit,
    parseCommit,
    serializeTag,
    parseTag
};
