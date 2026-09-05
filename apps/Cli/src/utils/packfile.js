/**
 * ============================================================================
 * Packfile - pack and pack-index reader/writer
 * ============================================================================
 *
 * PURPOSE:
 *   Read the packs Git produces (locally after `git gc`, and over the wire)
 *   and write the packs Gent sends. Without this, a repository Git has packed
 *   looks empty to Gent.
 *
 * READ:
 *   pack v2/v3, index v2 (including 8-byte large offsets and the CRC table),
 *   normal objects, OFS_DELTA and REF_DELTA with full copy/insert decoding.
 *   Delta chains are bounded (depth and inflated size) and every decoded
 *   object is bounds-checked; corruption is an error, never a silent miss.
 *
 * WRITE:
 *   Full, undeltified objects only. That trades transfer size for an encoder
 *   small enough to be obviously correct. Delta *decoding* stays mandatory
 *   because Git will send deltas regardless.
 *
 * THIN PACKS:
 *   A pack received over the wire may delta against objects it does not
 *   contain. resolveThinPack() completes those against the repository before
 *   anything is published.
 *
 * See docs/git-compat/format-contract.md section 9.
 * ============================================================================
 */

const fs = require('fs').promises;
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');

const {
    OID_RAW_LENGTH,
    OBJECT_TYPES,
    isObjectId,
    assertObjectId,
    hashObject,
    frameObject,
    MalformedObjectError
} = require('./git-objects');

const PACK_SIGNATURE = 0x5041434b;                 // 'PACK'
const IDX_SIGNATURE = 0xff744f63;                  // '\377tOc'
const SUPPORTED_PACK_VERSIONS = new Set([2, 3]);

const OBJ_COMMIT = 1;
const OBJ_TREE = 2;
const OBJ_BLOB = 3;
const OBJ_TAG = 4;
const OBJ_OFS_DELTA = 6;
const OBJ_REF_DELTA = 7;

const TYPE_BY_CODE = { 1: 'commit', 2: 'tree', 3: 'blob', 4: 'tag' };
const CODE_BY_TYPE = { commit: 1, tree: 2, blob: 3, tag: 4 };

const MAX_DELTA_DEPTH = 50;
const MAX_OBJECT_BYTES = 2 * 1024 * 1024 * 1024;   // 2 GiB inflated, per object

class PackError extends Error {
    constructor(message, details) {
        super(message);
        this.name = 'PackError';
        this.code = 'GENT_BAD_PACK';
        Object.assign(this, details || {});
    }
}

// ─── zlib helpers ────────────────────────────────────────

/**
 * Inflate the zlib stream starting at `offset`, reporting how many input
 * bytes it consumed so the caller can find the next object.
 *
 * @param {Buffer} buffer
 * @param {Number} offset
 * @param {Number} [expectedSize] - declared inflated size, enforced when given
 * @returns {Promise<{data: Buffer, consumed: Number}>}
 */
function inflateAt(buffer, offset, expectedSize) {
    return new Promise((resolve, reject) => {
        const stream = zlib.createInflate();
        const chunks = [];
        let total = 0;

        stream.on('data', (chunk) => {
            total += chunk.length;
            if (total > MAX_OBJECT_BYTES) {
                stream.destroy();
                reject(new PackError(`object at offset ${offset} inflates past the ${MAX_OBJECT_BYTES}-byte limit`));
                return;
            }
            chunks.push(chunk);
        });
        stream.on('error', (error) => reject(new PackError(`corrupt deflate stream at offset ${offset}: ${error.message}`)));
        stream.on('end', () => {
            const data = Buffer.concat(chunks, total);
            if (expectedSize !== undefined && data.length !== expectedSize) {
                reject(new PackError(`object at offset ${offset} declares ${expectedSize} bytes but inflates to ${data.length}`));
                return;
            }
            resolve({ data, consumed: stream.bytesWritten });
        });

        stream.end(buffer.subarray(offset));
    });
}

// ─── varints ─────────────────────────────────────────────

