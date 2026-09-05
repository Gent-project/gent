/**
 * ============================================================================
 * Worktree - status, tree building and recoverable checkout
 * ============================================================================
 *
 * PURPOSE:
 *   The one layer that changes files on disk. checkout, merge, reset, stash
 *   and undo all route through it so they share the same preflight, the same
 *   path-safety rules and the same recovery record.
 *
 * PREFLIGHT BEFORE ANY WRITE:
 *   staged and unstaged changes that would be lost, untracked files that would
 *   be overwritten, unsafe destinations, and unsupported attributes are all
 *   detected first. If preflight fails, nothing has been touched.
 *
 * RECOVERY, NOT ATOMICITY:
 *   A multi-file checkout is not one filesystem transaction and pretending
 *   otherwise would be a lie. Instead the plan is written to
 *   <gitdir>/gent/checkout-plan.json before the first write and removed only after
 *   index/ref publication. An interrupted operation can be rolled back if
 *   no intervening file, index or HEAD changes invalidate its checkpoint.
 *
 * PATH SAFETY:
 *   Destinations are rejected when they escape the worktree, name a metadata
 *   directory, traverse a symlinked parent, or collide on a case-insensitive
 *   filesystem.
 * ============================================================================
 */

const fs = require('fs').promises;
const path = require('path');

const { MODE, serializeTree, modeToType } = require('./git-objects');
const { GitIndex, IndexEntry, modeFromStat } = require('./git-index');
const { IgnoreMatcher, walkWorktree } = require('./ignore');
const { AttributesMatcher } = require('./attributes');
const { writeAtomic, readFileOrNull, withLock } = require('./lockfile');
const { UnsupportedFeatureError, feature } = require('./feature-support');

const PLAN_FILE = 'checkout-plan.json';

/** Names that must never appear as a path component in a checkout target. */
const FORBIDDEN_COMPONENTS = new Set(['.', '..', '.git', '.gent']);
/** Windows device names; rejected everywhere so repositories stay portable. */
const RESERVED_WINDOWS_NAMES = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\.|$)/i;

class WorktreeError extends Error {
    constructor(message, code) {
        super(message);
        this.name = 'WorktreeError';
        this.code = code || 'GENT_WORKTREE';
    }
}

/** Raised by preflight; carries the paths so the CLI can list them. */
class CheckoutBlocked extends Error {
    /**
     * @param {Array<{path: String, reason: String}>} blockers
     */
    constructor(blockers) {
        super(
            `your local changes would be overwritten:\n` +
            blockers.map(b => `  ${b.path}  (${b.reason})`).join('\n') +
            `\nCommit, stash or discard them first.`
        );
        this.name = 'CheckoutBlocked';
        this.code = 'GENT_CHECKOUT_BLOCKED';
        this.blockers = blockers;
    }
}

// ─── Trees ───────────────────────────────────────────────

/**
 * Flatten a tree into path -> {mode, oid}, descending into subtrees.
 * @param {Object} repo
 * @param {String|null} treeOid
 * @returns {Promise<Map<String, {mode: Number, oid: String}>>}
 */
async function readTreeRecursive(repo, treeOid) {
    const result = new Map();
    if (!treeOid) return result;

    const stack = [[treeOid, '']];
    while (stack.length) {
        const [oid, prefix] = stack.pop();
        for (const entry of await repo.objects.readTree(oid)) {
            const full = prefix ? `${prefix}/${entry.name}` : entry.name;
            if (entry.mode === MODE.TREE) {
                stack.push([entry.oid, full]);
            } else {
                result.set(full, { mode: entry.mode, oid: entry.oid });
            }
        }
    }
    return result;
}

/**
 * Build nested tree objects from the stage-0 index entries and store them.
 * @param {Object} repo
 * @param {GitIndex} index
 * @returns {Promise<String>} root tree oid
 */
