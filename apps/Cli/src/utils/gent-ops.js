/**
 * ============================================================================
 * Gent Ops - repository operations on the canonical engine
 * ============================================================================
 *
 * PURPOSE:
 *   One implementation of add, commit, checkout, branch, tag, reset and
 *   history walking, shared by every command. Commands own presentation; this
 *   module owns behaviour.
 *
 * INVARIANTS:
 *   - Commit ids are derived from content. Nothing here generates one.
 *   - Every ref move is a compare-and-set against the value the operation
 *     read, so an external Git writing concurrently is detected, not lost.
 *   - Every worktree change goes through worktree.js, which preflights first.
 *   - assertNoExternalOperation() runs before anything that writes.
 * ============================================================================
 */

const fs = require('fs').promises;
const path = require('path');

const repository = require('./repository');
const { MODE, serializeCommit, serializeTag, isObjectId } = require('./git-objects');
const { GitIndex, IndexEntry } = require('./git-index');
const { AttributesMatcher } = require('./attributes');
const { IgnoreMatcher, walkWorktree } = require('./ignore');
const worktree = require('./worktree');
const { assertRefName } = require('./refs');
const { writeAtomic, readFileOrNull } = require('./lockfile');

class OperationError extends Error {
    constructor(message, code) {
        super(message);
        this.name = 'OperationError';
        this.code = code || 'GENT_OPERATION';
    }
}

/**
 * Open the repository containing the current directory.
 * @param {String} [startDir]
 * @returns {Promise<repository.Repository>}
 */
async function openRepository(startDir) {
    return repository.open(startDir || process.cwd());
}

// ─── Revision resolution ─────────────────────────────────

/**
 * Resolve a revision expression to an object id.
 * Supports: a full oid, an unambiguous oid prefix, any ref shorthand, HEAD,
 * and the `~N` / `^N` suffixes.
 *
 * @param {Object} repo
 * @param {String} revision
 * @returns {Promise<String>} oid
 */
async function resolveRevision(repo, revision) {
    if (!revision) throw new OperationError('no revision given');

    let expression = revision;
    const suffixes = [];
    const suffixPattern = /(\^\d*|~\d*)$/;
    let match;
    while ((match = suffixPattern.exec(expression))) {
        suffixes.unshift(match[1]);
        expression = expression.slice(0, -match[1].length);
    }
    if (!expression) expression = 'HEAD';

    let oid = await resolveBase(repo, expression);

    for (const suffix of suffixes) {
        const count = suffix.length > 1 ? Number.parseInt(suffix.slice(1), 10) : 1;
        if (suffix.startsWith('~')) {
            for (let i = 0; i < count; i++) {
                const commit = await repo.objects.readCommit(await peelToCommit(repo, oid));
                if (!commit.parents.length) throw new OperationError(`'${revision}': ${oid.slice(0, 12)} has no parent`);
                oid = commit.parents[0];
            }
        } else {
            const commit = await repo.objects.readCommit(await peelToCommit(repo, oid));
            const parent = commit.parents[count - 1];
            if (!parent) throw new OperationError(`'${revision}': ${oid.slice(0, 12)} has no parent number ${count}`);
            oid = parent;
        }
    }
    return oid;
}

/**
 * @param {Object} repo
 * @param {String} expression
 * @returns {Promise<String>}
 */
async function resolveBase(repo, expression) {
    const viaRef = await repo.refs.expand(expression);
    if (viaRef) return viaRef.oid;

    if (isObjectId(expression)) {
        if (await repo.objects.has(expression)) return expression;
        throw new OperationError(`object ${expression} is not in this repository`, 'GENT_UNKNOWN_REVISION');
    }

    if (/^[0-9a-f]{4,63}$/.test(expression)) {
        const matches = [];
        for (const oid of await repo.objects.listAll()) {
            if (oid.startsWith(expression)) matches.push(oid);
            if (matches.length > 1) break;
        }
        if (matches.length === 1) return matches[0];
        if (matches.length > 1) throw new OperationError(`'${expression}' is ambiguous — it matches more than one object`, 'GENT_AMBIGUOUS');
    }

    throw new OperationError(`'${expression}' is not a known revision`, 'GENT_UNKNOWN_REVISION');
}