/**
 * Pack object header: type in bits 4-6 of the first byte, size in
 * little-endian 7-bit groups.
 * @param {Buffer} buffer
 * @param {Number} offset
 * @returns {{type: Number, size: Number, offset: Number}}
 */
function readObjectHeader(buffer, offset) {
    let byte = buffer[offset++];
    if (byte === undefined) throw new PackError('pack ends inside an object header');

    const type = (byte >> 4) & 0x7;
    let size = byte & 0x0f;
    let shift = 4;

    while (byte & 0x80) {
        byte = buffer[offset++];
        if (byte === undefined) throw new PackError('pack ends inside an object size');
        size += (byte & 0x7f) * 2 ** shift;
        shift += 7;
        if (shift > 63) throw new PackError('object size varint is absurdly long');
    }
    return { type, size, offset };
}

/**
 * OFS_DELTA's negative-offset encoding.
 * @param {Buffer} buffer
 * @param {Number} offset
 * @returns {{distance: Number, offset: Number}}
 */
function readOffsetDelta(buffer, offset) {
    let byte = buffer[offset++];
    if (byte === undefined) throw new PackError('pack ends inside a delta offset');
    let distance = byte & 0x7f;

    while (byte & 0x80) {
        byte = buffer[offset++];
        if (byte === undefined) throw new PackError('pack ends inside a delta offset');
        distance = (distance + 1) * 128 + (byte & 0x7f);
    }
    return { distance, offset };
}

/**
 * Little-endian 7-bit varint used for delta sizes.
 * @param {Buffer} buffer
 * @param {Number} offset
 * @returns {{value: Number, offset: Number}}
 */
function readDeltaSize(buffer, offset) {
    let value = 0;
    let shift = 0;
    let byte;
    do {
        byte = buffer[offset++];
        if (byte === undefined) throw new PackError('delta ends inside a size varint');
        value |= (byte & 0x7f) << shift;
        shift += 7;
    } while (byte & 0x80);
    return { value: value >>> 0, offset };
}

/**
 * Apply a delta to its base.
 * @param {Buffer} base
 * @param {Buffer} delta
 * @returns {Buffer}
 */
function applyDelta(base, delta) {
    let offset = 0;

    const sourceSize = readDeltaSize(delta, offset);
    offset = sourceSize.offset;
    if (sourceSize.value !== base.length) {
        throw new PackError(`delta expects a ${sourceSize.value}-byte base but the base is ${base.length} bytes`);
    }

    const targetSize = readDeltaSize(delta, offset);
    offset = targetSize.offset;
    if (targetSize.value > MAX_OBJECT_BYTES) {
        throw new PackError(`delta target size ${targetSize.value} exceeds the ${MAX_OBJECT_BYTES}-byte limit`);
    }

    const out = Buffer.allocUnsafe(targetSize.value);
    let written = 0;

    while (offset < delta.length) {
        const command = delta[offset++];

        if (command & 0x80) {
            let copyOffset = 0;
            let copySize = 0;
            if (command & 0x01) copyOffset |= delta[offset++];
            if (command & 0x02) copyOffset |= delta[offset++] << 8;
            if (command & 0x04) copyOffset |= delta[offset++] << 16;
            if (command & 0x08) copyOffset |= delta[offset++] * 0x1000000;
            if (command & 0x10) copySize |= delta[offset++];
            if (command & 0x20) copySize |= delta[offset++] << 8;
            if (command & 0x40) copySize |= delta[offset++] << 16;
            if (copySize === 0) copySize = 0x10000;

            if (copyOffset + copySize > base.length) {
                throw new PackError(`delta copies ${copySize} bytes at ${copyOffset}, past the end of a ${base.length}-byte base`);
            }
            if (written + copySize > out.length) {
                throw new PackError('delta produces more bytes than it declared');
            }
            base.copy(out, written, copyOffset, copyOffset + copySize);
            written += copySize;
            continue;
        }

        if (command === 0) throw new PackError('delta contains the reserved 0x00 instruction');

        if (offset + command > delta.length) throw new PackError('delta insert runs past the end of the delta');
        if (written + command > out.length) throw new PackError('delta produces more bytes than it declared');
        delta.copy(out, written, offset, offset + command);
        written += command;
        offset += command;
    }

    if (written !== out.length) {
        throw new PackError(`delta produced ${written} bytes but declared ${out.length}`);
    }
    return out;
}

