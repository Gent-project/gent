/**
 * ============================================================================
 * Refs - loose refs, packed-refs, symbolic HEAD and reflogs
 * ============================================================================
 *
 * PURPOSE:
 *   The only place branch, tag and HEAD pointers are read or written. Every
 *   update is a compare-and-set under <ref>.lock, so an external Git writing
 *   the same ref concurrently cannot be silently overwritten.
 *
 * STORAGE:
 *   loose:      <commondir>/refs/heads/main         "<oid>\n"
 *   symbolic:   <gitdir>/HEAD                       "ref: refs/heads/main\n"
 *   packed:     <commondir>/packed-refs             "<oid> <ref>" + "^<peeled>"
 *   reflog:     <commondir>/logs/<ref>              append-only
 *
 * PRECEDENCE:
 *   A loose ref shadows the packed value. Deleting must therefore remove the
 *   loose file *and* rewrite packed-refs, or the ref comes back from the dead.
 *
 * PER-WORKTREE REFS:
 *   HEAD, ORIG_HEAD, MERGE_HEAD, CHERRY_PICK_HEAD, REVERT_HEAD, BISECT_*,
 *   refs/bisect/*, refs/worktree/* and refs/rewritten/* belong to the calling
 *   worktree's gitdir. Everything else lives in the common directory.
 *
 * See docs/git-compat/format-contract.md sections 6 and 7.
 * ============================================================================
 */

const fs = require('fs').promises;
const path = require('path');

const { isObjectId, assertObjectId, NULL_OID } = require('./git-objects');
const { withLock, writeAtomic, readFileOrNull, Lock } = require('./lockfile');

const PACKED_REFS_HEADER = '# pack-refs with: peeled fully-peeled sorted ';
const MAX_SYMREF_DEPTH = 5;

/** Refs that are private to one worktree rather than shared. */
const PER_WORKTREE_EXACT = new Set([
    'HEAD', 'ORIG_HEAD', 'FETCH_HEAD', 'MERGE_HEAD', 'CHERRY_PICK_HEAD',
    'REVERT_HEAD', 'REBASE_HEAD', 'AUTO_MERGE', 'BISECT_EXPECTED_REV'
]);
const PER_WORKTREE_PREFIXES = ['refs/bisect/', 'refs/worktree/', 'refs/rewritten/'];

class RefError extends Error {
    constructor(message, code) {
        super(message);
        this.name = 'RefError';
        this.code = code || 'GENT_BAD_REF';
    }
}

/**
 * git check-ref-format, applied to a full ref name such as refs/heads/main.
 * @param {String} name
 * @param {Object} [options]
 * @param {Boolean} [options.allowOneLevel] - HEAD and friends
 * @returns {Boolean}
 */
function isValidRefName(name, options = {}) {
    if (typeof name !== 'string' || name === '') return false;
    if (name.endsWith('/') || name.endsWith('.') || name.endsWith('.lock')) return false;
    if (name.startsWith('/')) return false;
    if (name.includes('//') || name.includes('..') || name.includes('@{')) return false;
    if (name === '@') return false;

    for (const ch of name) {
        const code = ch.codePointAt(0);
        if (code < 0x20 || code === 0x7f) return false;
        if (' ~^:?*[\\'.includes(ch)) return false;
    }

    const components = name.split('/');
    if (!options.allowOneLevel && components.length < 2) return false;

    for (const component of components) {
        if (component === '') return false;
        if (component.startsWith('.')) return false;
        if (component.endsWith('.lock')) return false;
    }
    return true;
}

/**
 * @param {String} name
 * @param {Object} [options]
 * @returns {String} the same name
 */
function assertRefName(name, options) {
    if (!isValidRefName(name, options)) {
        throw new RefError(`'${name}' is not a valid ref name`);
    }
    return name;
}

/**
 * @param {String} name
 * @returns {Boolean}
 */
function isPerWorktreeRef(name) {
    return PER_WORKTREE_EXACT.has(name) || PER_WORKTREE_PREFIXES.some(prefix => name.startsWith(prefix));
}

