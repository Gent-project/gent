/** Recoverable offline migration. Ambiguous legacy state is refused, never guessed. */
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const { ObjectStore } = require('./object-store');
const { GitIndex, IndexEntry } = require('./git-index');
const { serializeTree, serializeCommit, serializeTag, hashObject, assertObjectId } = require('./git-objects');
const { assertRefName } = require('./refs');
const { writeAtomic, readFileOrNull, Lock } = require('./lockfile');
const { closure, migrationInfo, remoteUrl, nameCheck } = require('./smart-http');
const repository = require('./repository');
const { DEFAULT_IGNORE_PATTERNS } = require('./constants');

function safeName(name) {
    if (typeof name !== 'string' || !name || name.includes('\\') || name.includes('\0') || name.split('/').some(p => !p || ['.', '..', '.git', '.gent'].includes(p.toLowerCase()))) throw new Error(`unsafe legacy path: ${name}`);
    return name;
}
function identity(value, timestamp) {
    const seconds = Math.floor(Date.parse(timestamp) / 1000);
    if (!Number.isSafeInteger(seconds)) throw new Error('legacy timestamp is missing or invalid');
    const name = value?.name || 'Unknown', email = value?.email || '';
    if (/[\n\r\0<>]/.test(name + email)) throw new Error('unsafe legacy identity');
    return { name, email, timestamp: seconds, timezone: '+0000' };
}
async function convert(history, readBlob) {
    const incoming = new Map(), mapping = {}, trees = new Map();
    const put = (type, payload) => { const oid = hashObject(type, payload); incoming.set(oid, { oid, type, payload }); return oid; };
    async function tree(entries) {
        const root = new Map(), flat = new Map();
        for (const entry of entries) {
            const name = safeName(entry.name || entry.path), oid = assertObjectId(entry.hash);
            const mode = parseInt(entry.mode || '100644', 8);
            if (entry.type && entry.type !== 'blob' || ![0o100644, 0o100755, 0o120000].includes(mode)) throw new Error('unsupported legacy historical mode/type');
            if (flat.has(name)) throw new Error('duplicate legacy tree path');
            const payload = await readBlob(oid);
            if (hashObject('blob', payload) !== oid) throw new Error(`corrupt legacy blob ${oid}`);
            put('blob', payload); flat.set(name, { path: name, oid, mode, size: payload.length });
            const parts = name.split('/'); let node = root;
            for (const part of parts.slice(0, -1)) {
                if (!node.has(part)) node.set(part, new Map());
                node = node.get(part);
                if (!(node instanceof Map)) throw new Error('legacy file/directory collision');
            }
            if (node.has(parts.at(-1))) throw new Error('legacy file/directory collision');
            node.set(parts.at(-1), { oid, mode });
        }
        const build = node => put('tree', serializeTree([...node].map(([name, item]) => item instanceof Map ? { name, mode: 0o40000, oid: build(item) } : { name, ...item })));
        return { oid: build(root), flat };
    }
    let pending = [...history.commits];
    const allIds = new Set(pending.map(c => c.hash));
    if (allIds.size !== pending.length) throw new Error('duplicate legacy commit IDs');
    while (pending.length) {
        const remaining = [];
        for (const commit of pending) {
            assertObjectId(commit.hash);
            const parents = [commit.parent, commit.mergeParent].filter(Boolean);
            if (parents.some(p => !allIds.has(p))) throw new Error('missing legacy parent');
            if (parents.some(p => !mapping[p])) { remaining.push(commit); continue; }
            const entries = commit.tree || commit.files;
            if (!Array.isArray(entries)) throw new Error('legacy commit has no complete tree snapshot');
            const converted = await tree(entries);
            const author = identity(commit.author, commit.timestamp);
            const oid = put('commit', serializeCommit({ tree: converted.oid, parents: parents.map(p => mapping[p]),
                author, committer: author, message: Buffer.from(commit.message || '') }));
            mapping[commit.hash] = oid; trees.set(commit.hash, converted.flat);
        }
        if (remaining.length === pending.length) throw new Error('cyclic legacy history');
        pending = remaining;
    }
    const refs = new Map();
    for (const [name, old] of Object.entries(history.branches || {})) {
        assertRefName(`refs/heads/${name}`);
        if (old && !mapping[old]) throw new Error('branch names missing legacy commit');
        if (old) refs.set(`refs/heads/${name}`, mapping[old]);
    }
    for (const [name, tag] of Object.entries(history.tags || {})) {
        assertRefName(`refs/tags/${name}`);
        if (!mapping[tag.hash]) throw new Error('tag names missing legacy commit');
        let oid = mapping[tag.hash];
        if (tag.annotated) oid = put('tag', serializeTag({ object: oid, targetType: 'commit', tag: name,
            tagger: identity(tag.tagger, tag.timestamp), message: Buffer.from(tag.message || '') }));
        refs.set(`refs/tags/${name}`, oid);
    }
    const branch = history.currentBranch;
    assertRefName(`refs/heads/${branch}`);
    if (!Object.hasOwn(history.branches, branch)) throw new Error('legacy current branch is missing');
    return { incoming, mapping, refs, branch, flat: trees.get(history.branches[branch]) || new Map() };
}
async function digestDirectory(directory) {
    const hash = crypto.createHash('sha256');
    async function walk(dir, prefix = '') {
        for (const entry of (await fs.readdir(dir, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
            const name = prefix + entry.name;
            if (entry.isSymbolicLink()) throw new Error('symlink in legacy metadata; resolve before migrating');
            hash.update((entry.isDirectory() ? 'dir:' : 'file:') + name + '\0');
            if (entry.isDirectory()) await walk(path.join(dir, entry.name), name + '/');
            else hash.update(crypto.createHash('sha256').update(await fs.readFile(path.join(dir, entry.name))).digest());
        }
    }
    await walk(directory); return hash.digest('hex');
}
async function plan(root) {
    const source = path.join(root, '.gent');
    if (await readFileOrNull(path.join(root, '.git')) || await fs.lstat(path.join(root, '.git')).then(() => true, () => false)) throw new Error('existing .git metadata must not be overwritten');
    const json = async (name, fallback) => { const raw = await readFileOrNull(path.join(source, name)); return raw ? JSON.parse(raw) : fallback; };
    const history = await json('commits.json', null), config = await json('config.json', {}), staging = await json('staging.json', {});
    if (!history?.commits) throw new Error('run migrate from a legacy repository root');
    const stash = await json('stash.json', {}), journal = await json('journal.json', {});
    if (stash.stack?.length) throw new Error('apply or export legacy stashes before migration; their index/base state cannot be reconstructed safely');
    if (journal.entries?.length || journal.redo?.length) throw new Error('legacy undo history lacks exact index/worktree snapshots; archive journal.json outside the repository before migration if you accept retiring those undo actions');
    if (staging.mergeState) throw new Error('finish or abort the legacy merge before migration');
    const before = await digestDirectory(source);
    const store = new ObjectStore(path.join(source, 'objects'));
    const converted = await convert(history, oid => store.readBlob(oid));
    const flat = new Map(converted.flat);
    const entries = staging.entries || [];
    if ((staging.files || []).some(name => !entries.some(e => e.path === name))) throw new Error('staging has paths without stored blob IDs; re-stage them with v12 first');
    for (const entry of entries) {
        const name = safeName(entry.path);
        if (entry.status === 'deleted') { flat.delete(name); continue; }
        const payload = await store.readBlob(entry.hash);
        if (hashObject('blob', payload) !== entry.hash) throw new Error('corrupt staged blob');
        converted.incoming.set(entry.hash, { oid: entry.hash, type: 'blob', payload });
        flat.set(name, { path: name, oid: entry.hash, mode: converted.flat.get(name)?.mode || 0o100644, size: payload.length });
    }
    const index = new GitIndex();
    for (const entry of flat.values()) index.add(new IndexEntry(entry));
    await closure([...converted.refs].map(([name, oid]) => [oid, name.startsWith('refs/heads/') ? 'commit' : null]), oid => converted.incoming.get(oid));
    if (before !== await digestDirectory(source)) throw new Error('legacy metadata changed during inspection; stop other writers and retry');
    const remotes = {};
    for (const [name, remote] of Object.entries(config.remotes || {})) {
        nameCheck(name);
        const url = new URL(remote.url);
        const match = url.pathname.match(/^(.*)\/api\/repos\/([^/]+)\/([^/]+)\/?$/);
        if (match) url.pathname = `${match[1]}/${match[2]}/${match[3]}.git`;
        remotes[name] = remoteUrl(url.toString());
        const server = await migrationInfo(remotes[name]);
        for (const [old, mapped] of Object.entries(server.mapping || {})) {
            if (converted.mapping[old] && converted.mapping[old] !== mapped) throw new Error(`client/server migration mapping differs for ${old}; retain v12 state for reconciliation`);
        }
        for (const [ref, target] of Object.entries(server.refs || {})) {
            if (ref.startsWith('refs/tags/') && converted.refs.has(ref) && converted.refs.get(ref) !== target) throw new Error(`client/server tag conversion differs for ${ref}; reconcile the original tag metadata first`);
        }
        if (Object.keys(converted.mapping).length && Object.keys(server.mapping || {}).length && !Object.keys(server.mapping).some(old => converted.mapping[old])) throw new Error('no shared migration history with configured server; verify remote ownership');
    }
    return { ...converted, index, before, config, source, remotes };
}
function paths(root, id) {
    if (!/^[0-9a-f-]{36}$/.test(id)) throw new Error('invalid migration journal ID');
    const workspace = path.join(path.dirname(root), `.${path.basename(root)}-gent-migration-${id}`);
    return { workspace, source: path.join(root, '.gent'), candidate: path.join(workspace, '.gent'),
        original: path.join(workspace, 'original'), backup: path.join(workspace, 'backup'),
        journal: path.join(root, '.gent-migration.json'), pointer: path.join(root, '.git') };
}
async function exists(name) { return fs.lstat(name).then(() => true, error => { if (error.code === 'ENOENT') return false; throw error; }); }
async function recover(root, abort = false) {
    const raw = await readFileOrNull(path.join(root, '.gent-migration.json'));
    let state;
    if (!raw && abort) {
        const marker = await readFileOrNull(path.join(root, '.gent', 'gent', 'migration-pointer.json'));
        if (!marker) throw new Error('no migration to roll back');
        const p = paths(root, JSON.parse(marker).id);
        state = JSON.parse(await fs.readFile(path.join(p.workspace, 'completed.json'), 'utf8'));
        if (await digestDirectory(p.source) !== state.candidate) throw new Error('new canonical state exists; rollback would discard history, preserve it and recover manually');
        await writeAtomic(p.journal, JSON.stringify(state));
    } else if (!raw) throw new Error('no interrupted migration to recover');
    else state = JSON.parse(raw);
    const p = paths(root, state.id);
    if (state.format !== 'gent-migration-1' || await digestDirectory(p.backup) !== state.before) throw new Error('migration backup verification failed; preserve files for manual recovery');
    const pointer = await readFileOrNull(p.pointer);
    if (pointer && pointer.toString() !== 'gitdir: .gent\n') throw new Error('unrecognized .git pointer; refusing recovery');
    const actual = await exists(p.source) ? await digestDirectory(p.source) : null;
    if (actual && actual !== state.before && actual !== state.candidate) throw new Error('repository changed after migration; preserve new history and recover manually');
    if (abort) {
        if (actual === state.candidate) {
            if (await exists(p.candidate)) throw new Error('ambiguous candidate store; refusing recovery');
            await fs.rename(p.source, p.candidate);
        }
        if (!await exists(p.source)) {
            if (await digestDirectory(p.original) !== state.before) throw new Error('original metadata changed');
            await fs.rename(p.original, p.source);
        }
        if (pointer) await fs.unlink(p.pointer);
        await fs.unlink(p.journal);
        return { status: 'rolled back', backup: p.backup };
    }
    if (actual === state.before) {
        if (await exists(p.original)) throw new Error('ambiguous original store; refusing recovery');
        await fs.rename(p.source, p.original);
    }
    if (!await exists(p.source)) {
        if (await digestDirectory(p.candidate) !== state.candidate) throw new Error('candidate metadata changed');
        await fs.rename(p.candidate, p.source);
    }
    if (!pointer) {
        // Lock and compare the pointer so an unrelated concurrent init is never replaced.
        const pointerLock = await Lock.acquire(p.pointer);
        try {
            if (await exists(p.pointer)) throw new Error('.git appeared during migration; refusing overwrite');
            await pointerLock.write('gitdir: .gent\n');
            await pointerLock.commit();
        } finally { await pointerLock.release(); }
    }
    await writeAtomic(path.join(p.workspace, 'completed.json'), JSON.stringify(state));
    await fs.unlink(p.journal);
    return { status: 'migrated', backup: p.backup, mapping: path.join(p.source, 'gent', 'migration.json') };
}
async function migrate(root, options = {}) {
    root = await fs.realpath(root);
    if (options.abort && options.continue || options.dryRun && (options.abort || options.continue)) throw new Error('choose one migration operation');
    if (options.abort || options.continue) {
        const lock = await Lock.acquire(path.join(root, '.gent-migrate-operation'));
        try { return await recover(root, Boolean(options.abort)); } finally { await lock.release(); }
    }
    if (await exists(path.join(root, '.gent-migration.json'))) throw new Error('interrupted migration detected; use gent migrate --continue or --abort');
    const value = await plan(root);
    const summary = { format: 'gent-migration-1', commits: Object.keys(value.mapping).length, objects: value.incoming.size,
        refs: Object.fromEntries(value.refs), mapping: value.mapping,
        fallback: 'Historical absent modes become 100644; author timestamp rounded down to seconds, UTC; committer equals author; exact stored message bytes retained.',
        ignore: 'Legacy implicit exclusions become explicit info/exclude rules; .gitignore and .gentignore become visible.' };
    if (options.dryRun) return summary;
    const lock = await Lock.acquire(path.join(root, '.gent-migrate-operation'));
    try {
        if (await exists(path.join(root, '.gent-migration.json'))) throw new Error('another migration started; recover it first');
        const id = crypto.randomUUID(), p = paths(root, id);
        await fs.mkdir(p.workspace);
        await fs.cp(value.source, p.backup, { recursive: true, errorOnExist: true, force: false });
        if (await digestDirectory(p.backup) !== value.before) throw new Error('backup verification failed');
        const { repo } = await repository.init(p.workspace, { defaultBranch: value.branch });
        for (const item of value.incoming.values()) await repo.objects.writeVerified(item.oid, item.type, item.payload);
        for (const [name, oid] of value.refs) await repo.refs.update(name, oid, { expectedOldOid: null, reason: 'migrate legacy history' });
        // Also retain orphaned legacy commits that were not branch or tag tips.
        for (const [old, oid] of Object.entries(value.mapping)) await repo.refs.update(`refs/gent/migration/${old}`, oid, { expectedOldOid: null });
        await require('./worktree').buildTreeFromIndex(repo, value.index);
        await value.index.write(repo.indexPath);
        for (const key of ['name', 'email']) if (value.config.user?.[key]) repo.localConfig.set(`user.${key}`, value.config.user[key]);
        for (const [name, url] of Object.entries(value.remotes)) {
            repo.localConfig.set(`remote.${name}.url`, url);
            repo.localConfig.set(`remote.${name}.fetch`, `+refs/heads/*:refs/remotes/${name}/*`);
        }
        await repo.localConfig.save();
        await writeAtomic(path.join(repo.gentMetaDir, 'migration.json'), JSON.stringify(summary, null, 2));
        await writeAtomic(path.join(repo.gentMetaDir, 'legacy-config.json'), JSON.stringify(value.config, null, 2));
        const gentIgnore = (await readFileOrNull(path.join(root, '.gentignore')))?.toString() || '';
        await writeAtomic(path.join(repo.gitdir, 'info', 'exclude'), DEFAULT_IGNORE_PATTERNS.filter(p => !['.gitignore', '.gentignore'].includes(p)).join('\n') + '\n' + gentIgnore + '\n');
        await closure([...value.refs].map(([name, oid]) => [oid, name.startsWith('refs/heads/') ? 'commit' : null]), oid => repo.objects.read(oid));
        for (const url of Object.values(value.remotes)) await migrationInfo(url);
        if (await exists(p.pointer) || await digestDirectory(value.source) !== value.before) throw new Error('legacy repository changed during migration; active state was preserved');
        await writeAtomic(path.join(repo.gitdir, 'gent', 'migration-pointer.json'), JSON.stringify({ id }));
        const state = { format: 'gent-migration-1', id, before: value.before, candidate: await digestDirectory(repo.gitdir) };
        await writeAtomic(p.journal, JSON.stringify(state));
        if (options.afterPrepare) await options.afterPrepare(); // fault injection for recovery tests
        return await recover(root);
    } finally { await lock.release(); }
}
module.exports = { convert, plan, migrate, digestDirectory };
