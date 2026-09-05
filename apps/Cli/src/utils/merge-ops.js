/**
 * ============================================================================
 * Merge Ops - three-way merge on canonical trees
 * ============================================================================
 *
 * PURPOSE:
 *   Merge two commits using Gent's own diff3 content merge, but reading and
 *   writing standard Git structures: nested trees, index stages 1/2/3,
 *   MERGE_HEAD / MERGE_MSG, and a real two-parent commit.
 *
 * WHY THE CONTENT MERGE IS REUSED:
 *   merge-engine.js already implements diff3 with the union/region handling
 *   this project tested. Only its *inputs and outputs* were wrong — flat JSON
 *   trees instead of Git objects. This module supplies canonical trees and
 *   records the result where Git expects it.
 *
 * STATE:
 *   A conflicted merge leaves MERGE_HEAD, MERGE_MSG, conflict stages in the
 *   index and marker files in the working tree — exactly what `git status`
 *   and `git merge --abort` understand. State is cleared only on a successful
 *   commit or an explicit abort.
 * ============================================================================
 */

const fs = require('fs').promises;
const path = require('path');

const { MODE } = require('./git-objects');
const { GitIndex, IndexEntry } = require('./git-index');
const { AttributesMatcher, looksBinary } = require('./attributes');
const { mergeFileContent } = require('./merge-engine');
const worktree = require('./worktree');
const ops = require('./gent-ops');
const { writeAtomic } = require('./lockfile');

class MergeError extends Error {
    constructor(message, code) {
        super(message);
        this.name = 'MergeError';
        this.code = code || 'GENT_MERGE';
    }
}

/**
 * Decide one path's fate given its three sides.
 * @param {Object|null} base
 * @param {Object|null} ours
 * @param {Object|null} theirs
 * @returns {{kind: String, entry?: Object}}
 */
function classify(base, ours, theirs) {
    const same = (a, b) => (a === null && b === null) || (a && b && a.oid === b.oid && a.mode === b.mode);

    if (same(ours, theirs)) return { kind: 'agree', entry: ours };
    if (same(base, ours)) return { kind: 'take-theirs', entry: theirs };
    if (same(base, theirs)) return { kind: 'take-ours', entry: ours };

    if (!ours && !theirs) return { kind: 'agree', entry: null };
    if (!ours || !theirs) return { kind: 'modify-delete' };
    if (ours.mode !== theirs.mode) return { kind: 'mode-conflict' };
    return { kind: 'content' };
}

/**
 * Merge `theirRevision` into HEAD.
 *
 * @param {Object} repo
 * @param {String} theirRevision
 * @param {Object} [options]
 * @param {String} [options.message]
 * @param {Boolean} [options.noFastForward]
 * @returns {Promise<Object>} a result describing what happened
 */