async function buildTreeFromIndex(repo, index) {
    const staged = index.staged();
    if (index.hasConflicts()) {
        throw new WorktreeError('cannot build a tree while the index has unresolved conflicts', 'GENT_UNMERGED');
    }

    /** Directory node: name -> node | leaf */
    const root = new Map();
    for (const entry of staged) {
        const parts = entry.path.split('/');
        let node = root;
        for (let i = 0; i < parts.length - 1; i++) {
            if (!node.has(parts[i])) node.set(parts[i], new Map());
            const child = node.get(parts[i]);
            if (!(child instanceof Map)) {
                throw new WorktreeError(`index has both a file and a directory named '${parts.slice(0, i + 1).join('/')}'`);
            }
            node = child;
        }
        node.set(parts[parts.length - 1], { mode: entry.mode, oid: entry.oid });
    }

    async function store(node) {
        const entries = [];
        for (const [name, child] of node) {
            if (child instanceof Map) {
                entries.push({ mode: MODE.TREE, name, oid: await store(child) });
            } else {
                entries.push({ mode: child.mode, name, oid: child.oid });
            }
        }
        return repo.objects.write('tree', serializeTree(entries));
    }

    return store(root);
}

// ─── Status ──────────────────────────────────────────────

/**
 * Compare HEAD, index and working tree.
 *
 * @param {Object} repo
 * @param {Object} [options]
 * @param {GitIndex} [options.index]
 * @returns {Promise<{staged, unstaged, untracked, conflicted, ignoredCount}>}
 */
async function status(repo, options = {}) {
    const worktreeRoot = repo.requireWorktree('gent status');
    const index = options.index || await GitIndex.read(repo.indexPath);
    const head = await repo.refs.head();
    const headTree = head.oid ? (await repo.objects.readCommit(head.oid)).tree : null;
    const headEntries = await readTreeRecursive(repo, headTree);

    const attributes = new AttributesMatcher(repo);
    const matcher = new IgnoreMatcher(repo);

    const staged = [];
    const unstaged = [];
    const untracked = [];
    const conflicted = [...index.conflicts().keys()].sort();

    const indexByPath = new Map(index.staged().map(e => [e.path, e]));

    // HEAD vs index
    for (const [filePath, entry] of indexByPath) {
        const headEntry = headEntries.get(filePath);
        if (!headEntry) staged.push({ path: filePath, status: 'added' });
        else if (headEntry.oid !== entry.oid) staged.push({ path: filePath, status: 'modified' });
        else if (headEntry.mode !== entry.mode) staged.push({ path: filePath, status: 'typechange' });
    }
    for (const filePath of headEntries.keys()) {
        if (!indexByPath.has(filePath) && !index.getAll(filePath).length) {
            staged.push({ path: filePath, status: 'deleted' });
        }
    }

    // Index vs working tree
    const seen = new Set();
    for await (const found of walkWorktree(repo, matcher, { tracked: new Set(indexByPath.keys()) })) {
        seen.add(found.path);
        const entry = indexByPath.get(found.path);

        if (!entry) {
            if (!index.getAll(found.path).length) untracked.push(found.path);
            continue;
        }

        const mode = modeFromStat(found.stat, entry.mode);
        if (mode !== entry.mode) {
            unstaged.push({ path: found.path, status: 'typechange' });
            continue;
        }

        // Stat equality is only conclusive when the entry is not racy.
        if (entry.matchesStat(found.stat) && !entry.isRacy(index.readMtimeSeconds)) continue;

        const oid = await hashWorktreeFile(repo, attributes, found.path, found.stat);
        if (oid !== entry.oid) unstaged.push({ path: found.path, status: 'modified' });
    }

    for (const filePath of indexByPath.keys()) {
        if (!seen.has(filePath)) unstaged.push({ path: filePath, status: 'deleted' });
    }

    staged.sort((a, b) => a.path.localeCompare(b.path));
    unstaged.sort((a, b) => a.path.localeCompare(b.path));
    untracked.sort();

    return { staged, unstaged, untracked, conflicted, head, index };
}

/**
 * Object id a worktree file would have if staged now.
 * @param {Object} repo
 * @param {AttributesMatcher} attributes
 * @param {String} relativePath
 * @param {fs.Stats} stat
 * @returns {Promise<String>}
 */
async function hashWorktreeFile(repo, attributes, relativePath, stat) {
    const { hashObject } = require('./git-objects');
    const absolute = path.join(repo.worktree, ...relativePath.split('/'));

    if (stat.isSymbolicLink()) {
        return hashObject('blob', Buffer.from(await fs.readlink(absolute), 'utf8'));
    }
    const raw = await fs.readFile(absolute);
    return hashObject('blob', await attributes.toIndex(relativePath, raw));
}