// ─── pack index (.idx v2) ────────────────────────────────

class PackIndex {
    /**
     * @param {Buffer} buffer
     * @param {String} filePath
     */
    constructor(buffer, filePath) {
        this.filePath = filePath;

        if (buffer.length < 8 + 256 * 4 + 2 * OID_RAW_LENGTH) throw new PackError(`${filePath} is too short to be a pack index`);
        if (buffer.readUInt32BE(0) !== IDX_SIGNATURE) throw new PackError(`${filePath} is not a version 2 pack index`);
        if (buffer.readUInt32BE(4) !== 2) throw new PackError(`${filePath} has pack index version ${buffer.readUInt32BE(4)}; only 2 is supported`);

        this.buffer = buffer;
        this.count = buffer.readUInt32BE(8 + 255 * 4);

        this.fanoutOffset = 8;
        this.oidsOffset = this.fanoutOffset + 256 * 4;
        this.crcOffset = this.oidsOffset + this.count * OID_RAW_LENGTH;
        this.offsetsOffset = this.crcOffset + this.count * 4;
        this.largeOffsetsOffset = this.offsetsOffset + this.count * 4;

        const trailerStart = buffer.length - 2 * OID_RAW_LENGTH;
        if (this.largeOffsetsOffset > trailerStart) throw new PackError(`${filePath} is truncated`);
        this.packChecksum = buffer.toString('hex', trailerStart, trailerStart + OID_RAW_LENGTH);
    }

    /**
     * @param {String} filePath
     * @returns {Promise<PackIndex>}
     */
    static async open(filePath) {
        return new PackIndex(await fs.readFile(filePath), filePath);
    }

    /**
     * @param {Number} position
     * @returns {String}
     */
    oidAt(position) {
        const start = this.oidsOffset + position * OID_RAW_LENGTH;
        return this.buffer.toString('hex', start, start + OID_RAW_LENGTH);
    }

    /**
     * Binary search within the fanout bucket.
     * @param {String} oid
     * @returns {Number} pack offset, or -1
     */
    find(oid) {
        if (!isObjectId(oid)) return -1;

        const firstByte = Number.parseInt(oid.slice(0, 2), 16);
        let low = firstByte === 0 ? 0 : this.buffer.readUInt32BE(this.fanoutOffset + (firstByte - 1) * 4);
        let high = this.buffer.readUInt32BE(this.fanoutOffset + firstByte * 4);

        while (low < high) {
            const middle = (low + high) >>> 1;
            const candidate = this.oidAt(middle);
            if (candidate === oid) return this.offsetAt(middle);
            if (candidate < oid) low = middle + 1;
            else high = middle;
        }
        return -1;
    }

    /**
     * @param {Number} position
     * @returns {Number}
     */
    offsetAt(position) {
        const raw = this.buffer.readUInt32BE(this.offsetsOffset + position * 4);
        if ((raw & 0x80000000) === 0) return raw;

        const largeIndex = raw & 0x7fffffff;
        const at = this.largeOffsetsOffset + largeIndex * 8;
        const value = this.buffer.readBigUInt64BE(at);
        if (value > BigInt(Number.MAX_SAFE_INTEGER)) throw new PackError('pack offset exceeds the safe integer range');
        return Number(value);
    }

    /**
     * @param {Number} position
     * @returns {Number}
     */
    crcAt(position) {
        return this.buffer.readUInt32BE(this.crcOffset + position * 4);
    }

    /**
     * @returns {Array<String>}
     */
    oids() {
        const all = [];
        for (let i = 0; i < this.count; i++) all.push(this.oidAt(i));
        return all;
    }
}

/**
 * Build a version 2 pack index.
 * @param {Array<{oid: String, offset: Number, crc: Number}>} entries
 * @param {String} packChecksum - hex
 * @returns {Buffer}
 */