/**
 * The commit a revision ultimately names. Accepts an object id or any
 * revision expression, so callers never have to resolve first.
 * @param {Object} repo
 * @param {String} revision
 * @returns {Promise<String>}
 */
async function peelToCommit(repo, revision) {
    const oid = isObjectId(revision) ? revision : await resolveRevision(repo, revision);
    const peeled = await repo.objects.peel(oid);
    if (peeled.type !== 'commit') {
        throw new OperationError(`${oid.slice(0, 12)} is a ${peeled.type}, not a commit`);
    }
    return peeled.oid;
}

// ─── History ─────────────────────────────────────────────

/**
 * Walk the commit DAG from one or more starting points.
 * Ordering is by committer time descending, with parents always emitted after
 * their children, so merges read correctly.
 *
 * @param {Object} repo
 * @param {Object} [options]
 * @param {Array<String>} [options.from] - defaults to HEAD
 * @param {Number} [options.max]
 * @param {Boolean} [options.firstParentOnly]
 * @returns {Promise<Array<Object>>} parsed commits, newest first
 */
async function walkHistory(repo, options = {}) {
    let starts = options.from;
    if (!starts || !starts.length) {
        const head = await repo.refs.head();
        starts = head.oid ? [head.oid] : [];
    }

    const seen = new Set();
    const queue = [];
    const results = [];

    for (const start of starts) {
        const oid = await peelToCommit(repo, start);
        if (seen.has(oid)) continue;
        seen.add(oid);
        queue.push(await repo.objects.readCommit(oid));
    }

    while (queue.length) {
        queue.sort((a, b) => (b.committer?.timestamp || 0) - (a.committer?.timestamp || 0));
        const commit = queue.shift();
        results.push(commit);
        if (options.max && results.length >= options.max) break;

        const parents = options.firstParentOnly ? commit.parents.slice(0, 1) : commit.parents;
        for (const parent of parents) {
            if (seen.has(parent)) continue;
            seen.add(parent);
            queue.push(await repo.objects.readCommit(parent));
        }
    }
    return results;
}

/**
 * Best common ancestor of two commits.
 * @param {Object} repo
 * @param {String} a
 * @param {String} b
 * @returns {Promise<String|null>}
 */
async function findMergeBase(repo, a, b) {
    const ancestorsOfA = new Set();
    const stack = [await peelToCommit(repo, a)];
    while (stack.length) {
        const oid = stack.pop();
        if (ancestorsOfA.has(oid)) continue;
        ancestorsOfA.add(oid);
        stack.push(...(await repo.objects.readCommit(oid)).parents);
    }

    // Breadth-first from b so the *closest* common ancestor wins.
    const visited = new Set();
    const queue = [await peelToCommit(repo, b)];
    while (queue.length) {
        const oid = queue.shift();
        if (visited.has(oid)) continue;
        visited.add(oid);
        if (ancestorsOfA.has(oid)) return oid;
        queue.push(...(await repo.objects.readCommit(oid)).parents);
    }
    return null;
}

/**
 * @param {Object} repo
 * @param {String} ancestor
 * @param {String} descendant
 * @returns {Promise<Boolean>}
 */
async function isAncestor(repo, ancestor, descendant) {
    const target = await peelToCommit(repo, ancestor);
    const visited = new Set();
    const stack = [await peelToCommit(repo, descendant)];
    while (stack.length) {
        const oid = stack.pop();
        if (oid === target) return true;
        if (visited.has(oid)) continue;
        visited.add(oid);
        stack.push(...(await repo.objects.readCommit(oid)).parents);
    }
    return false;
}

// ─── Staging ─────────────────────────────────────────────

/**
 * Expand user-supplied path arguments into repository-relative file paths.
 * @param {Object} repo
 * @param {Array<String>} paths
 * @param {Object} [options]
 * @param {Boolean} [options.all]
 * @returns {Promise<Array<String>>}
 */