/**
 * Read a worktree file and stage it, storing the blob.
 * @param {Object} repo
 * @param {AttributesMatcher} attributes
 * @param {String} relativePath
 * @returns {Promise<IndexEntry>}
 */
async function stageWorktreeFile(repo, attributes, relativePath) {
    const absolute = path.join(repo.worktree, ...relativePath.split('/'));
    const stat = await fs.lstat(absolute);

    let content;
    let mode;
    if (stat.isSymbolicLink()) {
        content = Buffer.from(await fs.readlink(absolute), 'utf8');
        mode = MODE.SYMLINK;
    } else if (stat.isDirectory()) {
        throw new UnsupportedFeatureError(
            [{ ...feature('worktree.gitlink'), detail: `'${relativePath}' is a submodule; Gent does not stage submodule state` }],
            'staging'
        );
    } else {
        const raw = await fs.readFile(absolute);
        content = await attributes.toIndex(relativePath, raw);
        mode = repo.config.getBoolean('core.fileMode', true) && (stat.mode & 0o111)
            ? MODE.EXECUTABLE
            : MODE.REGULAR;
    }

    const oid = await repo.objects.write('blob', content);
    return IndexEntry.fromStat(stat, relativePath, oid, mode);
}

// ─── Path safety ─────────────────────────────────────────

/**
 * Reject a destination path before anything is written to it.
 * @param {Object} repo
 * @param {String} relativePath - POSIX, relative to the worktree root
 */
function assertSafeCheckoutPath(repo, relativePath) {
    if (relativePath === '' || relativePath.startsWith('/')) {
        throw new WorktreeError(`refusing to write to '${relativePath}': not a relative path`, 'GENT_UNSAFE_PATH');
    }
    if (path.isAbsolute(relativePath) || /^[A-Za-z]:/.test(relativePath)) {
        throw new WorktreeError(`refusing to write to '${relativePath}': absolute paths are not allowed`, 'GENT_UNSAFE_PATH');
    }

    for (const component of relativePath.split('/')) {
        if (component === '') {
            throw new WorktreeError(`refusing to write to '${relativePath}': empty path component`, 'GENT_UNSAFE_PATH');
        }
        if (FORBIDDEN_COMPONENTS.has(component.toLowerCase())) {
            throw new WorktreeError(`refusing to write to '${relativePath}': '${component}' is repository metadata`, 'GENT_UNSAFE_PATH');
        }
        if (RESERVED_WINDOWS_NAMES.test(component)) {
            throw new WorktreeError(`refusing to write to '${relativePath}': '${component}' is a reserved device name on Windows`, 'GENT_UNSAFE_PATH');
        }
        if (/[\x00-\x1f\x7f]/.test(component)) {
            throw new WorktreeError(`refusing to write to '${relativePath}': control character in a path component`, 'GENT_UNSAFE_PATH');
        }
    }

    const resolved = path.resolve(repo.worktree, ...relativePath.split('/'));
    const root = path.resolve(repo.worktree);
    if (resolved !== root && !resolved.startsWith(root + path.sep)) {
        throw new WorktreeError(`refusing to write to '${relativePath}': it resolves outside the working tree`, 'GENT_UNSAFE_PATH');
    }
}

/**
 * Reject a path whose parent directory is (or goes through) a symlink — the
 * classic way a malicious tree escapes the worktree.
 * @param {Object} repo
 * @param {String} relativePath
 * @returns {Promise<void>}
 */
async function assertNoSymlinkParent(repo, relativePath) {
    const components = relativePath.split('/');
    let current = repo.worktree;
    for (let i = 0; i < components.length - 1; i++) {
        current = path.join(current, components[i]);
        const stat = await fs.lstat(current).catch(() => null);
        if (stat && stat.isSymbolicLink()) {
            throw new WorktreeError(
                `refusing to write to '${relativePath}': '${components.slice(0, i + 1).join('/')}' is a symbolic link`,
                'GENT_UNSAFE_PATH'
            );
        }
    }
}

/**
 * Detect two target paths that differ only by case, which collide on macOS
 * and Windows.
 * @param {Iterable<String>} paths
 * @returns {Array<Array<String>>} colliding groups
 */