function buildPackIndex(entries, packChecksum) {
    const sorted = [...entries].sort((a, b) => (a.oid < b.oid ? -1 : a.oid > b.oid ? 1 : 0));

    const fanout = Buffer.alloc(256 * 4);
    let cursor = 0;
    for (let bucket = 0; bucket < 256; bucket++) {
        while (cursor < sorted.length && Number.parseInt(sorted[cursor].oid.slice(0, 2), 16) === bucket) cursor++;
        fanout.writeUInt32BE(cursor, bucket * 4);
    }

    const oids = Buffer.concat(sorted.map(e => Buffer.from(e.oid, 'hex')));

    const crcs = Buffer.alloc(sorted.length * 4);
    sorted.forEach((entry, i) => crcs.writeUInt32BE(entry.crc >>> 0, i * 4));

    const large = [];
    const offsets = Buffer.alloc(sorted.length * 4);
    sorted.forEach((entry, i) => {
        if (entry.offset < 0x80000000) {
            offsets.writeUInt32BE(entry.offset, i * 4);
        } else {
            offsets.writeUInt32BE(0x80000000 | large.length, i * 4);
            large.push(entry.offset);
        }
    });

    const largeBuffer = Buffer.alloc(large.length * 8);
    large.forEach((value, i) => largeBuffer.writeBigUInt64BE(BigInt(value), i * 8));

    const header = Buffer.alloc(8);
    header.writeUInt32BE(IDX_SIGNATURE, 0);
    header.writeUInt32BE(2, 4);

    const body = Buffer.concat([
        header, fanout, oids, crcs, offsets, largeBuffer, Buffer.from(packChecksum, 'hex')
    ]);
    return Buffer.concat([body, crypto.createHash('sha256').update(body).digest()]);
}

// ─── pack file ───────────────────────────────────────────

class PackFile {
    /**
     * @param {String} packPath
     * @param {Buffer} buffer
     * @param {PackIndex|null} index
     */
    constructor(packPath, buffer, index) {
        this.packPath = packPath;
        this.buffer = buffer;
        this.index = index;
        this.cache = new Map();                    // offset -> {type, payload}

        if (buffer.length < 12 + OID_RAW_LENGTH) throw new PackError(`${packPath} is too short to be a pack`);
        if (buffer.readUInt32BE(0) !== PACK_SIGNATURE) throw new PackError(`${packPath} does not start with PACK`);

        this.version = buffer.readUInt32BE(4);
        if (!SUPPORTED_PACK_VERSIONS.has(this.version)) {
            throw new PackError(`${packPath} is pack version ${this.version}; Gent reads 2 and 3`);
        }
        this.objectCount = buffer.readUInt32BE(8);
        this.checksum = buffer.toString('hex', buffer.length - OID_RAW_LENGTH);
    }

    /**
     * @param {String} packPath
     * @returns {Promise<PackFile>}
     */
    static async open(packPath) {
        const buffer = await fs.readFile(packPath);
        const idxPath = packPath.replace(/\.pack$/, '.idx');
        const index = await PackIndex.open(idxPath).catch((error) => {
            if (error.code === 'ENOENT') return null;
            throw error;
        });
        return new PackFile(packPath, buffer, index);
    }

    /**
     * Verify the trailing checksum. Not done on every read — that would mean
     * hashing the whole pack per object — but required before publishing an
     * incoming pack.
     * @returns {Boolean}
     */
    verifyChecksum() {
        const body = this.buffer.subarray(0, this.buffer.length - OID_RAW_LENGTH);
        return crypto.createHash('sha256').update(body).digest('hex') === this.checksum;
    }

    /**
     * @param {String} oid
     * @returns {Boolean}
     */
    has(oid) {
        return Boolean(this.index) && this.index.find(oid) >= 0;
    }

    /**
     * @param {String} oid
     * @returns {Promise<{type: String, size: Number, payload: Buffer}|null>}
     */
    async read(oid) {
        if (!this.index) return null;
        const offset = this.index.find(oid);
        if (offset < 0) return null;
        return this.readAt(offset);
    }