async function expandPaths(repo, paths, options = {}) {
    const root = repo.requireWorktree('staging');
    const matcher = new IgnoreMatcher(repo);
    const index = options.index || await GitIndex.read(repo.indexPath);
    const tracked = new Set(index.staged().map(e => e.path));

    const wantsEverything = options.all || !paths || !paths.length;

    if (wantsEverything) {
        const found = [];
        for await (const entry of walkWorktree(repo, matcher, { tracked })) {
            if (!entry.submodule) found.push(entry.path);
        }
        return [...new Set([...found, ...tracked])].sort();
    }

    const result = new Set();
    for (const given of paths) {
        const absolute = path.resolve(process.cwd(), given);
        const relative = repo.relativePath(absolute);
        const stat = await fs.lstat(absolute).catch(() => null);

        if (stat && stat.isDirectory()) {
            for await (const entry of walkWorktree(repo, matcher, { tracked })) {
                if (!relative || entry.path === relative || entry.path.startsWith(relative + '/')) {
                    if (!entry.submodule) result.add(entry.path);
                }
            }
            for (const trackedPath of tracked) {
                if (!relative || trackedPath === relative || trackedPath.startsWith(relative + '/')) result.add(trackedPath);
            }
            continue;
        }

        result.add(relative);
    }
    return [...result].sort();
}

/**
 * Stage the given paths, recording deletions for tracked files that are gone.
 *
 * @param {Object} repo
 * @param {Array<String>} paths
 * @param {Object} [options]
 * @returns {Promise<{staged: Array, removed: Array, unchanged: Number, index: GitIndex}>}
 */
async function addPaths(repo, paths, options = {}) {
    await repo.assertNoExternalOperation('gent add');
    repo.requireWorktree('gent add');

    const index = await GitIndex.read(repo.indexPath);
    const attributes = new AttributesMatcher(repo);
    const candidates = await expandPaths(repo, paths, { ...options, index });

    const staged = [];
    const removed = [];
    let unchanged = 0;

    for (const relativePath of candidates) {
        worktree.assertSafeCheckoutPath(repo, relativePath);
        const absolute = path.join(repo.worktree, ...relativePath.split('/'));
        const stat = await fs.lstat(absolute).catch(() => null);

        if (!stat) {
            if (index.getAll(relativePath).length) {
                index.remove(relativePath);
                removed.push(relativePath);
            }
            continue;
        }
        if (stat.isDirectory()) continue;                  // submodule; skipped by expandPaths

        const before = index.get(relativePath);
        const entry = await worktree.stageWorktreeFile(repo, attributes, relativePath);

        if (before && before.oid === entry.oid && before.mode === entry.mode && before.stage === 0) {
            index.add(entry);                              // refresh stat data only
            unchanged++;
            continue;
        }
        index.add(entry);
        staged.push({ path: relativePath, oid: entry.oid, mode: entry.mode, previous: before ? before.oid : null });
    }

    await index.write(repo.indexPath);
    return { staged, removed, unchanged, index };
}

/**
 * Unstage or untrack paths.
 * @param {Object} repo
 * @param {Array<String>} paths
 * @param {Object} [options]
 * @param {Boolean} [options.cached] - keep the file on disk
 * @returns {Promise<Array<String>>}
 */
async function removePaths(repo, paths, options = {}) {
    await repo.assertNoExternalOperation('gent rm');
    const index = await GitIndex.read(repo.indexPath);
    const removed = new Set();
    const head = await repo.refs.head();
    const headTree = head.oid ? await worktree.readTreeRecursive(repo, (await repo.objects.readCommit(head.oid)).tree) : new Map();
    const attributes = new AttributesMatcher(repo);
    const from = new Map();
    for (const given of paths) {
        const relative = repo.relativePath(path.resolve(process.cwd(), given));
        for (const entry of index.entries.filter(e => e.path === relative || e.path.startsWith(relative + '/'))) {
            worktree.assertSafeCheckoutPath(repo, entry.path);
            await worktree.assertNoSymlinkParent(repo, entry.path);
            if (!options.cached) {
                const original = headTree.get(entry.path);
                const stat = await fs.lstat(path.join(repo.worktree, entry.path)).catch(error => {
                    if (error.code === 'ENOENT') return null;
                    throw error;
                });
                if (entry.stage || !original || original.oid !== entry.oid || original.mode !== entry.mode ||
                    (stat && (await worktree.hashWorktreeFile(repo, attributes, entry.path, stat)) !== entry.oid)) {
                    throw new OperationError(`'${entry.path}' has local changes; refusing removal`);
                }
            }
            from.set(entry.path, entry);
            removed.add(entry.path);
        }
    }
    if (options.cached) {
        for (const name of removed) index.remove(name);
    } else {
        const plan = await worktree.planCheckout(repo, { from, to: new Map(), index });
        await worktree.applyCheckout(repo, plan, { index });
    }
    await index.write(repo.indexPath);
    if (!options.cached) await worktree.completeCheckout(repo);
    return [...removed];
}