function caseCollisions(paths) {
    const byLower = new Map();
    for (const p of paths) {
        const key = p.toLowerCase();
        if (!byLower.has(key)) byLower.set(key, []);
        byLower.get(key).push(p);
    }
    return [...byLower.values()].filter(group => group.length > 1);
}

// ─── Checkout ────────────────────────────────────────────

/**
 * Work out what changing from one tree to another would do to the worktree.
 *
 * @param {Object} repo
 * @param {Object} options
 * @param {Map} options.from - current tree entries (usually the index)
 * @param {Map} options.to - target tree entries
 * @param {GitIndex} options.index
 * @param {Boolean} [options.force] - discard local modifications
 * @returns {Promise<{writes: Array, deletes: Array, blockers: Array}>}
 */
async function planCheckout(repo, options) {
    const { from, to, index, force } = options;
    const attributes = new AttributesMatcher(repo);
    const matcher = new IgnoreMatcher(repo);
    await matcher.load();

    const writes = [];
    const deletes = [];
    const blockers = [];

    for (const [filePath, target] of to) {
        assertSafeCheckoutPath(repo, filePath);
        await assertNoSymlinkParent(repo, filePath);

        const current = from.get(filePath);
        if (current && current.oid === target.oid && current.mode === target.mode && !force) continue;

        const absolute = path.join(repo.worktree, ...filePath.split('/'));
        const stat = await fs.lstat(absolute).catch(() => null);

        if (stat && stat.isDirectory() && target.mode !== MODE.GITLINK) {
            blockers.push({ path: filePath, reason: 'directory replacement requires explicit removal first' });
            continue;
        }
        if (target.mode === MODE.GITLINK) {
            blockers.push({ path: filePath, reason: 'submodule checkout is not supported' });
            continue;
        }
        if (stat && !current) {
            // An untracked file sits where a tracked one must go.
            const ignored = await matcher.isIgnored(filePath, stat.isDirectory());
            if (!force && !ignored) {
                blockers.push({ path: filePath, reason: 'untracked file would be overwritten' });
                continue;
            }
        } else if (stat && current && !force) {
            const entry = index.get(filePath);
            if (entry) {
                const dirty = !entry.matchesStat(stat) || entry.isRacy(index.readMtimeSeconds)
                    ? (await hashWorktreeFile(repo, attributes, filePath, stat)) !== entry.oid
                    : false;
                if (dirty) {
                    blockers.push({ path: filePath, reason: 'has unstaged changes' });
                    continue;
                }
            }
        }

        const attrs = await attributes.attributesFor(filePath);
        attributes.assertConvertible(filePath, attrs, 'checking out');
        const bytes = await repo.objects.readBlob(target.oid);
        const content = target.mode === MODE.SYMLINK ? bytes : await attributes.toWorktree(filePath, bytes);
        writes.push({ path: filePath, mode: target.mode, oid: target.oid, content: content.toString('base64') });
    }

    for (const [filePath, current] of from) {
        if (to.has(filePath)) continue;
        assertSafeCheckoutPath(repo, filePath);
        await assertNoSymlinkParent(repo, filePath);

        const absolute = path.join(repo.worktree, ...filePath.split('/'));
        const stat = await fs.lstat(absolute).catch(() => null);
        if (!stat) { deletes.push({ path: filePath }); continue; }
        if (stat.isDirectory()) {
            blockers.push({ path: filePath, reason: 'refusing to remove a directory or submodule' });
            continue;
        }

        if (!force) {
            const entry = index.get(filePath);
            if (entry) {
                const dirty = !entry.matchesStat(stat) || entry.isRacy(index.readMtimeSeconds)
                    ? (await hashWorktreeFile(repo, attributes, filePath, stat)) !== entry.oid
                    : false;
                if (dirty) {
                    blockers.push({ path: filePath, reason: 'has unstaged changes and would be removed' });
                    continue;
                }
            }
        }
        deletes.push({ path: filePath, oid: current.oid });
    }

    const collisions = caseCollisions(writes.map(w => w.path));
    for (const group of collisions) {
        blockers.push({
            path: group.join(', '),
            reason: 'these paths differ only by case and cannot coexist on this filesystem'
        });
    }

    return { writes, deletes, blockers };
}

