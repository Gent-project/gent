/**
 * ============================================================================
 * Stash Ops - real stash commits on refs/stash
 * ============================================================================
 *
 * PURPOSE:
 *   Shelve working-tree and index state as genuine commits, so a stash Gent
 *   creates can be inspected, applied or dropped by Git and vice versa.
 *   The v12 JSON stack could do none of that.
 *
 * TOPOLOGY (Git's):
 *   i = commit(tree = index tree,        parents = [HEAD])
 *   u = commit(tree = untracked files,   parents = [])          (optional)
 *   W = commit(tree = working tree,      parents = [HEAD, i, u?])
 *   refs/stash -> W, and the *stack* is refs/stash's reflog: stash@{0} is the
 *   newest entry, stash@{1} the one before it, and so on.
 *
 * DROPPING:
 *   Removing stash@{N} means rewriting the reflog and repointing refs/stash at
 *   the new newest entry — exactly what Git does. Dropping the last entry
 *   deletes the ref.
 * ============================================================================
 */

const fs = require('fs').promises;
const path = require('path');

const { serializeCommit, serializeTree, MODE, NULL_OID } = require('./git-objects');
const { GitIndex, IndexEntry } = require('./git-index');
const { AttributesMatcher } = require('./attributes');
const { IgnoreMatcher, walkWorktree } = require('./ignore');
const worktree = require('./worktree');
const ops = require('./gent-ops');
const { writeAtomic, readFileOrNull, withLock } = require('./lockfile');

const STASH_REF = 'refs/stash';

class StashError extends Error {
    constructor(message, code) {
        super(message);
        this.name = 'StashError';
        this.code = code || 'GENT_STASH';
    }
}

/**
 * Build a tree from an explicit path -> {mode, oid} map.
 * @param {Object} repo
 * @param {Map} entries
 * @returns {Promise<String>}
 */
async function buildTree(repo, entries) {
    const root = new Map();
    for (const [filePath, entry] of entries) {
        const parts = filePath.split('/');
        let node = root;
        for (let i = 0; i < parts.length - 1; i++) {
            if (!node.has(parts[i])) node.set(parts[i], new Map());
            node = node.get(parts[i]);
        }
        node.set(parts[parts.length - 1], entry);
    }

    async function store(node) {
        const list = [];
        for (const [name, child] of node) {
            list.push(child instanceof Map
                ? { mode: MODE.TREE, name, oid: await store(child) }
                : { mode: child.mode, name, oid: child.oid });
        }
        return repo.objects.write('tree', serializeTree(list));
    }
    return store(root);
}

/**
 * Shelve the current changes.
 *
 * @param {Object} repo
 * @param {Object} [options]
 * @param {String} [options.message]
 * @param {Boolean} [options.includeUntracked]
 * @param {Boolean} [options.keepIndex]
 * @returns {Promise<{oid: String, message: String}>}
 */
