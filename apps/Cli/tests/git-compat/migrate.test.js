const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { ObjectStore } = require('../../src/utils/object-store');
const { migrate, digestDirectory } = require('../../src/utils/migrate');
const { open } = require('../../src/utils/repository');
const ops = require('../../src/utils/gent-ops');
const { GitIndex } = require('../../src/utils/git-index');

async function fixture(t) {
    const parent = await fs.mkdtemp(path.join(os.tmpdir(), 'gent-migrate-'));
    t.after(() => fs.rm(parent, { recursive: true, force: true }));
    const root = path.join(parent, 'repo'), source = path.join(root, '.gent');
    await fs.mkdir(source, { recursive: true });
    const objects = new ObjectStore(path.join(source, 'objects'));
    const base = await objects.write('blob', Buffer.from('base\n'));
    const staged = await objects.write('blob', Buffer.from('staged\n'));
    await fs.writeFile(path.join(root, 'file'), 'unstaged\n');
    await fs.writeFile(path.join(root, 'untracked'), Buffer.from([0, 255]));
    await fs.writeFile(path.join(source, 'commits.json'), JSON.stringify({ commits: [{ hash: '1'.repeat(64), parent: null,
        tree: [{ mode: '100644', name: 'file', hash: base, type: 'blob' }], message: 'Legacy',
        author: { name: 'Author', email: 'a@example.com' }, timestamp: '2020-01-02T03:04:05.678Z' }],
        branches: { main: '1'.repeat(64) }, currentBranch: 'main' }));
    await fs.writeFile(path.join(source, 'staging.json'), JSON.stringify({ files: ['file'], entries: [{ path: 'file', hash: staged, status: 'modified' }] }));
    await fs.writeFile(path.join(source, 'config.json'), JSON.stringify({ user: { name: 'Author', email: 'a@example.com' } }));
    return { root, source, base, staged };
}

test('migration dry run is read only; activation retains staged/unstaged bytes and backup', async t => {
    const f = await fixture(t), before = await digestDirectory(f.root);
    const report = await migrate(f.root, { dryRun: true });
    assert.equal(await digestDirectory(f.root), before);
    assert.equal(report.commits, 1);
    const result = await migrate(f.root);
    const repo = await open(f.root), index = await GitIndex.read(repo.indexPath);
    assert.equal(index.get('file').oid, f.staged);
    assert.equal(await fs.readFile(path.join(f.root, 'file'), 'utf8'), 'unstaged\n');
    const status = await ops.status(repo);
    assert.equal(status.staged.length, 1);
    assert.equal(status.unstaged.length, 1);
    assert.deepEqual(status.untracked, ['untracked']);
    assert.equal((await repo.refs.head()).oid, report.mapping['1'.repeat(64)]);
    assert(await fs.stat(result.backup));
});

test('interrupted migration can abort or continue without touching working files', async t => {
    const f = await fixture(t), before = await digestDirectory(f.source);
    await assert.rejects(migrate(f.root, { afterPrepare: () => { throw new Error('simulated crash'); } }), /simulated crash/);
    assert.equal((await migrate(f.root, { abort: true })).status, 'rolled back');
    assert.equal(await digestDirectory(f.source), before);
    await assert.rejects(migrate(f.root, { afterPrepare: () => { throw new Error('simulated crash'); } }), /simulated crash/);
    assert.equal((await migrate(f.root, { continue: true })).status, 'migrated');
    assert.equal(await fs.readFile(path.join(f.root, 'file'), 'utf8'), 'unstaged\n');
});

test('legacy states lacking recoverable snapshots refuse without changes', async t => {
    const f = await fixture(t);
    await fs.writeFile(path.join(f.source, 'stash.json'), JSON.stringify({ stack: [{ message: 'saved' }] }));
    const before = await digestDirectory(f.root);
    await assert.rejects(migrate(f.root, { dryRun: true }), /legacy stashes/);
    assert.equal(await digestDirectory(f.root), before);
});

test('completed migration rolls back only before subsequent canonical metadata changes', async t => {
    const f = await fixture(t), before = await digestDirectory(f.source);
    await migrate(f.root);
    assert.equal((await migrate(f.root, { abort: true })).status, 'rolled back');
    assert.equal(await digestDirectory(f.source), before);
    await migrate(f.root);
    const repo = await open(f.root);
    await repo.objects.write('blob', Buffer.from('new canonical object'));
    await assert.rejects(migrate(f.root, { abort: true }), /new canonical state/);
    await assert.rejects(fs.access(path.join(f.root, '.gent-migration.json')));
});

test('shared client/server migration contract produces identical IDs and bytes', async () => {
    const fixture = require('../../../../tests/fixtures/git-compat/legacy.json');
    const { convert } = require('../../src/utils/migrate');
    const result = await convert(fixture.history, async oid => Buffer.from(fixture.blobs[oid], 'base64'));
    assert.deepEqual(result.mapping, fixture.mapping);
    assert.deepEqual(Object.fromEntries(result.refs), fixture.refs);
    for (const item of fixture.objects) assert.deepEqual(result.incoming.get(item.oid).payload, Buffer.from(item.payload, 'base64'));
});