class RefStore {
    /**
     * @param {Object} repo - { gitdir, commondir, identity? }
     */
    constructor(repo) {
        this.gitdir = repo.gitdir;
        this.commondir = repo.commondir || repo.gitdir;
        this.repo = repo;
        this._packed = null;                                // lazily loaded cache
    }

    /**
     * Filesystem location of a ref, honouring per-worktree placement.
     * @param {String} name
     * @returns {String}
     */
    refPath(name) {
        assertRefName(name, { allowOneLevel: true });
        return path.join(isPerWorktreeRef(name) ? this.gitdir : this.commondir, ...name.split('/'));
    }

    /**
     * @param {String} name
     * @returns {String}
     */
    reflogPath(name) {
        return path.join(isPerWorktreeRef(name) ? this.gitdir : this.commondir, 'logs', ...name.split('/'));
    }

    /** Drop the packed-refs cache after anything that could change it. */
    invalidate() {
        this._packed = null;
    }

    // ─── packed-refs ─────────────────────────────────────

    /**
     * @returns {Promise<Map<String, {oid: String, peeled: String|null}>>}
     */
    async packedRefs() {
        if (this._packed) return this._packed;

        const packed = new Map();
        const raw = await readFileOrNull(path.join(this.commondir, 'packed-refs'));
        if (!raw) {
            this._packed = packed;
            return packed;
        }

        let last = null;
        for (const line of raw.toString('utf-8').split('\n')) {
            if (!line || line.startsWith('#')) continue;

            if (line.startsWith('^')) {
                const peeled = line.slice(1).trim();
                if (!last) throw new RefError('packed-refs has a peel line with no preceding ref');
                packed.get(last).peeled = assertObjectId(peeled, 'peeled ref');
                continue;
            }

            const space = line.indexOf(' ');
            if (space < 0) throw new RefError(`malformed packed-refs line: ${JSON.stringify(line)}`);
            const oid = line.slice(0, space);
            const name = line.slice(space + 1).trim();
            if (!isObjectId(oid) || !isValidRefName(name, { allowOneLevel: true })) {
                throw new RefError(`malformed packed-refs line: ${JSON.stringify(line)}`);
            }
            packed.set(name, { oid, peeled: null });
            last = name;
        }

        this._packed = packed;
        return packed;
    }

    /**
     * Rewrite packed-refs from a full map. Callers hold the packed-refs lock.
     * @param {Lock} lock
     * @param {Map<String, {oid: String, peeled: String|null}>} packed
     */
    async _writePackedRefs(lock, packed) {
        const names = [...packed.keys()].sort();
        const lines = [PACKED_REFS_HEADER];
        for (const name of names) {
            const entry = packed.get(name);
            lines.push(`${entry.oid} ${name}`);
            if (entry.peeled) lines.push(`^${entry.peeled}`);
        }
        await lock.write(lines.join('\n') + '\n');
        this.invalidate();
    }

    // ─── reading ─────────────────────────────────────────

    /**
     * Raw content of a ref: an oid, or a symbolic target.
     * @param {String} name
     * @returns {Promise<{kind: 'oid'|'symbolic', value: String, loose: Boolean}|null>}
     */
    async readRef(name) {
        const raw = await readFileOrNull(this.refPath(name));
        if (raw !== null) {
            const text = raw.toString('utf-8').trim();
            if (text.startsWith('ref:')) {
                const target = text.slice(4).trim();
                assertRefName(target, { allowOneLevel: true });
                return { kind: 'symbolic', value: target, loose: true };
            }
            if (!isObjectId(text)) {
                throw new RefError(`ref '${name}' does not contain an object id: ${JSON.stringify(text.slice(0, 80))}`);
            }
            return { kind: 'oid', value: text, loose: true };
        }

        const packed = (await this.packedRefs()).get(name);
        return packed ? { kind: 'oid', value: packed.oid, loose: false } : null;
    }