async function merge(repo, theirRevision, options = {}) {
    await repo.assertNoExternalOperation('gent merge');
    await worktree.assertNoPendingCheckout(repo, 'gent merge');
    repo.requireWorktree('gent merge');

    const head = await repo.refs.head();
    if (!head.oid) throw new MergeError('cannot merge before the first commit');

    const theirs = await ops.peelToCommit(repo, theirRevision);
    const ours = head.oid;

    if (ours === theirs) return { status: 'up-to-date', oid: ours };

    const baseOid = await ops.findMergeBase(repo, ours, theirs);
    if (!baseOid) throw new MergeError(`'${theirRevision}' and the current branch share no history`, 'GENT_UNRELATED');

    if (baseOid === theirs) return { status: 'up-to-date', oid: ours };

    const index = await GitIndex.read(repo.indexPath);
    const dirty = await ops.status(repo, { index });
    if (dirty.unstaged.length || dirty.staged.length) {
        throw new MergeError(
            `you have local changes; commit or stash them before merging.\n` +
            [...dirty.staged, ...dirty.unstaged].map(c => `  ${c.status}: ${c.path}`).join('\n'),
            'GENT_MERGE_DIRTY'
        );
    }

    const label = theirRevision;

    if (baseOid === ours && !options.noFastForward) {
        const target = await worktree.readTreeRecursive(repo, (await repo.objects.readCommit(theirs)).tree);
        const current = new Map(index.staged().map(e => [e.path, { mode: e.mode, oid: e.oid }]));
        const plan = await worktree.planCheckout(repo, { from: current, to: target, index });
        await worktree.applyCheckout(repo, plan, { index });
        await index.write(repo.indexPath);

        if (head.ref) {
            await repo.refs.update(head.ref, theirs, { expectedOldOid: ours, reason: `merge ${label}: Fast-forward` });
        } else {
            await repo.refs.setHeadDetached(theirs, `merge ${label}: Fast-forward`);
        }
        await worktree.completeCheckout(repo);
        return { status: 'fast-forward', oid: theirs, base: baseOid };
    }

    const baseTree = await worktree.readTreeRecursive(repo, (await repo.objects.readCommit(baseOid)).tree);
    const oursTree = await worktree.readTreeRecursive(repo, (await repo.objects.readCommit(ours)).tree);
    const theirsTree = await worktree.readTreeRecursive(repo, (await repo.objects.readCommit(theirs)).tree);

    const allPaths = [...new Set([...baseTree.keys(), ...oursTree.keys(), ...theirsTree.keys()])].sort();
    const attributes = new AttributesMatcher(repo);

    const merged = new Map();                     // path -> {mode, oid}
    const conflicts = [];                         // {path, kind, base, ours, theirs, content?}

    for (const filePath of allPaths) {
        const base = baseTree.get(filePath) || null;
        const oursEntry = oursTree.get(filePath) || null;
        const theirsEntry = theirsTree.get(filePath) || null;
        const decision = classify(base, oursEntry, theirsEntry);

        if (decision.kind === 'agree' || decision.kind === 'take-ours' || decision.kind === 'take-theirs') {
            if (decision.entry) merged.set(filePath, decision.entry);
            continue;
        }

        if (decision.kind === 'modify-delete' || decision.kind === 'mode-conflict') {
            conflicts.push({ path: filePath, kind: decision.kind, base, ours: oursEntry, theirs: theirsEntry });
            if (oursEntry) merged.set(filePath, oursEntry);       // keep our side in the worktree
            continue;
        }

        const baseBytes = base ? await repo.objects.readBlob(base.oid) : Buffer.alloc(0);
        const oursBytes = await repo.objects.readBlob(oursEntry.oid);
        const theirsBytes = await repo.objects.readBlob(theirsEntry.oid);

        if (looksBinary(oursBytes) || looksBinary(theirsBytes) || looksBinary(baseBytes)) {
            conflicts.push({ path: filePath, kind: 'binary', base, ours: oursEntry, theirs: theirsEntry });
            merged.set(filePath, oursEntry);
            continue;
        }

        const result = mergeFileContent(
            baseBytes.toString('utf-8'),
            oursBytes.toString('utf-8'),
            theirsBytes.toString('utf-8'),
            filePath
        );
        const content = Buffer.from(result.content, 'utf-8');
        const oid = await repo.objects.write('blob', content);

        if (result.hasConflicts) {
            conflicts.push({ path: filePath, kind: 'content', base, ours: oursEntry, theirs: theirsEntry, markedOid: oid });
        }
        merged.set(filePath, { mode: oursEntry.mode, oid });
    }

    // Update the working tree to the merge result, then record the index.
    const current = new Map(index.staged().map(e => [e.path, { mode: e.mode, oid: e.oid }]));
    const plan = await worktree.planCheckout(repo, { from: current, to: merged, index });
    await worktree.applyCheckout(repo, plan, { index });

    for (const conflict of conflicts) {
        index.remove(conflict.path);
        for (const [stage, side] of [[1, conflict.base], [2, conflict.ours], [3, conflict.theirs]]) {
            if (!side) continue;
            index.addStage(new IndexEntry({ path: conflict.path, oid: side.oid, mode: side.mode, stage }));
        }
    }
    await index.write(repo.indexPath);

    const message = options.message || `Merge ${label} into ${head.branch || 'HEAD'}`;

    if (conflicts.length) {
        await ops.writeMergeState(repo, [theirs], `${message}\n\nConflicts:\n${conflicts.map(c => '  ' + c.path).join('\n')}\n`);
        await worktree.completeCheckout(repo);
        return { status: 'conflicts', conflicts, base: baseOid, theirs, ours };
    }

    const commit = await ops.createCommit(repo, { message, extraParents: [theirs], allowEmpty: true });
    await worktree.completeCheckout(repo);
    return { status: 'merged', oid: commit.oid, base: baseOid, theirs, ours };
}

/**
 * Finish a conflicted merge once every path is resolved in the index.
 * @param {Object} repo
 * @param {String} [message]
 * @returns {Promise<{oid: String}>}
 */
async function concludeMerge(repo, message) {
    const state = await ops.readMergeState(repo);
    if (!state) throw new MergeError('there is no merge in progress');

    const index = await GitIndex.read(repo.indexPath);
    if (index.hasConflicts()) {
        throw new MergeError(
            `these paths are still conflicted:\n${[...index.conflicts().keys()].map(p => '  ' + p).join('\n')}`,
            'GENT_UNMERGED'
        );
    }

    const commit = await ops.createCommit(repo, {
        message: message || state.message || 'Merge',
        extraParents: state.heads,
        allowEmpty: true
    });
    return commit;
}

/**
 * Throw away an in-progress merge and return to HEAD.
 * @param {Object} repo
 * @returns {Promise<void>}
 */
async function abortMerge(repo) {
    const state = await ops.readMergeState(repo);
    if (!state) throw new MergeError('there is no merge in progress');

    await ops.reset(repo, 'hard', 'HEAD');
    await ops.clearMergeState(repo);
}

/**
 * Stage a resolved path from the working tree, clearing its conflict stages.
 * @param {Object} repo
 * @param {String} relativePath
 * @returns {Promise<void>}
 */
async function markResolved(repo, relativePath) {
    const index = await GitIndex.read(repo.indexPath);
    if (!index.getAll(relativePath).length) {
        throw new MergeError(`'${relativePath}' is not part of this merge`);
    }
    const attributes = new AttributesMatcher(repo);
    const entry = await worktree.stageWorktreeFile(repo, attributes, relativePath);
    index.resolve(entry);
    await index.write(repo.indexPath);
}

/**
 * The three sides of a conflicted path, for an interactive resolver.
 * @param {Object} repo
 * @param {String} relativePath
 * @returns {Promise<{base: Buffer|null, ours: Buffer|null, theirs: Buffer|null}>}
 */
async function conflictSides(repo, relativePath) {
    const index = await GitIndex.read(repo.indexPath);
    const stages = index.conflicts().get(relativePath);
    if (!stages) throw new MergeError(`'${relativePath}' is not conflicted`);

    const read = async (entry) => (entry ? repo.objects.readBlob(entry.oid) : null);
    return {
        base: await read(stages.base),
        ours: await read(stages.ours),
        theirs: await read(stages.theirs)
    };
}

module.exports = {
    MergeError,
    merge,
    concludeMerge,
    abortMerge,
    markResolved,
    conflictSides,
    classify
};
