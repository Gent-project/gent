/**
 * ============================================================================
 * Object Store - the single interface to repository objects
 * ============================================================================
 *
 * PURPOSE:
 *   Read and write canonical Git objects. Every object id in Gent comes from
 *   here or from git-objects.js; no other module may hash or lay out objects.
 *
 * LAYOUT:
 *   <gitdir>/objects/<oid[0:2]>/<oid[2:]>   zlib(framing)
 *   <gitdir>/objects/pack/*.pack|.idx       read through the pack backend
 *
 * DURABILITY:
 *   Loose writes go to a temp file in the same directory, are fsync'd, then
 *   renamed. An object that already exists is left alone — content addressing
 *   makes a rewrite pointless and a partial rewrite dangerous.
 *
 * TRUST:
 *   read() always re-validates the framing. Untrusted sources (network,
 *   import, migration) additionally recompute the id: a mismatch is a
 *   corruption error, never a cache miss.
 *
 * See docs/git-compat/format-contract.md section 2.
 * ============================================================================
 */

const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');
const { promisify } = require('util');

const deflate = promisify(zlib.deflate);
const inflate = promisify(zlib.inflate);

const {
    OID_HEX_LENGTH,
    assertObjectId,
    isObjectId,
    frameObject,
    hashObject,
    unframeObject,
    parseTree,
    parseCommit,
    parseTag,
    MalformedObjectError,
    MAX_TAG_PEEL_DEPTH
} = require('./git-objects');

/** Raised when a requested object is genuinely absent (as opposed to broken). */
class ObjectNotFoundError extends Error {
    constructor(oid) {
        super(`object ${oid} not found`);
        this.name = 'ObjectNotFoundError';
        this.code = 'GENT_OBJECT_NOT_FOUND';
        this.oid = oid;
    }
}

class ObjectStore {
    /**
     * @param {String} objectsDir - <gitdir>/objects
     * @param {Object} [options]
     * @param {Object} [options.packBackend] - set by pack-store.js in Phase 4
     */
    constructor(objectsDir, options = {}) {
        this.objectsDir = objectsDir;
        this.packBackend = options.packBackend || null;
    }

    /**
     * @param {String} oid
     * @returns {String}
     */
    loosePath(oid) {
        assertObjectId(oid);
        return path.join(this.objectsDir, oid.slice(0, 2), oid.slice(2));
    }

    /**
     * @param {String} oid
     * @returns {Promise<Boolean>}
     */
    async has(oid) {
        if (!isObjectId(oid)) return false;
        try {
            await fs.access(this.loosePath(oid));
            return true;
        } catch {
            /* fall through to packs */
        }
        return this.packBackend ? this.packBackend.has(oid) : false;
    }

    /**
     * @param {String} oid
     * @param {Object} [options]
     * @param {Boolean} [options.trusted=true] - false re-verifies the id
     * @returns {Promise<{oid, type, size, payload}>}
     */
    async read(oid, options = {}) {
        assertObjectId(oid);
        const trusted = options.trusted !== false;

        let framed = null;
        try {
            framed = await inflate(await fs.readFile(this.loosePath(oid)));
        } catch (error) {
            if (error.code !== 'ENOENT') {
                throw new MalformedObjectError(`object ${oid} could not be decompressed: ${error.message}`, { oid });
            }
        }

        if (framed) {
            const { type, size, payload } = unframeObject(framed);
            if (!trusted && hashObject(type, payload) !== oid) {
                throw new MalformedObjectError(`object ${oid} does not hash to its own name`, { oid });
            }
            return { oid, type, size, payload };
        }

        if (this.packBackend) {
            const packed = await this.packBackend.read(oid);
            if (packed) {
                if (!trusted && hashObject(packed.type, packed.payload) !== oid) {
                    throw new MalformedObjectError(`packed object ${oid} does not hash to its own name`, { oid });
                }
                return { oid, ...packed };
            }
        }

        throw new ObjectNotFoundError(oid);
    }

    /**
     * @param {String} oid
     * @param {String} expectedType
     * @returns {Promise<{oid, type, size, payload}>}
     */
    async readTyped(oid, expectedType) {
        const object = await this.read(oid);
        if (object.type !== expectedType) {
            throw new MalformedObjectError(`expected ${oid} to be a ${expectedType}, found a ${object.type}`, { oid });
        }
        return object;
    }

    /**
     * Type of an object without materialising it where the backend allows.
     * @param {String} oid
     * @returns {Promise<String>}
     */
    async typeOf(oid) {
        return (await this.read(oid)).type;
    }

    /**
     * Store an object, computing its id.
     * @param {String} type
     * @param {Buffer} payload
     * @returns {Promise<String>} oid
     */
    async write(type, payload) {
        const framed = frameObject(type, payload);
        const oid = crypto.createHash('sha256').update(framed).digest('hex');
        await this._writeLoose(oid, framed);
        return oid;
    }