    /**
     * Follow symbolic refs to an object id.
     * @param {String} name
     * @returns {Promise<{oid: String|null, ref: String, symbolic: Array<String>}>}
     *          oid is null for an unborn ref (HEAD on a branch with no commits)
     */
    async resolve(name) {
        const chain = [];
        let current = name;

        for (let depth = 0; depth < MAX_SYMREF_DEPTH; depth++) {
            const entry = await this.readRef(current);
            if (!entry) return { oid: null, ref: current, symbolic: chain };
            if (entry.kind === 'oid') return { oid: entry.value, ref: current, symbolic: chain };
            chain.push(current);
            current = entry.value;
        }
        throw new RefError(`symbolic ref '${name}' is nested more than ${MAX_SYMREF_DEPTH} levels deep`);
    }

    /**
     * @param {String} name
     * @returns {Promise<String|null>}
     */
    async resolveToOid(name) {
        return (await this.resolve(name)).oid;
    }

    /**
     * Every ref under a prefix, loose entries shadowing packed ones.
     * @param {String} [prefix] - e.g. 'refs/heads/'
     * @returns {Promise<Map<String, String>>} name -> oid
     */
    async list(prefix = 'refs/') {
        const result = new Map();

        for (const [name, entry] of await this.packedRefs()) {
            if (name.startsWith(prefix)) result.set(name, entry.oid);
        }

        const roots = new Set([path.join(this.commondir, 'refs'), path.join(this.gitdir, 'refs')]);
        for (const root of roots) {
            await this._walkLoose(root, 'refs', prefix, result);
        }
        return result;
    }

    async _walkLoose(dir, refPrefix, wanted, out) {
        let entries;
        try {
            entries = await fs.readdir(dir, { withFileTypes: true });
        } catch (error) {
            if (error.code === 'ENOENT' || error.code === 'ENOTDIR') return;
            throw error;
        }

        for (const entry of entries) {
            if (entry.name.endsWith('.lock')) continue;
            const name = `${refPrefix}/${entry.name}`;

            if (entry.isDirectory()) {
                // Descend when the prefix could still match either way.
                if (wanted.startsWith(name + '/') || name.startsWith(wanted) || wanted.startsWith(name)) {
                    await this._walkLoose(path.join(dir, entry.name), name, wanted, out);
                }
                continue;
            }
            if (!name.startsWith(wanted)) continue;

            const ref = await this.readRef(name);
            if (ref && ref.kind === 'oid') out.set(name, ref.value);
        }
    }

    /**
     * Git's ref lookup order for a user-supplied shorthand.
     * @param {String} shorthand
     * @returns {Promise<{name: String, oid: String}|null>}
     */
    async expand(shorthand) {
        const candidates = shorthand === 'HEAD'
            ? ['HEAD']
            : [
                shorthand,
                `refs/${shorthand}`,
                `refs/tags/${shorthand}`,
                `refs/heads/${shorthand}`,
                `refs/remotes/${shorthand}`,
                `refs/remotes/${shorthand}/HEAD`
            ];

        for (const candidate of candidates) {
            if (!isValidRefName(candidate, { allowOneLevel: true })) continue;
            const resolved = await this.resolve(candidate);
            if (resolved.oid) return { name: resolved.ref, oid: resolved.oid };
        }
        return null;
    }

    // ─── HEAD ────────────────────────────────────────────

    /**
     * @returns {Promise<{detached: Boolean, unborn: Boolean, ref: String|null, oid: String|null, branch: String|null}>}
     */
    async head() {
        const entry = await this.readRef('HEAD');
        if (!entry) return { detached: false, unborn: true, ref: null, oid: null, branch: null };

        if (entry.kind === 'oid') {
            return { detached: true, unborn: false, ref: null, oid: entry.value, branch: null };
        }

        const target = entry.value;
        const oid = await this.resolveToOid(target);
        return {
            detached: false,
            unborn: oid === null,
            ref: target,
            oid,
            branch: target.startsWith('refs/heads/') ? target.slice('refs/heads/'.length) : null
        };
    }

    /**
     * Point HEAD at a branch without touching the branch itself.
     * @param {String} target
     * @param {String} [reason]
     */
    async setHeadSymbolic(target, reason, expectedHead) {
        assertRefName(target);
        await this._setHead(`ref: ${target}\n`, reason || `checkout: moving to ${target}`, expectedHead);
    }