/**
 * Apply a plan, recording it first so an interruption is recoverable.
 *
 * @param {Object} repo
 * @param {{writes: Array, deletes: Array, blockers: Array}} plan
 * @param {Object} [options]
 * @param {GitIndex} [options.index] - updated in place when given
 * @returns {Promise<{written: Number, deleted: Number}>}
 */
async function applyCheckout(repo, plan, options = {}) {
    if (plan.blockers.length) throw new CheckoutBlocked(plan.blockers);

    const planPath = path.join(repo.gentWorktreeMetaDir, PLAN_FILE);

    await assertNoPendingCheckout(repo, 'checkout');
    if (options.index) {
        options.index.serialize();
        const current = await readFileOrNull(repo.indexPath);
        const expected = options.index.sourceBytes;
        if (!(current === null && expected === null) && !(current && expected && current.equals(expected))) {
            throw new WorktreeError('index changed before checkout; retry the operation');
        }
    }
    const record = {
        startedAt: new Date().toISOString(),
        head: await repo.refs.head(),
        index: (await readFileOrNull(repo.indexPath))?.toString('base64') ?? null,
        writes: plan.writes,
        deletes: plan.deletes,
        before: {},
        completed: []
    };
    for (const item of [...plan.writes, ...plan.deletes]) {
        record.before[item.path] = await snapshotPath(repo, item.path);
    }
    await fs.mkdir(repo.gentWorktreeMetaDir, { recursive: true });
    await writeAtomic(planPath, JSON.stringify(record));

    const completed = [];
    let written = 0;
    let deleted = 0;

    try {
        for (const target of plan.deletes) {
            const absolute = path.join(repo.worktree, ...target.path.split('/'));
            await fs.rm(absolute, { force: true });
            await removeEmptyParents(repo, target.path);
            if (options.index) options.index.remove(target.path);
            completed.push(target.path);
            deleted++;
        }

        for (const target of plan.writes) {
            await assertNoSymlinkParent(repo, target.path);
            const absolute = path.join(repo.worktree, ...target.path.split('/'));
            await fs.mkdir(path.dirname(absolute), { recursive: true });

            if (target.mode === MODE.GITLINK) {
                await fs.mkdir(absolute, { recursive: true });    // submodule boundary only
            } else if (target.mode === MODE.SYMLINK) {
                const link = Buffer.from(target.content, 'base64').toString('utf8');
                await fs.rm(absolute, { force: true, recursive: true });
                await fs.symlink(link, absolute);
            } else {
                const content = Buffer.from(target.content, 'base64');
                await fs.rm(absolute, { force: true, recursive: true });
                await fs.writeFile(absolute, content, { mode: target.mode === MODE.EXECUTABLE ? 0o777 & ~processUmask() : 0o666 & ~processUmask() });
            }

            if (options.index) {
                const stat = await fs.lstat(absolute);
                options.index.add(IndexEntry.fromStat(stat, target.path, target.oid, target.mode));
            }
            completed.push(target.path);
            written++;
        }
    } catch (error) {
        record.completed = completed;
        record.failedWith = error.message;
        await writeAtomic(planPath, JSON.stringify(record));
        throw error;
    }

    record.completed = completed;
    record.nextIndex = options.index ? options.index.serialize().toString('base64') : record.index;
    await writeAtomic(planPath, JSON.stringify(record));
    return { written, deleted };
}

/**
 * @returns {Number}
 */
function processUmask() {
    // process.umask() with no argument is deprecated as a *setter* only.
    const current = process.umask();
    return current;
}

/**
 * Remove directories left empty by a deletion, stopping at the worktree root.
 * @param {Object} repo
 * @param {String} relativePath
 */
async function removeEmptyParents(repo, relativePath) {
    const parts = relativePath.split('/');
    for (let depth = parts.length - 1; depth > 0; depth--) {
        const directory = path.join(repo.worktree, ...parts.slice(0, depth));
        const entries = await fs.readdir(directory).catch(() => null);
        if (!entries || entries.length) return;
        await fs.rmdir(directory).catch(() => {});
    }
}

/**
 * An interrupted checkout, if one is recorded.
 * @param {Object} repo
 * @returns {Promise<Object|null>}
 */