    /**
     * @param {Number} offset
     * @param {Number} [depth]
     * @returns {Promise<{type: String, size: Number, payload: Buffer}>}
     */
    async readAt(offset, depth = 0) {
        if (depth > MAX_DELTA_DEPTH) {
            throw new PackError(`delta chain in ${this.packPath} is deeper than ${MAX_DELTA_DEPTH}`);
        }
        const cached = this.cache.get(offset);
        if (cached) return cached;

        if (offset < 12 || offset >= this.buffer.length - OID_RAW_LENGTH) {
            throw new PackError(`offset ${offset} is outside ${this.packPath}`);
        }

        const header = readObjectHeader(this.buffer, offset);
        let cursor = header.offset;
        let baseOffset = null;
        let baseOid = null;

        if (header.type === OBJ_OFS_DELTA) {
            const delta = readOffsetDelta(this.buffer, cursor);
            cursor = delta.offset;
            baseOffset = offset - delta.distance;
            if (baseOffset < 12 || baseOffset >= offset) {
                throw new PackError(`OFS_DELTA at ${offset} points outside the pack (base ${baseOffset})`);
            }
        } else if (header.type === OBJ_REF_DELTA) {
            baseOid = this.buffer.toString('hex', cursor, cursor + OID_RAW_LENGTH);
            cursor += OID_RAW_LENGTH;
        } else if (!TYPE_BY_CODE[header.type]) {
            throw new PackError(`unknown pack object type ${header.type} at offset ${offset}`);
        }

        const { data } = await inflateAt(this.buffer, cursor, header.size);

        let result;
        if (baseOffset !== null) {
            const base = await this.readAt(baseOffset, depth + 1);
            result = { type: base.type, payload: applyDelta(base.payload, data) };
        } else if (baseOid !== null) {
            const base = await this._resolveExternalBase(baseOid, depth);
            result = { type: base.type, payload: applyDelta(base.payload, data) };
        } else {
            result = { type: TYPE_BY_CODE[header.type], payload: data };
        }

        result.size = result.payload.length;
        this.cache.set(offset, result);
        return result;
    }

    /**
     * REF_DELTA bases usually live in the same pack; a thin pack's do not.
     * @param {String} baseOid
     * @param {Number} depth
     */
    async _resolveExternalBase(baseOid, depth) {
        if (this.index) {
            const offset = this.index.find(baseOid);
            if (offset >= 0) return this.readAt(offset, depth + 1);
        }
        if (this.externalBaseResolver) {
            const base = await this.externalBaseResolver(baseOid);
            if (base) return base;
        }
        throw new PackError(`REF_DELTA base ${baseOid} is not in ${this.packPath} and could not be resolved`, { oid: baseOid });
    }
}

/**
 * Every pack in <objects>/pack, presented to ObjectStore as one backend.
 * Rescans on a miss so a pack written by a concurrent `git gc` is picked up.
 */
class PackStore {
    /**
     * @param {String} objectsDir
     */
    constructor(objectsDir) {
        this.packDir = path.join(objectsDir, 'pack');
        this.packs = new Map();                    // path -> PackFile
        this.scanned = false;
    }

    /**
     * @param {Boolean} [force]
     * @returns {Promise<void>}
     */
    async scan(force = false) {
        if (this.scanned && !force) return;
        this.scanned = true;

        let names;
        try {
            names = await fs.readdir(this.packDir);
        } catch (error) {
            if (error.code === 'ENOENT') { this.packs.clear(); return; }
            throw error;
        }

        const present = new Set();
        for (const name of names) {
            if (!name.endsWith('.pack')) continue;
            const packPath = path.join(this.packDir, name);
            present.add(packPath);
            if (this.packs.has(packPath)) continue;
            try {
                this.packs.set(packPath, await PackFile.open(packPath));
            } catch (error) {
                if (error.code === 'ENOENT') continue;   // repack raced us
                throw error;
            }
        }
        for (const packPath of [...this.packs.keys()]) {
            if (!present.has(packPath)) this.packs.delete(packPath);
        }
    }