    async setHeadDetached(oid, reason, expectedHead) {
        assertObjectId(oid);
        await this._setHead(`${oid}\n`, reason || `checkout: moving to ${oid}`, expectedHead);
    }

    async _setHead(content, reason, expectedHead) {
        const before = await withLock(path.join(this.gitdir, 'HEAD'), async lock => {
            const current = await this.head();
            if (expectedHead && (current.ref !== expectedHead.ref || current.oid !== expectedHead.oid)) {
                throw new RefError('HEAD changed during the operation; refusing to overwrite it');
            }
            await lock.write(content);
            return current.oid;
        });
        this.invalidate();
        await this._appendReflog('HEAD', before, await this.resolveToOid('HEAD'), reason);
    }

    // ─── writing ─────────────────────────────────────────

    /**
     * Compare-and-set a ref.
     *
     * @param {String} name
     * @param {String} newOid
     * @param {Object} [options]
     * @param {String|null|undefined} [options.expectedOldOid]
     *        `undefined` = no check, `null` = must not exist,
     *        an oid = must currently be exactly that.
     * @param {String} [options.reason] - reflog message
     * @returns {Promise<{oldOid: String|null, newOid: String}>}
     */
    async update(name, newOid, options = {}) {
        assertRefName(name, { allowOneLevel: true });
        assertObjectId(newOid, `new value for ${name}`);

        const result = await withLock(this.refPath(name), async (lock) => {
            const current = await this._currentUnderLock(name, lock);
            this._checkExpected(name, current, options.expectedOldOid);
            await lock.write(`${newOid}\n`);
            return current;
        });

        this.invalidate();
        await this._appendReflog(name, result, newOid, options.reason || 'update');
        await this._mirrorHeadReflog(name, result, newOid, options.reason);
        return { oldOid: result, newOid };
    }

    /**
     * Delete a ref from both the loose file and packed-refs.
     * @param {String} name
     * @param {Object} [options]
     * @param {String|undefined} [options.expectedOldOid]
     * @returns {Promise<String|null>} the value that was removed
     */
    async delete(name, options = {}) {
        assertRefName(name, { allowOneLevel: true });

        const lock = await Lock.acquire(this.refPath(name));
        let current;
        try {
            current = await this._currentUnderLock(name, lock);
            this._checkExpected(name, current, options.expectedOldOid);
            await fs.rm(this.refPath(name), { force: true });
        } finally {
            await lock.release();
        }

        const packed = await this.packedRefs();
        if (packed.has(name)) {
            await withLock(path.join(this.commondir, 'packed-refs'), async (packedLock) => {
                const fresh = new Map(await this.packedRefs());
                fresh.delete(name);
                await this._writePackedRefs(packedLock, fresh);
            });
        }

        this.invalidate();
        if (current) await this._appendReflog(name, current, NULL_OID, options.reason || 'delete');
        return current;
    }

    /**
     * Apply several ref updates, stopping before the first that fails its
     * precondition. Not a filesystem transaction: earlier updates that already
     * committed stay committed and are reported, so a caller can undo them.
     *
     * @param {Array<{name, newOid?, delete?, expectedOldOid?}>} updates
     * @param {String} [reason]
     * @returns {Promise<Array<{name, oldOid, newOid}>>} applied, in order
     */
    async updateMany(updates, reason) {
        // Check every precondition first so the common case fails atomically.
        for (const update of updates) {
            const current = await this.readRef(update.name);
            const currentOid = current && current.kind === 'oid' ? current.value : null;
            this._checkExpected(update.name, currentOid, update.expectedOldOid);
        }

        const applied = [];
        for (const update of updates) {
            if (update.delete) {
                const oldOid = await this.delete(update.name, { expectedOldOid: update.expectedOldOid, reason });
                applied.push({ name: update.name, oldOid, newOid: null });
            } else {
                const result = await this.update(update.name, update.newOid, { expectedOldOid: update.expectedOldOid, reason });
                applied.push({ name: update.name, ...result });
            }
        }
        return applied;
    }