    /**
     * Store an object whose id was supplied by an untrusted peer.
     * @param {String} oid
     * @param {String} type
     * @param {Buffer} payload
     * @returns {Promise<String>} oid
     */
    async writeVerified(oid, type, payload) {
        const framed = frameObject(type, payload);
        const actual = crypto.createHash('sha256').update(framed).digest('hex');
        if (actual !== assertObjectId(oid)) {
            throw new MalformedObjectError(`refusing to store object under ${oid}: its contents hash to ${actual}`, { oid, actual });
        }
        await this._writeLoose(oid, framed);
        return oid;
    }

    /**
     * @param {String} oid
     * @param {Buffer} framed
     */
    async _writeLoose(oid, framed) {
        const target = this.loosePath(oid);
        try {
            await fs.access(target);
            return;                                        // already present
        } catch {
            /* not present — write it */
        }

        const dir = path.dirname(target);
        await fs.mkdir(dir, { recursive: true });

        const compressed = await deflate(framed);
        const tmp = path.join(dir, `tmp_obj_${process.pid}_${crypto.randomBytes(6).toString('hex')}`);

        let handle;
        try {
            handle = await fs.open(tmp, 'wx', 0o444);
            await handle.writeFile(compressed);
            await handle.sync();
        } finally {
            if (handle) await handle.close();
        }

        try {
            await fs.rename(tmp, target);
        } catch (error) {
            await fs.rm(tmp, { force: true });
            if (error.code !== 'EEXIST') throw error;      // lost a benign race
        }
    }

    // ─── Typed convenience readers ───────────────────────

    /**
     * @param {String} oid
     * @returns {Promise<Buffer>}
     */
    async readBlob(oid) {
        return (await this.readTyped(oid, 'blob')).payload;
    }

    /**
     * @param {String} oid
     * @returns {Promise<Array>}
     */
    async readTree(oid) {
        return parseTree((await this.readTyped(oid, 'tree')).payload);
    }

    /**
     * @param {String} oid
     * @returns {Promise<Object>}
     */
    async readCommit(oid) {
        const object = await this.readTyped(oid, 'commit');
        return { oid, ...parseCommit(object.payload) };
    }

    /**
     * @param {String} oid
     * @returns {Promise<Object>}
     */
    async readTag(oid) {
        const object = await this.readTyped(oid, 'tag');
        return { oid, ...parseTag(object.payload) };
    }

    /**
     * Follow tag objects to the first non-tag object.
     * @param {String} oid
     * @returns {Promise<{oid: String, type: String}>}
     */
    async peel(oid) {
        const seen = new Set();
        let current = assertObjectId(oid);

        for (let depth = 0; depth <= MAX_TAG_PEEL_DEPTH; depth++) {
            if (seen.has(current)) {
                throw new MalformedObjectError(`tag chain from ${oid} is cyclic at ${current}`, { oid });
            }
            seen.add(current);

            const object = await this.read(current);
            if (object.type !== 'tag') return { oid: current, type: object.type };
            current = parseTag(object.payload).object;
        }

        throw new MalformedObjectError(`tag chain from ${oid} exceeds ${MAX_TAG_PEEL_DEPTH} levels`, { oid });
    }

    /**
     * Every loose object id in the store.
     * @returns {AsyncGenerator<String>}
     */
    async *listLoose() {
        let prefixes;
        try {
            prefixes = await fs.readdir(this.objectsDir, { withFileTypes: true });
        } catch (error) {
            if (error.code === 'ENOENT') return;
            throw error;
        }

        for (const prefix of prefixes) {
            if (!prefix.isDirectory() || !/^[0-9a-f]{2}$/.test(prefix.name)) continue;
            const names = await fs.readdir(path.join(this.objectsDir, prefix.name));
            for (const name of names) {
                const oid = prefix.name + name;
                if (oid.length === OID_HEX_LENGTH && isObjectId(oid)) yield oid;
            }
        }
    }

    /**
     * Loose oids plus every oid the pack backend knows about.
     * @returns {Promise<Set<String>>}
     */
    async listAll() {
        const all = new Set();
        for await (const oid of this.listLoose()) all.add(oid);
        if (this.packBackend) {
            for (const oid of await this.packBackend.listAll()) all.add(oid);
        }
        return all;
    }

    /**
     * Byte size of the loose object files, for `gent summary`.
     * @returns {Promise<Number>}
     */
    async looseByteSize() {
        let total = 0;
        for await (const oid of this.listLoose()) {
            try {
                total += (await fs.stat(this.loosePath(oid))).size;
            } catch { /* raced with maintenance */ }
        }
        return total;
    }
}

/**
 * Synchronous existence probe used by preflight paths that cannot await.
 * @param {String} objectsDir
 * @param {String} oid
 * @returns {Boolean}
 */
function looseObjectExistsSync(objectsDir, oid) {
    if (!isObjectId(oid)) return false;
    return fsSync.existsSync(path.join(objectsDir, oid.slice(0, 2), oid.slice(2)));
}

module.exports = {
    ObjectStore,
    ObjectNotFoundError,
    looseObjectExistsSync
};