// ─── Commit ──────────────────────────────────────────────

/**
 * Record a commit from the current index.
 *
 * @param {Object} repo
 * @param {Object} options
 * @param {String} options.message
 * @param {Boolean} [options.amend]
 * @param {Boolean} [options.allowEmpty]
 * @param {Array<String>} [options.extraParents] - merge parents
 * @returns {Promise<{oid: String, tree: String, branch: String|null, parents: Array<String>}>}
 */
async function createCommit(repo, options) {
    await repo.assertNoExternalOperation('gent commit');

    const message = String(options.message || '').replace(/\s+$/, '') + '\n';
    if (message.trim() === '') throw new OperationError('a commit needs a message');

    const author = await repo.identity('author');
    const committer = await repo.identity('committer');
    if (!author || !committer) {
        throw new OperationError(
            'author identity unknown.\nSet it with:\n  gent config user.name "Your Name"\n  gent config user.email you@example.com',
            'GENT_NO_IDENTITY'
        );
    }

    const index = await GitIndex.read(repo.indexPath);
    if (index.hasConflicts()) {
        throw new OperationError(
            `cannot commit with unresolved conflicts:\n${[...index.conflicts().keys()].map(p => '  ' + p).join('\n')}`,
            'GENT_UNMERGED'
        );
    }

    const head = await repo.refs.head();
    let parents = [];

    if (options.amend) {
        if (!head.oid) throw new OperationError('there is no commit to amend');
        parents = (await repo.objects.readCommit(head.oid)).parents;
    } else if (head.oid) {
        parents = [head.oid];
    }
    const mergeState = await readMergeState(repo);
    if (options.amend && mergeState) throw new OperationError('cannot amend during a merge');
    parents = [...new Set([...parents, ...(options.extraParents || mergeState?.heads || [])])];

    const tree = await worktree.buildTreeFromIndex(repo, index);

    if (!options.allowEmpty && !options.amend && parents.length === 1) {
        const parentTree = (await repo.objects.readCommit(parents[0])).tree;
        if (parentTree === tree) {
            throw new OperationError('nothing to commit — the index matches HEAD', 'GENT_EMPTY_COMMIT');
        }
    }

    // Amending keeps the original author, as Git does.
    let effectiveAuthor = author;
    if (options.amend) {
        const previous = await repo.objects.readCommit(head.oid);
        if (previous.author) effectiveAuthor = previous.author;
    }

    const oid = await repo.objects.write('commit', serializeCommit({
        tree,
        parents,
        author: effectiveAuthor,
        committer,
        message: Buffer.from(message, 'utf-8')
    }));

    const summary = message.split('\n')[0];
    const reason = parents.length === 0
        ? `commit (initial): ${summary}`
        : options.amend ? `commit (amend): ${summary}`
            : parents.length > 1 ? `commit (merge): ${summary}`
                : `commit: ${summary}`;

    if (head.detached) {
        await repo.refs.setHeadDetached(oid, reason, head);
    } else if (head.ref) {
        await repo.refs.update(head.ref, oid, { expectedOldOid: head.oid, reason });
    } else {
        throw new OperationError('HEAD is not usable — it names neither a branch nor a commit');
    }

    await clearMergeState(repo);
    return { oid, tree, branch: head.branch, parents };
}

// ─── Merge state ─────────────────────────────────────────

/**
 * @param {Object} repo
 * @returns {Promise<{heads: Array<String>, message: String}|null>}
 */
async function readMergeState(repo) {
    const raw = await readFileOrNull(repo.gitPath('MERGE_HEAD'));
    if (!raw) return null;
    const heads = raw.toString('utf-8').split('\n').map(l => l.trim()).filter(Boolean);
    const message = (await readFileOrNull(repo.gitPath('MERGE_MSG')))?.toString('utf-8') || '';
    return { heads, message };
}

/**
 * @param {Object} repo
 * @param {Array<String>} heads
 * @param {String} message
 */
