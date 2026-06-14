/**
 * ============================================================================
 * Hash Engine - Content-Addressable Object Store
 * ============================================================================
 *
 * PURPOSE:
 *   Git-like blob/tree storage using SHA-256 content addressing.
 *   Files are stored once (deduplicated) and retrieved by hash.
 *
 * STORAGE LAYOUT:
 *   .gent/objects/<2-char-prefix>/<remaining-hash>
 *   Example: .gent/objects/ab/cdef1234567890...
 *
 * OBJECT FORMAT (on disk):
 *   zlib-compressed( "<type> <size>\0<content>" )
 *   Where type = "blob" | "tree"
 *
 * HASHING ALGORITHMS:
 *   1. SHA-256 (crypto.createHash) — for content-addressable storage
 *      Same approach as git but uses SHA-256 instead of SHA-1.
 *      Input: type header + null byte + raw content
 *      Output: 64-char hex string
 *
 *   2. FNV-1a 32-bit — for fast line-level fingerprinting
 *      Used by diff engine to quickly compare lines.
 *      Non-cryptographic, optimized for speed over collision resistance.
 *
 * DEDUPLICATION:
 *   Before writing, check if object file exists → skip if so.
 *   Identical content always produces same hash → automatic dedup.
 *
 * COMPRESSION:
 *   zlib.deflate before write, zlib.inflate on read.
 *   Typically 60-80% size reduction for text files.
 *
 * BACKEND EXPECTATIONS:
 *   Backend should implement equivalent object store:
 *   - POST /api/repos/:id/push/ receives base64-encoded blobs
 *   - Backend computes same SHA-256 hash to verify integrity
 *   - Store in DB or filesystem with same addressing scheme
 *   - GET /api/repos/:id/pull/ returns base64 blob data
 *
 * ============================================================================
 */

const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');
const zlib = require('zlib');
const { promisify } = require('util');

const deflate = promisify(zlib.deflate);
const inflate = promisify(zlib.inflate);

// ─── Primitive Hashing ───────────────────────────────────

/**
 * SHA-256 hash of raw input.
 * @param {Buffer|String} input
 * @returns {String}
 */
function sha256(input) {
    return crypto.createHash('sha256').update(input).digest('hex');
}

/**
 * FNV-1a 32-bit fast non-crypto hash for line tracking.
 * @param {String} value
 * @returns {String}
 */
function fnv1a32(value) {
    let hash = 0x811c9dc5;
    for (let i = 0; i < value.length; i++) {
        hash ^= value.charCodeAt(i);
        hash = (hash >>> 0) * 0x01000193;
    }
    return (hash >>> 0).toString(16).padStart(8, '0');
}

/**
 * Hash each line of text.
 * @param {String} text
 * @returns {Array<{ lineNumber: number, hash: string }>}
 */
function hashLines(text) {
    const lines = splitLines(text);
    return lines.map((line, index) => ({
        lineNumber: index + 1,
        hash: fnv1a32(line)
    }));
}

/**
 * Split text into lines (normalizes CRLF).
 * @param {String} text
 * @returns {Array<String>}
 */
function splitLines(text) {
    if (!text) return [];
    return text.replace(/\r\n/g, '\n').split('\n');
}

/**
 * Check if buffer looks binary (contains null bytes).
 * @param {Buffer} buffer
 * @returns {Boolean}
 */
function isBinaryBuffer(buffer) {
    const probeLength = Math.min(buffer.length, 8000);
    for (let i = 0; i < probeLength; i++) {
        if (buffer[i] === 0) return true;
    }
    return false;
}

// ─── Content-Addressable Object Hashing ──────────────────

/**
 * Hash content with type prefix: "<type> <size>\0<content>"
 * @param {String} type - 'blob' | 'tree'
 * @param {Buffer|String} content
 * @returns {String} SHA-256 hex
 */
function hashObject(type, content) {
    const buf = Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf-8');
    const header = `${type} ${buf.length}\0`;
    const store = Buffer.concat([Buffer.from(header), buf]);
    return crypto.createHash('sha256').update(store).digest('hex');
}

/**
 * Hash content as blob.
 * @param {Buffer|String} content
 * @returns {String}
 */
function hashBlob(content) {
    return hashObject('blob', content);
}

/**
 * Hash a tree structure.
 * @param {Array<{mode: String, name: String, hash: String, type: String}>} entries
 * @returns {String}
 */
function hashTree(entries) {
    return hashObject('tree', serializeTree(entries));
}

// ─── Object Store (disk read/write) ─────────────────────

/**
 * Filesystem path for object: objects/ab/cdef1234...
 */
function objectPath(gentPath, hash) {
    return path.join(gentPath, 'objects', hash.substring(0, 2), hash.substring(2));
}

/**
 * Check if object exists in store.
 * @param {String} gentPath
 * @param {String} hash
 * @returns {Promise<Boolean>}
 */
