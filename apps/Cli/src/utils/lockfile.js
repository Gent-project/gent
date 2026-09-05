/**
 * ============================================================================
 * Lockfile - Git-compatible <target>.lock protocol
 * ============================================================================
 *
 * PURPOSE:
 *   Serialise updates to files that an external Git may also be writing, and
 *   make every update atomic. Gent takes the same lock Git takes, so the two
 *   cannot lose each other's changes.
 *
 * PROTOCOL:
 *   1. open("<target>.lock", O_CREAT | O_EXCL)   — fails if anyone holds it
 *   2. write the *new* content into the lock file, then fsync
 *   3. rename("<target>.lock", "<target>")       — atomic publish
 *   Release without commit simply unlinks the lock.
 *
 * NEVER STEAL A LOCK:
 *   A held lock means another process is mid-update. Gent reports the lock
 *   path and its age and stops. Deciding a lock is abandoned is the operator's
 *   call, never a heuristic in library code.
 *
 * See docs/git-compat/format-contract.md section 7.
 * ============================================================================
 */

const fs = require('fs').promises;
const path = require('path');

const DEFAULT_RETRIES = 5;
const DEFAULT_RETRY_DELAY_MS = 40;

class LockError extends Error {
    /**
     * @param {String} targetPath
     * @param {String} lockPath
     * @param {Number|null} ageMs
     */
    constructor(targetPath, lockPath, ageMs) {
        const age = ageMs === null ? 'unknown age' : `held for ${Math.round(ageMs / 1000)}s`;
        super(
            `cannot lock '${path.basename(targetPath)}': another process holds ${lockPath} (${age}).\n` +
            `If you are certain no Gent or Git process is running, remove that file by hand.`
        );
        this.name = 'LockError';
        this.code = 'GENT_LOCKED';
        this.targetPath = targetPath;
        this.lockPath = lockPath;
        this.ageMs = ageMs;
    }
}

class Lock {
    /**
     * @param {String} targetPath
     * @param {fs.FileHandle} handle
     */
    constructor(targetPath, handle) {
        this.targetPath = targetPath;
        this.lockPath = `${targetPath}.lock`;
        this.handle = handle;
        this.committed = false;
        this.released = false;
    }

    /**
     * @param {String} targetPath
     * @param {Object} [options]
     * @param {Number} [options.retries]
     * @param {Number} [options.mode] - permissions for the published file
     * @returns {Promise<Lock>}
     */
    static async acquire(targetPath, options = {}) {
        const retries = options.retries ?? DEFAULT_RETRIES;
        const lockPath = `${targetPath}.lock`;
        await fs.mkdir(path.dirname(targetPath), { recursive: true });

        for (let attempt = 0; ; attempt++) {
            try {
                const handle = await fs.open(lockPath, 'wx', options.mode ?? 0o666);
                return new Lock(targetPath, handle);
            } catch (error) {
                if (error.code !== 'EEXIST') throw error;
                if (attempt >= retries) {
                    let ageMs = null;
                    try {
                        ageMs = Date.now() - (await fs.stat(lockPath)).mtimeMs;
                    } catch { /* it vanished — still report a failure, not a silent success */ }
                    throw new LockError(targetPath, lockPath, ageMs);
                }
                await new Promise(resolve => setTimeout(resolve, DEFAULT_RETRY_DELAY_MS * (attempt + 1)));
            }
        }
    }

    /**
     * Current content of the locked target, or null when it does not exist.
     * Reading *after* acquiring is what makes compare-and-set safe.
     * @returns {Promise<Buffer|null>}
     */
    async readTarget() {
        try {
            return await fs.readFile(this.targetPath);
        } catch (error) {
            if (error.code === 'ENOENT') return null;
            throw error;
        }
    }

    /**
     * @param {Buffer|String} content
     */
    async write(content) {
        if (this.committed || this.released) throw new Error('lock is no longer open');
        await this.handle.writeFile(Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf-8'));
    }

    /**
     * fsync and rename into place.
     * @returns {Promise<void>}
     */
    async commit() {
        if (this.committed) return;
        if (this.released) throw new Error('lock was already released');

        await this.handle.sync();
        await this.handle.close();
        this.handle = null;
        await fs.rename(this.lockPath, this.targetPath);
        this.committed = true;
    }

    /**
     * Discard the pending update.
     * @returns {Promise<void>}
     */
    async release() {
        if (this.committed || this.released) return;
        this.released = true;
        if (this.handle) {
            await this.handle.close().catch(() => {});
            this.handle = null;
        }
        await fs.rm(this.lockPath, { force: true });
    }
}

/**
 * Acquire, run, commit — releasing on any failure.
 * The callback commits by writing; returning without writing still commits an
 * empty file, so callers that may decide not to update should call
 * `lock.release()` themselves and return a sentinel.
 *
 * @param {String} targetPath
 * @param {(lock: Lock) => Promise<any>} fn
 * @param {Object} [options]
 * @returns {Promise<any>} whatever fn returned
 */
async function withLock(targetPath, fn, options) {
    const lock = await Lock.acquire(targetPath, options);
    try {
        const result = await fn(lock);
        await lock.commit();
        return result;
    } finally {
        await lock.release();
    }
}

/**
 * Replace a file atomically without taking the .lock name — used for files
 * Git does not lock (per-worktree operation state), where a temp-and-rename is
 * correct but a .lock would confuse an external Git.
 *
 * @param {String} targetPath
 * @param {Buffer|String} content
 * @returns {Promise<void>}
 */
async function writeAtomic(targetPath, content) {
    const dir = path.dirname(targetPath);
    await fs.mkdir(dir, { recursive: true });
    const tmp = path.join(dir, `.gent_tmp_${process.pid}_${Date.now().toString(36)}`);

    let handle;
    try {
        handle = await fs.open(tmp, 'wx', 0o666);
        await handle.writeFile(Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf-8'));
        await handle.sync();
    } finally {
        if (handle) await handle.close();
    }

    try {
        await fs.rename(tmp, targetPath);
    } catch (error) {
        await fs.rm(tmp, { force: true });
        throw error;
    }
}

/**
 * @param {String} filePath
 * @returns {Promise<Buffer|null>}
 */
async function readFileOrNull(filePath) {
    try {
        return await fs.readFile(filePath);
    } catch (error) {
        if (error.code === 'ENOENT' || error.code === 'ENOTDIR') return null;
        throw error;
    }
}

module.exports = {
    Lock,
    LockError,
    withLock,
    writeAtomic,
    readFileOrNull
};