async function push(repo, options = {}) {
    await repo.assertNoExternalOperation('gent stash');
    repo.requireWorktree('gent stash');

    const head = await repo.refs.head();
    if (!head.oid) throw new StashError('cannot stash before the first commit');

    const index = await GitIndex.read(repo.indexPath);
    if (index.hasConflicts()) throw new StashError('cannot stash while a merge is unresolved');

    const state = await ops.status(repo, { index });
    const untracked = options.includeUntracked ? state.untracked : [];
    if (!state.staged.length && !state.unstaged.length && !untracked.length) {
        throw new StashError('there is nothing to stash', 'GENT_NOTHING_TO_STASH');
    }

    const identity = await repo.identity('committer');
    if (!identity) throw new StashError('stashing needs user.name and user.email', 'GENT_NO_IDENTITY');

    const headCommit = await repo.objects.readCommit(head.oid);
    const branchLabel = head.branch || `(no branch) ${head.oid.slice(0, 7)}`;
    const subject = headCommit.message.toString('utf-8').split('\n')[0];

    // i: the index exactly as it stands.
    const indexTree = await worktree.buildTreeFromIndex(repo, index);
    const indexCommit = await repo.objects.write('commit', serializeCommit({
        tree: indexTree,
        parents: [head.oid],
        author: identity,
        committer: identity,
        message: Buffer.from(`index on ${branchLabel}: ${head.oid.slice(0, 7)} ${subject}\n`, 'utf-8')
    }));

    // u: untracked files, parentless.
    let untrackedCommit = null;
    if (untracked.length) {
        const attributes = new AttributesMatcher(repo);
        const entries = new Map();
        for (const relativePath of untracked) {
            const staged = await worktree.stageWorktreeFile(repo, attributes, relativePath);
            entries.set(relativePath, { mode: staged.mode, oid: staged.oid });
        }
        const untrackedTree = await buildTree(repo, entries);
        untrackedCommit = await repo.objects.write('commit', serializeCommit({
            tree: untrackedTree,
            parents: [],
            author: identity,
            committer: identity,
            message: Buffer.from(`untracked files on ${branchLabel}: ${head.oid.slice(0, 7)} ${subject}\n`, 'utf-8')
        }));
    }

    // W: the working tree as it stands.
    const attributes = new AttributesMatcher(repo);
    const worktreeEntries = new Map();
    for (const entry of index.staged()) {
        const absolute = path.join(repo.worktree, ...entry.path.split('/'));
        const stat = await fs.lstat(absolute).catch(() => null);
        if (!stat) continue;                                   // deleted in the working tree
        const staged = await worktree.stageWorktreeFile(repo, attributes, entry.path);
        worktreeEntries.set(entry.path, { mode: staged.mode, oid: staged.oid });
    }
    const worktreeTree = await buildTree(repo, worktreeEntries);

    const parents = [head.oid, indexCommit];
    if (untrackedCommit) parents.push(untrackedCommit);

    const message = options.message
        ? `On ${branchLabel}: ${options.message}`
        : `WIP on ${branchLabel}: ${head.oid.slice(0, 7)} ${subject}`;

    const stashCommit = await repo.objects.write('commit', serializeCommit({
        tree: worktreeTree,
        parents,
        author: identity,
        committer: identity,
        message: Buffer.from(message + '\n', 'utf-8')
    }));

    const previous = await repo.refs.resolveToOid(STASH_REF);
    await repo.refs.update(STASH_REF, stashCommit, { expectedOldOid: previous, reason: message });

    // Restore the worktree and index to HEAD, then drop untracked files.
    await ops.reset(repo, 'hard', 'HEAD');
    for (const relativePath of untracked) {
        await fs.rm(path.join(repo.worktree, ...relativePath.split('/')), { force: true });
        await worktree.removeEmptyParents(repo, relativePath);
    }
    if (options.keepIndex) {
        const restored = await worktree.readTreeRecursive(repo, indexTree);
        const rebuilt = await GitIndex.read(repo.indexPath);
        const current = new Map(rebuilt.staged().map(e => [e.path, { mode: e.mode, oid: e.oid }]));
        const plan = await worktree.planCheckout(repo, { from: current, to: restored, index: rebuilt, force: true });
        await worktree.applyCheckout(repo, plan, { index: rebuilt });
        await rebuilt.write(repo.indexPath);
        await worktree.completeCheckout(repo);
    }

    return { oid: stashCommit, message };
}

/**
 * The stash stack, newest first, read from refs/stash's reflog.
 * @param {Object} repo
 * @returns {Promise<Array<{index: Number, oid: String, message: String}>>}
 */
async function list(repo) {
    const reflog = await repo.refs.readReflog(STASH_REF);
    return reflog
        .map((entry, position) => ({ position, oid: entry.newOid, message: entry.message }))
        .reverse()
        .map((entry, index) => ({ index, oid: entry.oid, message: entry.message, position: entry.position }));
}

/**
 * @param {Object} repo
 * @param {Number} index
 * @returns {Promise<{index, oid, message, position}>}
 */
async function at(repo, index = 0) {
    const stack = await list(repo);
    const found = stack[index];
    if (!found) throw new StashError(`stash@{${index}} does not exist (the stack holds ${stack.length})`);
    return found;
}

/**
 * Restore a stash into the working tree.
 *
 * @param {Object} repo
 * @param {Number} index
 * @param {Object} [options]
 * @param {Boolean} [options.restoreIndex] - also restore the staged state
 * @returns {Promise<{written: Number, deleted: Number, untracked: Number}>}
 */