async function writeMergeState(repo, heads, message) {
    await writeAtomic(repo.gitPath('MERGE_HEAD'), heads.join('\n') + '\n');
    await writeAtomic(repo.gitPath('MERGE_MSG'), message.endsWith('\n') ? message : message + '\n');
    const head = await repo.refs.head();
    if (head.oid) await writeAtomic(repo.gitPath('ORIG_HEAD'), head.oid + '\n');
}

/**
 * @param {Object} repo
 */
async function clearMergeState(repo) {
    for (const name of ['MERGE_HEAD', 'MERGE_MSG', 'MERGE_MODE', 'AUTO_MERGE']) {
        await fs.rm(repo.gitPath(name), { force: true });
    }
}

// ─── Branches ────────────────────────────────────────────

/**
 * @param {Object} repo
 * @returns {Promise<Array<{name: String, oid: String, current: Boolean}>>}
 */
async function listBranches(repo) {
    const head = await repo.refs.head();
    const refs = await repo.refs.list('refs/heads/');
    return [...refs.entries()]
        .map(([name, oid]) => ({ name: name.slice('refs/heads/'.length), oid, current: name === head.ref }))
        .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * @param {Object} repo
 * @param {String} name
 * @param {String} [startPoint]
 * @returns {Promise<{name: String, oid: String}>}
 */
async function createBranch(repo, name, startPoint) {
    await repo.assertNoExternalOperation('gent branch');
    const ref = `refs/heads/${name}`;
    assertRefName(ref);

    const start = startPoint ? await peelToCommit(repo, await resolveRevision(repo, startPoint)) : (await repo.refs.head()).oid;
    if (!start) throw new OperationError('cannot create a branch before the first commit');

    await repo.refs.update(ref, start, {
        expectedOldOid: null,
        reason: `branch: Created from ${startPoint || 'HEAD'}`
    });
    return { name, oid: start };
}

/**
 * @param {Object} repo
 * @param {String} name
 * @param {Object} [options]
 * @param {Boolean} [options.force] - delete even if unmerged into HEAD
 * @returns {Promise<String>} the deleted oid
 */
async function deleteBranch(repo, name, options = {}) {
    await repo.assertNoExternalOperation('gent branch -d');
    const ref = `refs/heads/${name}`;
    const head = await repo.refs.head();

    if (head.ref === ref) throw new OperationError(`cannot delete '${name}': it is the current branch`);

    const oid = await repo.refs.resolveToOid(ref);
    if (!oid) throw new OperationError(`branch '${name}' does not exist`);

    if (!options.force && head.oid && !(await isAncestor(repo, oid, head.oid))) {
        throw new OperationError(
            `branch '${name}' is not fully merged into ${head.branch || 'HEAD'}; its commits would become unreachable.\n` +
            `Use --force to delete it anyway.`,
            'GENT_UNMERGED_BRANCH'
        );
    }

    await repo.refs.delete(ref, { expectedOldOid: oid, reason: `branch: deleted ${name}` });
    return oid;
}

// ─── Tags ────────────────────────────────────────────────

/**
 * @param {Object} repo
 * @returns {Promise<Array<{name, oid, annotated, target, message}>>}
 */
async function listTags(repo) {
    const refs = await repo.refs.list('refs/tags/');
    const tags = [];
    for (const [ref, oid] of refs) {
        const object = await repo.objects.read(oid);
        if (object.type === 'tag') {
            const tag = await repo.objects.readTag(oid);
            tags.push({
                name: ref.slice('refs/tags/'.length),
                oid,
                annotated: true,
                target: tag.object,
                tagger: tag.tagger,
                message: tag.message.toString('utf-8')
            });
        } else {
            tags.push({ name: ref.slice('refs/tags/'.length), oid, annotated: false, target: oid, message: '' });
        }
    }
    return tags.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * @param {Object} repo
 * @param {String} name
 * @param {Object} [options]
 * @param {String} [options.message] - creates an annotated tag when present
 * @param {String} [options.target]
 * @returns {Promise<{name: String, oid: String, annotated: Boolean}>}
 */
async function createTag(repo, name, options = {}) {
    await repo.assertNoExternalOperation('gent tag');
    const ref = `refs/tags/${name}`;
    assertRefName(ref);

    const targetOid = options.target
        ? await resolveRevision(repo, options.target)
        : (await repo.refs.head()).oid;
    if (!targetOid) throw new OperationError('cannot tag before the first commit');

    if (!options.message) {
        await repo.refs.update(ref, targetOid, { expectedOldOid: null, reason: `tag: ${name}` });
        return { name, oid: targetOid, annotated: false };
    }

    const tagger = await repo.identity('committer');
    if (!tagger) throw new OperationError('an annotated tag needs user.name and user.email', 'GENT_NO_IDENTITY');

    const targetType = (await repo.objects.read(targetOid)).type;
    const oid = await repo.objects.write('tag', serializeTag({
        object: targetOid,
        targetType,
        tag: name,
        tagger,
        message: Buffer.from(String(options.message).replace(/\s+$/, '') + '\n', 'utf-8')
    }));

    await repo.refs.update(ref, oid, { expectedOldOid: null, reason: `tag: ${name}` });
    return { name, oid, annotated: true };
}

/**
 * @param {Object} repo
 * @param {String} name
 * @returns {Promise<String>}
 */
async function deleteTag(repo, name) {
    await repo.assertNoExternalOperation('gent tag -d');
    const oid = await repo.refs.resolveToOid(`refs/tags/${name}`);
    if (!oid) throw new OperationError(`tag '${name}' does not exist`);
    await repo.refs.delete(`refs/tags/${name}`, { expectedOldOid: oid, reason: `tag: deleted ${name}` });
    return oid;
}

// ─── Checkout ────────────────────────────────────────────

/**
 * Move HEAD, the index and the working tree together.
 *
 * @param {Object} repo
 * @param {String} target - branch name, tag or revision
 * @param {Object} [options]
 * @param {Boolean} [options.create] - create the branch first
 * @param {Boolean} [options.force] - discard local changes
 * @param {Boolean} [options.detach]
 * @returns {Promise<{branch: String|null, oid: String, written: Number, deleted: Number}>}
 */
async function checkout(repo, target, options = {}) {
    await repo.assertNoExternalOperation('gent checkout');
    await worktree.assertNoPendingCheckout(repo, 'gent checkout');
    repo.requireWorktree('gent checkout');

    const previousHead = await repo.refs.head();
    if (options.create) await createBranch(repo, target);

    const branchRef = `refs/heads/${target}`;
    const branchOid = await repo.refs.resolveToOid(branchRef).catch(() => null);
    const detach = options.detach || !branchOid;

    const commitOid = await peelToCommit(repo, branchOid || await resolveRevision(repo, target));
    const targetTree = await worktree.readTreeRecursive(repo, (await repo.objects.readCommit(commitOid)).tree);

    const index = await GitIndex.read(repo.indexPath);
    if (!options.force) {
        const state = await worktree.status(repo, { index });
        if (state.staged.length || state.conflicted.length) {
            throw new OperationError('commit or stash staged changes before switching branches', 'GENT_CHECKOUT_BLOCKED');
        }
    }
    const current = new Map(index.staged().map(e => [e.path, { mode: e.mode, oid: e.oid }]));

    const plan = await worktree.planCheckout(repo, { from: current, to: targetTree, index, force: options.force });
    const applied = await worktree.applyCheckout(repo, plan, { index });
    await index.write(repo.indexPath);

    if (detach) {
        await repo.refs.setHeadDetached(commitOid, `checkout: moving to ${target}`, previousHead);
    } else {
        await repo.refs.setHeadSymbolic(branchRef, `checkout: moving to ${target}`, previousHead);
    }

    await clearMergeState(repo);
    await worktree.completeCheckout(repo);
    return { branch: detach ? null : target, oid: commitOid, ...applied };
}

/**
 * Replace the working-tree copy of specific paths with their index content.
 * @param {Object} repo
 * @param {Array<String>} paths
 * @returns {Promise<Number>} files restored
 */
async function checkoutPaths(repo, paths) {
    await repo.assertNoExternalOperation('gent checkout -- <paths>');
    const index = await GitIndex.read(repo.indexPath);
    const wanted = await expandPaths(repo, paths, { index });

    const to = new Map();
    for (const relativePath of wanted) {
        const entry = index.get(relativePath);
        if (entry) to.set(relativePath, { mode: entry.mode, oid: entry.oid });
    }

    const plan = await worktree.planCheckout(repo, { from: new Map(), to, index, force: true });
    const applied = await worktree.applyCheckout(repo, plan);
    await worktree.completeCheckout(repo);
    return applied.written;
}

// ─── Reset ───────────────────────────────────────────────

/**
 * @param {Object} repo
 * @param {String} mode - 'soft' | 'mixed' | 'hard'
 * @param {String} [target] - defaults to HEAD
 * @returns {Promise<{oid: String, mode: String, written: Number, deleted: Number}>}
 */
async function reset(repo, mode, target) {
    await repo.assertNoExternalOperation('gent reset');
    await worktree.assertNoPendingCheckout(repo, 'gent reset');
    if (!['soft', 'mixed', 'hard'].includes(mode)) throw new OperationError(`unknown reset mode '${mode}'`);

    const head = await repo.refs.head();
    const commitOid = await peelToCommit(repo, target ? await resolveRevision(repo, target) : head.oid);
    const targetTree = await worktree.readTreeRecursive(repo, (await repo.objects.readCommit(commitOid)).tree);

    if (head.oid) await writeAtomic(repo.gitPath('ORIG_HEAD'), head.oid + '\n');

    let applied = { written: 0, deleted: 0 };
    const index = await GitIndex.read(repo.indexPath);

    if (mode === 'hard') {
        repo.requireWorktree('gent reset --hard');
        const current = new Map(index.staged().map(e => [e.path, { mode: e.mode, oid: e.oid }]));
        const plan = await worktree.planCheckout(repo, { from: current, to: targetTree, index, force: true });
        applied = await worktree.applyCheckout(repo, plan, { index });
        await index.write(repo.indexPath);
    } else if (mode === 'mixed') {
        const rebuilt = new GitIndex();
        rebuilt.sourceBytes = index.sourceBytes;
        for (const [filePath, entry] of targetTree) {
            rebuilt.add(new IndexEntry({ path: filePath, oid: entry.oid, mode: entry.mode }));
        }
        await rebuilt.write(repo.indexPath);
    }

    if (head.detached) {
        await repo.refs.setHeadDetached(commitOid, `reset: moving to ${target || 'HEAD'}`, head);
    } else if (head.ref) {
        await repo.refs.update(head.ref, commitOid, { expectedOldOid: head.oid, reason: `reset: moving to ${target || 'HEAD'}` });
    }

    await clearMergeState(repo);
    await worktree.completeCheckout(repo);
    return { oid: commitOid, mode, ...applied };
}

/**
 * Unstage paths: rewrite their index entries from HEAD, leaving files alone.
 * @param {Object} repo
 * @param {Array<String>} paths
 * @returns {Promise<Array<String>>}
 */
async function unstagePaths(repo, paths) {
    await repo.assertNoExternalOperation('gent reset <paths>');
    const head = await repo.refs.head();
    const headTree = head.oid
        ? await worktree.readTreeRecursive(repo, (await repo.objects.readCommit(head.oid)).tree)
        : new Map();

    const index = await GitIndex.read(repo.indexPath);
    const wanted = await expandPaths(repo, paths, { index });
    const changed = [];

    for (const relativePath of wanted) {
        const target = headTree.get(relativePath);
        if (!target) {
            if (index.remove(relativePath)) changed.push(relativePath);
            continue;
        }
        const existing = index.get(relativePath);
        if (existing && existing.oid === target.oid && existing.mode === target.mode) continue;

        index.add(new IndexEntry({ path: relativePath, oid: target.oid, mode: target.mode }));
        changed.push(relativePath);
    }

    await index.write(repo.indexPath);
    return changed;
}

module.exports = {
    OperationError,
    openRepository,
    resolveRevision,
    peelToCommit,
    walkHistory,
    findMergeBase,
    isAncestor,
    expandPaths,
    addPaths,
    removePaths,
    createCommit,
    readMergeState,
    writeMergeState,
    clearMergeState,
    listBranches,
    createBranch,
    deleteBranch,
    listTags,
    createTag,
    deleteTag,
    checkout,
    checkoutPaths,
    reset,
    unstagePaths,
    status: worktree.status,
    readTreeRecursive: worktree.readTreeRecursive,
    buildTreeFromIndex: worktree.buildTreeFromIndex
};