    /**
     * @param {String} oid
     * @returns {Promise<Boolean>}
     */
    async has(oid) {
        await this.scan();
        for (const pack of this.packs.values()) if (pack.has(oid)) return true;

        await this.scan(true);                     // a repack may have moved it
        for (const pack of this.packs.values()) if (pack.has(oid)) return true;
        return false;
    }

    /**
     * @param {String} oid
     * @returns {Promise<{type, size, payload}|null>}
     */
    async read(oid) {
        await this.scan();
        for (const pack of this.packs.values()) {
            const found = await pack.read(oid);
            if (found) return found;
        }

        await this.scan(true);
        for (const pack of this.packs.values()) {
            const found = await pack.read(oid);
            if (found) return found;
        }
        return null;
    }

    /**
     * @returns {Promise<Array<String>>}
     */
    async listAll() {
        await this.scan(true);
        const all = [];
        for (const pack of this.packs.values()) {
            if (pack.index) all.push(...pack.index.oids());
        }
        return all;
    }
}

// ─── writing ─────────────────────────────────────────────

/**
 * Encode a pack object header.
 * @param {Number} typeCode
 * @param {Number} size
 * @returns {Buffer}
 */
function encodeObjectHeader(typeCode, size) {
    const bytes = [];
    let remaining = size;
    let first = (typeCode << 4) | (remaining & 0x0f);
    remaining = Math.floor(remaining / 16);

    while (remaining > 0) {
        bytes.push(first | 0x80);
        first = remaining & 0x7f;
        remaining = Math.floor(remaining / 128);
    }
    bytes.push(first);
    return Buffer.from(bytes);
}

/**
 * Write a pack of full (undeltified) objects.
 *
 * @param {Array<{oid: String, type: String, payload: Buffer}>} objects
 * @returns {{pack: Buffer, entries: Array<{oid, offset, crc}>, checksum: String}}
 */
function buildPack(objects) {
    const header = Buffer.alloc(12);
    header.writeUInt32BE(PACK_SIGNATURE, 0);
    header.writeUInt32BE(2, 4);
    header.writeUInt32BE(objects.length, 8);

    const parts = [header];
    const entries = [];
    let offset = header.length;

    for (const object of objects) {
        if (!CODE_BY_TYPE[object.type]) throw new PackError(`cannot pack object type '${object.type}'`);

        const objectHeader = encodeObjectHeader(CODE_BY_TYPE[object.type], object.payload.length);
        const compressed = zlib.deflateSync(object.payload);
        const record = Buffer.concat([objectHeader, compressed]);

        entries.push({ oid: object.oid, offset, crc: zlib.crc32(record) });
        parts.push(record);
        offset += record.length;
    }

    const body = Buffer.concat(parts);
    const checksum = crypto.createHash('sha256').update(body).digest();
    return {
        pack: Buffer.concat([body, checksum]),
        entries,
        checksum: checksum.toString('hex')
    };
}

/**
 * Parse a pack that has no index yet — an incoming push or fetch. Objects are
 * decoded in order; REF_DELTA bases outside the pack go through `resolveBase`.
 *
 * @param {Buffer} buffer
 * @param {Object} [options]
 * @param {(oid: String) => Promise<{type, payload}|null>} [options.resolveBase]
 * @param {Number} [options.maxObjects]
 * @returns {Promise<Array<{oid, type, payload}>>}
 */