async function objectExists(gentPath, hash) {
    try {
        await fs.access(objectPath(gentPath, hash));
        return true;
    } catch {
        return false;
    }
}

/**
 * Store blob (file content). Compressed with zlib. Deduplicates.
 * @param {String} gentPath
 * @param {Buffer|String} content
 * @returns {Promise<String>} hash
 */
async function storeBlob(gentPath, content) {
    const buf = Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf-8');
    const hash = hashBlob(buf);

    if (await objectExists(gentPath, hash)) return hash;

    const header = `blob ${buf.length}\0`;
    const store = Buffer.concat([Buffer.from(header), buf]);
    const compressed = await deflate(store);

    const objPath = objectPath(gentPath, hash);
    await fs.mkdir(path.dirname(objPath), { recursive: true });
    await fs.writeFile(objPath, compressed);

    return hash;
}

/**
 * Read blob raw content from store.
 * @param {String} gentPath
 * @param {String} hash
 * @returns {Promise<Buffer>}
 */
async function readBlob(gentPath, hash) {
    const objPath = objectPath(gentPath, hash);
    const compressed = await fs.readFile(objPath);
    const raw = await inflate(compressed);
    const nullIndex = raw.indexOf(0);
    return raw.slice(nullIndex + 1);
}

/**
 * Read blob as UTF-8 string.
 * @param {String} gentPath
 * @param {String} hash
 * @returns {Promise<String>}
 */
async function readBlobAsString(gentPath, hash) {
    const buf = await readBlob(gentPath, hash);
    return buf.toString('utf-8');
}

// ─── Tree Objects ────────────────────────────────────────

/**
 * Serialize tree entries to deterministic JSON (sorted by name).
 */
function serializeTree(entries) {
    const sorted = [...entries].sort((a, b) => a.name.localeCompare(b.name));
    return JSON.stringify(sorted);
}

/**
 * Deserialize tree JSON.
 */
function deserializeTree(data) {
    return JSON.parse(data);
}

/**
 * Store tree object. Entry: { mode, name, hash, type }
 * @param {String} gentPath
 * @param {Array} entries
 * @returns {Promise<String>} tree hash
 */
async function storeTree(gentPath, entries) {
    const serialized = serializeTree(entries);
    const hash = hashObject('tree', serialized);

    if (await objectExists(gentPath, hash)) return hash;

    const header = `tree ${Buffer.byteLength(serialized)}\0`;
    const store = Buffer.concat([Buffer.from(header), Buffer.from(serialized)]);
    const compressed = await deflate(store);

    const objPath = objectPath(gentPath, hash);
    await fs.mkdir(path.dirname(objPath), { recursive: true });
    await fs.writeFile(objPath, compressed);

    return hash;
}

/**
 * Read tree entries from store.
 * @param {String} gentPath
 * @param {String} hash
 * @returns {Promise<Array>}
 */
async function readTree(gentPath, hash) {
    const buf = await readBlob(gentPath, hash);
    return deserializeTree(buf.toString('utf-8'));
}

// ─── Snapshot Helpers ────────────────────────────────────

/**
 * Snapshot single file → store blob, return tree entry.
 * @param {String} gentPath
 * @param {String} cwd
 * @param {String} relativePath
 * @returns {Promise<{mode, name, hash, type}>}
 */
async function snapshotFile(gentPath, cwd, relativePath) {
    const fullPath = path.join(cwd, relativePath);
    const content = await fs.readFile(fullPath);
    const hash = await storeBlob(gentPath, content);
    return { mode: '100644', name: relativePath, hash, type: 'blob' };
}

/**
 * Snapshot multiple files → store blobs + tree.
 * @param {String} gentPath
 * @param {String} cwd
 * @param {Array<String>} files
 * @returns {Promise<{treeHash: String, entries: Array}>}
 */
async function snapshotFiles(gentPath, cwd, files) {
    const entries = [];
    for (const file of files) {
        const entry = await snapshotFile(gentPath, cwd, file);
        entries.push(entry);
    }
    const treeHash = await storeTree(gentPath, entries);
    return { treeHash, entries };
}

/**
 * Build lookup map: filePath → blobHash from tree entries.
 * @param {Array} entries
 * @returns {Map<String, String>}
 */
function treeToMap(entries) {
    const map = new Map();
    for (const e of entries) map.set(e.name, e.hash);
    return map;
}

module.exports = {
    // Primitives
    sha256,
    fnv1a32,
    hashLines,
    splitLines,
    isBinaryBuffer,
    // Content-addressable
    hashObject,
    hashBlob,
    hashTree,
    objectExists,
    storeBlob,
    readBlob,
    readBlobAsString,
    storeTree,
    readTree,
    // Snapshots
    snapshotFile,
    snapshotFiles,
    treeToMap
};