async function pendingCheckout(repo) {
    const raw = await readFileOrNull(path.join(repo.gentWorktreeMetaDir, PLAN_FILE));
    if (!raw) return null;
    try {
        return JSON.parse(raw.toString('utf-8'));
    } catch {
        return { corrupt: true };
    }
}

/**
 * Refuse to start a new worktree operation while one is half-applied.
 * @param {Object} repo
 * @param {String} what
 */
async function assertNoPendingCheckout(repo, what) {
    const pending = await pendingCheckout(repo);
    if (!pending) return;
    throw new WorktreeError(
        `${what}: a previous checkout was interrupted after updating ${(pending.completed || []).length} path(s).\n` +
        `Run "gent checkout --abort" to restore the recorded files and index. Recovery refuses intervening changes.`,
        'GENT_CHECKOUT_PENDING'
    );
}

/** Capture exact working bytes; recovery never follows a symlink. */
async function snapshotPath(repo, name) {
    assertSafeCheckoutPath(repo, name);
    await assertNoSymlinkParent(repo, name);
    const absolute = path.join(repo.worktree, name);
    let stat;
    try { stat = await fs.lstat(absolute); } catch (error) {
        if (error.code === 'ENOENT') return null;
        throw error;
    }
    if (!stat.isFile() && !stat.isSymbolicLink()) {
        throw new WorktreeError(`cannot replace directory or special file '${name}'`);
    }
    return {
        mode: stat.isSymbolicLink() ? MODE.SYMLINK : (stat.mode & 0o111 ? MODE.EXECUTABLE : MODE.REGULAR),
        content: (stat.isSymbolicLink() ? Buffer.from(await fs.readlink(absolute)) : await fs.readFile(absolute)).toString('base64')
    };
}

/** Called only after index and HEAD/ref publication succeeds. */
async function completeCheckout(repo) {
    await fs.rm(path.join(repo.gentWorktreeMetaDir, PLAN_FILE), { force: true });
}

async function abortCheckout(repo) {
    const record = await pendingCheckout(repo);
    if (!record) throw new WorktreeError('there is no interrupted checkout');
    if (!record.before || !record.head) throw new WorktreeError('recovery record is incomplete; restore from backup');
    const head = await repo.refs.head();
    if (head.oid !== record.head.oid || head.ref !== record.head.ref) {
        throw new WorktreeError('HEAD changed after checkout began; refusing to overwrite newer history');
    }
    const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
    for (const [name, before] of Object.entries(record.before)) {
        const current = await snapshotPath(repo, name);
        const target = record.writes.find(w => w.path === name);
        const after = target ? { mode: target.mode, content: target.content } : null;
        if (!same(current, before) && !same(current, after)) {
            throw new WorktreeError(`'${name}' changed after checkout began; refusing recovery`);
        }
    }
    await withLock(repo.indexPath, async lock => {
        const raw = await lock.readTarget();
        const value = raw?.toString('base64') ?? null;
        if (value !== record.index && value !== record.nextIndex) {
            throw new WorktreeError('index changed after checkout began; refusing recovery');
        }
        for (const [name, before] of Object.entries(record.before)) {
            const absolute = path.join(repo.worktree, name);
            await fs.rm(absolute, { force: true });
            if (before) {
                await fs.mkdir(path.dirname(absolute), { recursive: true });
                const bytes = Buffer.from(before.content, 'base64');
                if (before.mode === MODE.SYMLINK) await fs.symlink(bytes.toString(), absolute);
                else await fs.writeFile(absolute, bytes, { mode: before.mode === MODE.EXECUTABLE ? 0o755 : 0o644 });
            } else await removeEmptyParents(repo, name);
        }
        await lock.write(record.index === null ? new GitIndex().serialize() : Buffer.from(record.index, 'base64'));
    });
    await completeCheckout(repo);
}

module.exports = {
    WorktreeError,
    CheckoutBlocked,
    readTreeRecursive,
    buildTreeFromIndex,
    status,
    hashWorktreeFile,
    stageWorktreeFile,
    assertSafeCheckoutPath,
    assertNoSymlinkParent,
    caseCollisions,
    planCheckout,
    applyCheckout,
    pendingCheckout,
    assertNoPendingCheckout,
    removeEmptyParents,
    PLAN_FILE,
    snapshotPath,
    completeCheckout,
    abortCheckout
};