async function readPackStream(buffer, options = {}) {
    if (buffer.length < 12 + OID_RAW_LENGTH) throw new PackError('pack is too short');
    if (buffer.readUInt32BE(0) !== PACK_SIGNATURE) throw new PackError('pack does not start with PACK');

    const version = buffer.readUInt32BE(4);
    if (!SUPPORTED_PACK_VERSIONS.has(version)) throw new PackError(`pack version ${version} is not supported`);

    const count = buffer.readUInt32BE(8);
    if (options.maxObjects !== undefined && count > options.maxObjects) {
        throw new PackError(`pack declares ${count} objects, over the ${options.maxObjects} limit`);
    }

    const body = buffer.subarray(0, buffer.length - OID_RAW_LENGTH);
    const declared = buffer.toString('hex', buffer.length - OID_RAW_LENGTH);
    const actual = crypto.createHash('sha256').update(body).digest('hex');
    if (declared !== actual) {
        throw new PackError(`pack checksum mismatch: trailer says ${declared.slice(0, 12)}, contents hash to ${actual.slice(0, 12)}`);
    }

    const byOffset = new Map();
    const results = [];
    let offset = 12;

    for (let i = 0; i < count; i++) {
        const start = offset;
        const header = readObjectHeader(buffer, offset);
        offset = header.offset;

        let baseOffset = null;
        let baseOid = null;
        if (header.type === OBJ_OFS_DELTA) {
            const delta = readOffsetDelta(buffer, offset);
            offset = delta.offset;
            baseOffset = start - delta.distance;
        } else if (header.type === OBJ_REF_DELTA) {
            baseOid = buffer.toString('hex', offset, offset + OID_RAW_LENGTH);
            offset += OID_RAW_LENGTH;
        } else if (!TYPE_BY_CODE[header.type]) {
            throw new PackError(`unknown pack object type ${header.type} at offset ${start}`);
        }

        const { data, consumed } = await inflateAt(buffer, offset, header.size);
        offset += consumed;

        let resolved;
        if (baseOffset !== null) {
            const base = byOffset.get(baseOffset);
            if (!base) throw new PackError(`OFS_DELTA at ${start} references offset ${baseOffset}, which is not an object in this pack`);
            resolved = { type: base.type, payload: applyDelta(base.payload, data) };
        } else if (baseOid !== null) {
            let base = results.find(o => o.oid === baseOid);
            if (!base && options.resolveBase) base = await options.resolveBase(baseOid);
            if (!base) throw new PackError(`REF_DELTA base ${baseOid} is missing`, { oid: baseOid, thin: true });
            resolved = { type: base.type, payload: applyDelta(base.payload, data) };
        } else {
            resolved = { type: TYPE_BY_CODE[header.type], payload: data };
        }

        if (!OBJECT_TYPES.includes(resolved.type)) {
            throw new PackError(`object at ${start} resolved to an invalid type '${resolved.type}'`);
        }
        resolved.oid = hashObject(resolved.type, resolved.payload);
        byOffset.set(start, resolved);
        results.push(resolved);
    }

    if (offset !== body.length) {
        throw new PackError(`pack has ${body.length - offset} trailing bytes after ${count} objects`);
    }
    return results;
}

/**
 * Write a pack and its index into <objects>/pack, publishing both atomically.
 * @param {String} objectsDir
 * @param {Array<{oid, type, payload}>} objects
 * @returns {Promise<{packPath: String, idxPath: String, checksum: String}>}
 */
async function writePackToStore(objectsDir, objects) {
    const { pack, entries, checksum } = buildPack(objects);
    const idx = buildPackIndex(entries, checksum);

    const packDir = path.join(objectsDir, 'pack');
    await fs.mkdir(packDir, { recursive: true });

    const base = path.join(packDir, `pack-${checksum}`);
    const tmpPack = `${base}.pack.tmp`;
    const tmpIdx = `${base}.idx.tmp`;

    await fs.writeFile(tmpPack, pack);
    await fs.writeFile(tmpIdx, idx);
    // Index last: a .pack without a .idx is invisible, the reverse is corrupt.
    await fs.rename(tmpPack, `${base}.pack`);
    await fs.rename(tmpIdx, `${base}.idx`);

    return { packPath: `${base}.pack`, idxPath: `${base}.idx`, checksum };
}

module.exports = {
    PackError,
    PackFile,
    PackIndex,
    PackStore,
    buildPack,
    buildPackIndex,
    readPackStream,
    writePackToStore,
    applyDelta,
    inflateAt,
    encodeObjectHeader,
    MAX_DELTA_DEPTH,
    MAX_OBJECT_BYTES,
    OBJ_COMMIT,
    OBJ_TREE,
    OBJ_BLOB,
    OBJ_TAG,
    OBJ_OFS_DELTA,
    OBJ_REF_DELTA
};
