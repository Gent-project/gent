/** Exact local checkpoints for canonical undo/redo. Private refs retain every
 * object needed by a checkpoint when external Git runs garbage collection.
 */
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const { GitIndex, IndexEntry } = require('./git-index');
const { IgnoreMatcher, walkWorktree } = require('./ignore');
const { serializeCommit, serializeTree, MODE } = require('./git-objects');
const { writeAtomic, readFileOrNull } = require('./lockfile');
const worktree = require('./worktree');

const journalPath = repo => path.join(repo.gentWorktreeMetaDir, 'journal.json');
async function read(repo) {
    const bytes = await readFileOrNull(journalPath(repo));
    return bytes ? JSON.parse(bytes.toString()) : { undo: [], redo: [] };
}
async function save(repo, journal) { await writeAtomic(journalPath(repo), JSON.stringify(journal)); }

async function capture(repo) {
    const index = await GitIndex.read(repo.indexPath);
    const files = {};
    const matcher = new IgnoreMatcher(repo);
    const names = new Set(index.entries.map(e => e.path));
    for await (const entry of walkWorktree(repo, matcher, { tracked: names })) names.add(entry.path);
    for (const name of [...names].sort()) {
        const file = await worktree.snapshotPath(repo, name);
        if (file) files[name] = { mode: file.mode, oid: await repo.objects.write('blob', Buffer.from(file.content, 'base64')) };
    }
    const refs = Object.fromEntries([...(await repo.refs.list())].filter(([name]) => !name.startsWith('refs/gent/')).sort(([a], [b]) => a.localeCompare(b)));
    const merge = {};
    for (const name of ['MERGE_HEAD', 'MERGE_MSG', 'MERGE_MODE', 'ORIG_HEAD']) merge[name] = (await readFileOrNull(repo.gitPath(name)))?.toString('base64') ?? null;
    return { head: await repo.refs.head(), refs, index: index.sourceBytes?.toString('base64') ?? null, files, merge };
}

async function retain(repo, state, prefix) {
    const entries = [];
    // These are retention objects, not worktree trees. Numeric names allow
    // conflicted index stages and staged/unstaged versions to coexist.
    for (const item of Object.values(state.files)) entries.push({ name: String(entries.length), mode: MODE.REGULAR, oid: item.oid });
    if (state.index) {
        for (const item of GitIndex.parse(Buffer.from(state.index, 'base64')).entries) {
            if (item.mode === MODE.GITLINK) throw new Error('journal checkpoints do not support submodules');
            entries.push({ name: String(entries.length), mode: MODE.REGULAR, oid: item.oid });
        }
    }
    const tree = await repo.objects.write('tree', serializeTree(entries));
    const identity = { name: 'Gent checkpoint', email: 'checkpoint@gent.local', timestamp: Math.floor(Date.now() / 1000), timezone: '+0000' };
    const oid = await repo.objects.write('commit', serializeCommit({ tree, parents: state.head.oid ? [state.head.oid] : [], author: identity, committer: identity, message: Buffer.from('Gent undo checkpoint\n') }));
    await repo.refs.update(`${prefix}/snapshot`, oid, { expectedOldOid: null, reason: 'retain undo checkpoint' });
    let n = 0;
    for (const target of new Set(Object.values(state.refs))) await repo.refs.update(`${prefix}/ref-${n++}`, target, { expectedOldOid: null, reason: 'retain undo ref' });
}

async function begin(repo, name) {
    const before = await capture(repo);
    const id = crypto.randomUUID();
    await retain(repo, before, `refs/gent/journal/${id}/before`);
    return { id, name, before };
}

async function finish(repo, entry) {
    entry.after = await capture(repo);
    await retain(repo, entry.after, `refs/gent/journal/${entry.id}/after`);
    const journal = await read(repo);
    journal.undo.push(entry);
    journal.redo = [];
    await save(repo, journal);
}

function sameState(a, b) {
    // Index stat refreshes by other tools are harmless. Compare staged content
    // and flags, not filesystem cache timestamps.
    const semantic = state => {
        const entries = state.index ? GitIndex.parse(Buffer.from(state.index, 'base64')).entries : [];
        return { ...state, index: entries.map(e => ({ path: e.path, oid: e.oid, mode: e.mode, stage: e.stage, assumeValid: e.assumeValid, skipWorktree: e.skipWorktree, intentToAdd: e.intentToAdd })) };
    };
    return JSON.stringify(semantic(a)) === JSON.stringify(semantic(b));
}

async function restore(repo, redo = false) {
    await worktree.assertNoPendingCheckout(repo, 'undo/redo');
    const journal = await read(repo);
    const source = redo ? journal.redo : journal.undo;
    const entry = source[source.length - 1];
    if (!entry) throw new Error(`nothing to ${redo ? 'redo' : 'undo'}`);
    const expected = redo ? entry.before : entry.after;
    const target = redo ? entry.after : entry.before;
    const current = await capture(repo);
    if (!sameState(current, expected)) throw new Error('repository changed since the recorded operation; refusing to overwrite intervening work');
    const index = await GitIndex.read(repo.indexPath);
    const targetIndex = target.index ? GitIndex.parse(Buffer.from(target.index, 'base64')) : new GitIndex();
    const from = new Map(Object.entries(current.files));
    const to = new Map(Object.entries(target.files));
    const plan = await worktree.planCheckout(repo, { from, to, index, force: true });
    // Snapshots store exact working bytes, so EOL conversion must not run twice.
    for (const write of plan.writes) write.content = (await repo.objects.readBlob(write.oid)).toString('base64');
    await worktree.applyCheckout(repo, plan, { index });
    index.entries = targetIndex.entries;
    index.extensions.clear();
    await index.write(repo.indexPath);
    for (const name of new Set([...Object.keys(current.refs), ...Object.keys(target.refs)])) {
        if (current.refs[name] === target.refs[name]) continue;
        if (target.refs[name]) await repo.refs.update(name, target.refs[name], { expectedOldOid: current.refs[name] || null, reason: redo ? 'redo' : 'undo' });
        else await repo.refs.delete(name, { expectedOldOid: current.refs[name], reason: redo ? 'redo' : 'undo' });
    }
    // A branch ref may already have moved above; HEAD's expected oid follows it.
    const expectedHead = { ...current.head, oid: current.head.ref ? (target.refs[current.head.ref] || null) : current.head.oid };
    if (target.head.ref) await repo.refs.setHeadSymbolic(target.head.ref, redo ? 'redo' : 'undo', expectedHead);
    else await repo.refs.setHeadDetached(target.head.oid, redo ? 'redo' : 'undo', expectedHead);
    for (const [name, bytes] of Object.entries(target.merge)) {
        if (bytes === null) await fs.rm(repo.gitPath(name), { force: true });
        else await writeAtomic(repo.gitPath(name), Buffer.from(bytes, 'base64'));
    }
    source.pop();
    (redo ? journal.undo : journal.redo).push(entry);
    await save(repo, journal);
    await worktree.completeCheckout(repo);
    return entry.name;
}

module.exports = { begin, finish, restore, read };