async function apply(repo, index = 0, options = {}) {
    await repo.assertNoExternalOperation('gent stash apply');
    repo.requireWorktree('gent stash apply');

    const entry = await at(repo, index);
    const stash = await repo.objects.readCommit(entry.oid);
    if (stash.parents.length < 2) throw new StashError(`${entry.oid.slice(0, 12)} is not a stash commit`);

    await worktree.assertNoPendingCheckout(repo, 'gent stash apply');
    const currentIndex = await GitIndex.read(repo.indexPath);
    const state = await ops.status(repo, { index: currentIndex });
    if (state.staged.length || state.unstaged.length || state.conflicted.length) {
        throw new StashError('commit or stash local changes before applying a stash');
    }
    const current = new Map(currentIndex.staged().map(e => [e.path, { mode: e.mode, oid: e.oid }]));
    const base = await worktree.readTreeRecursive(repo, (await repo.objects.readCommit(stash.parents[0])).tree);
    const saved = await worktree.readTreeRecursive(repo, stash.tree);
    const target = await mergeStashTrees(repo, base, current, saved);
    let stagedTarget = current;
    if (options.restoreIndex) {
        const savedIndex = await worktree.readTreeRecursive(repo, (await repo.objects.readCommit(stash.parents[1])).tree);
        stagedTarget = await mergeStashTrees(repo, base, current, savedIndex);
    }

    let untrackedCount = 0;
    if (stash.parents.length >= 3) {
        const files = await worktree.readTreeRecursive(repo, (await repo.objects.readCommit(stash.parents[2])).tree);
        for (const [name, item] of files) {
            if (current.has(name) || await worktree.snapshotPath(repo, name)) {
                throw new StashError(`cannot restore untracked '${name}': path already exists`);
            }
            target.set(name, item);
            untrackedCount++;
        }
    }
    const plan = await worktree.planCheckout(repo, { from: current, to: target, index: currentIndex });
    // The working snapshot is not the staged snapshot. Default apply leaves
    // the index untouched; --index restores only the saved staged changes.
    if (options.restoreIndex) {
        currentIndex.entries = [];
        currentIndex.extensions.clear();
        for (const [name, item] of stagedTarget) currentIndex.add(new IndexEntry({ path: name, ...item }));
        currentIndex.serialize();
    }
    const applied = await worktree.applyCheckout(repo, plan);
    if (options.restoreIndex) await currentIndex.write(repo.indexPath);
    await worktree.completeCheckout(repo);

    return { ...applied, untracked: untrackedCount };
}

/**
 * Remove one entry from the stack, rewriting the reflog as Git does.
 * @param {Object} repo
 * @param {Number} index
 * @returns {Promise<String>} the dropped oid
 */
async function drop(repo, index = 0) {
    await repo.assertNoExternalOperation('gent stash drop');
    const entry = await at(repo, index);
    const reflogPath = repo.refs.reflogPath(STASH_REF);

    const raw = await readFileOrNull(reflogPath);
    const lines = raw ? raw.toString('utf-8').split('\n').filter(Boolean) : [];
    if (entry.position >= lines.length) throw new StashError(`stash@{${index}} is no longer in the reflog`);
    lines.splice(entry.position, 1);

    if (!lines.length) {
        await repo.refs.delete(STASH_REF, { expectedOldOid: undefined });
        await fs.rm(reflogPath, { force: true });
        return entry.oid;
    }

    await writeAtomic(reflogPath, lines.join('\n') + '\n');

    // refs/stash must name the newest surviving entry.
    const newest = lines[lines.length - 1].trim().split(/\s+/)[1];
    await withLock(repo.refs.refPath(STASH_REF), async (lock) => {
        await lock.write(`${newest}\n`);
    });
    repo.refs.invalidate();
    return entry.oid;
}

/**
 * Apply then drop.
 * @param {Object} repo
 * @param {Number} index
 * @param {Object} [options]
 * @returns {Promise<Object>}
 */
async function pop(repo, index = 0, options = {}) {
    const result = await apply(repo, index, options);
    await drop(repo, index);
    return result;
}

/** Merge stash changes relative to their original HEAD, preserving later commits.
 * Conflicting applications refuse before mutation; the stash remains available.
 */
async function mergeStashTrees(repo, base, current, saved) {
    const { mergeFileContent } = require('./merge-engine');
    const { looksBinary } = require('./attributes');
    const result = new Map();
    const same = (a, b) => (!a && !b) || (a && b && a.oid === b.oid && a.mode === b.mode);
    for (const name of new Set([...base.keys(), ...current.keys(), ...saved.keys()])) {
        const b = base.get(name), ours = current.get(name), theirs = saved.get(name);
        let item;
        if (same(b, theirs) || same(ours, theirs)) item = ours;
        else if (same(b, ours)) item = theirs;
        else {
            if (!ours || !theirs || ours.mode !== theirs.mode || ![MODE.REGULAR, MODE.EXECUTABLE].includes(ours.mode)) {
                throw new StashError(`stash conflicts at '${name}'; no changes applied`);
            }
            const bytes = await Promise.all([b ? repo.objects.readBlob(b.oid) : Buffer.alloc(0), repo.objects.readBlob(ours.oid), repo.objects.readBlob(theirs.oid)]);
            if (bytes.some(looksBinary)) throw new StashError(`binary stash conflict at '${name}'; no changes applied`);
            const merged = mergeFileContent(...bytes.map(value => value.toString('utf8')), name);
            if (merged.hasConflicts) throw new StashError(`stash conflicts at '${name}'; no changes applied`);
            item = { mode: ours.mode, oid: await repo.objects.write('blob', Buffer.from(merged.content)) };
        }
        if (item) result.set(name, item);
    }
    return result;
}

module.exports = {
    StashError,
    STASH_REF,
    push,
    list,
    at,
    apply,
    pop,
    drop
};