    /**
     * Read the ref while its lock is held — the loose file may have been
     * created between our earlier read and the lock.
     * @param {String} name
     * @param {Lock} lock
     * @returns {Promise<String|null>}
     */
    async _currentUnderLock(name, lock) {
        const raw = await lock.readTarget();
        if (raw !== null) {
            const text = raw.toString('utf-8').trim();
            if (text.startsWith('ref:')) {
                throw new RefError(`'${name}' is a symbolic ref; use setHeadSymbolic to change it`);
            }
            return assertObjectId(text, `current value of ${name}`);
        }
        this.invalidate();
        const packed = (await this.packedRefs()).get(name);
        return packed ? packed.oid : null;
    }

    /**
     * @param {String} name
     * @param {String|null} current
     * @param {String|null|undefined} expected
     */
    _checkExpected(name, current, expected) {
        if (expected === undefined) return;

        if (expected === null || expected === NULL_OID) {
            if (current !== null) {
                throw new RefError(
                    `'${name}' already exists (${current.slice(0, 12)}) but was expected not to`,
                    'GENT_REF_RACE'
                );
            }
            return;
        }

        assertObjectId(expected, `expected old value of ${name}`);
        if (current !== expected) {
            throw new RefError(
                `'${name}' is ${current ? current.slice(0, 12) : 'missing'}, not the expected ${expected.slice(0, 12)} — ` +
                `it changed underneath this operation`,
                'GENT_REF_RACE'
            );
        }
    }

    // ─── reflog ──────────────────────────────────────────

    /**
     * @param {String} name
     * @param {String|null} oldOid
     * @param {String|null} newOid
     * @param {String} message
     */
    async _appendReflog(name, oldOid, newOid, message) {
        const identity = this.repo.reflogIdentity ? await this.repo.reflogIdentity() : null;
        if (!identity) return;                     // no identity configured yet: skip rather than invent one

        const line =
            `${oldOid || NULL_OID} ${newOid || NULL_OID} ` +
            `${identity.name} <${identity.email}> ${identity.timestamp} ${identity.timezone}\t` +
            `${String(message).replace(/[\n\r]+/g, ' ')}\n`;

        const target = this.reflogPath(name);
        await fs.mkdir(path.dirname(target), { recursive: true });
        await fs.appendFile(target, line, 'utf-8');
    }

    /**
     * Git records branch movements in HEAD's reflog too, when HEAD points at
     * the branch being moved.
     */
    async _mirrorHeadReflog(name, oldOid, newOid, reason) {
        if (name === 'HEAD') return;
        const entry = await this.readRef('HEAD');
        if (entry && entry.kind === 'symbolic' && entry.value === name) {
            await this._appendReflog('HEAD', oldOid, newOid, reason || 'update');
        }
    }

    /**
     * @param {String} name
     * @returns {Promise<Array<{oldOid, newOid, name, email, timestamp, timezone, message}>>}
     *          newest last, matching the file order
     */
    async readReflog(name) {
        const raw = await readFileOrNull(this.reflogPath(name));
        if (!raw) return [];

        const entries = [];
        for (const line of raw.toString('utf-8').split('\n')) {
            if (!line.trim()) continue;
            const tab = line.indexOf('\t');
            const head = tab < 0 ? line : line.slice(0, tab);
            const message = tab < 0 ? '' : line.slice(tab + 1);

            const open = head.indexOf('<');
            const close = head.indexOf('>', open + 1);
            if (open < 0 || close < 0) continue;

            const [oldOid, newOid] = head.slice(0, open).trim().split(/\s+/);
            const rest = head.slice(close + 1).trim().split(/\s+/);
            entries.push({
                oldOid,
                newOid,
                name: head.slice(head.indexOf(' ', head.indexOf(' ') + 1) + 1, open).trim(),
                email: head.slice(open + 1, close),
                timestamp: Number.parseInt(rest[0], 10) || 0,
                timezone: rest[1] || '+0000',
                message
            });
        }
        return entries;
    }
}

module.exports = {
    RefStore,
    RefError,
    isValidRefName,
    assertRefName,
    isPerWorktreeRef,
    PACKED_REFS_HEADER
};
