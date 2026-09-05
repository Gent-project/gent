const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const repository = require('../../src/utils/repository');
const ops = require('../../src/utils/gent-ops');
const stash = require('../../src/utils/stash-ops');
const worktree = require('../../src/utils/worktree');
const { GitIndex } = require('../../src/utils/git-index');

async function fixture(t) {
    const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'gent-engine-')));
    t.after(() => fs.rm(root, { recursive: true, force: true }));
    const { repo } = await repository.init(root);
    repo.identity = async () => ({ name: 'Test', email: 'test@example.com', timestamp: 1700000000, timezone: '+0000' });
    await fs.writeFile(path.join(root, 'a'), 'base\n');
    await ops.addPaths(repo, [path.join(root, 'a')]);
    await ops.createCommit(repo, { message: 'base' });
    return repo;
}

test('checkout refuses staged changes without changing files, index or HEAD', async t => {
    const repo = await fixture(t);
    await ops.createBranch(repo, 'other');
    await fs.writeFile(path.join(repo.worktree, 'a'), 'staged\n');
    await ops.addPaths(repo, [path.join(repo.worktree, 'a')]);
    const before = await fs.readFile(repo.indexPath);
    await assert.rejects(ops.checkout(repo, 'other'), /staged changes/);
    assert.equal(await fs.readFile(path.join(repo.worktree, 'a'), 'utf8'), 'staged\n');
    assert.deepEqual(await fs.readFile(repo.indexPath), before);
    assert.equal((await repo.refs.head()).branch, 'main');
});

test('hard reset restores unstaged changes even when index matches HEAD', async t => {
    const repo = await fixture(t);
    await fs.writeFile(path.join(repo.worktree, 'a'), 'dirty\n');
    await ops.reset(repo, 'hard', 'HEAD');
    assert.equal(await fs.readFile(path.join(repo.worktree, 'a'), 'utf8'), 'base\n');
    assert.equal((await ops.status(repo)).unstaged.length, 0);
});

test('stale index writer refuses to replace newer staged content', async t => {
    const repo = await fixture(t);
    const first = await GitIndex.read(repo.indexPath), stale = await GitIndex.read(repo.indexPath);
    first.get('a').oid = await repo.objects.write('blob', Buffer.from('new staged'));
    await first.write(repo.indexPath);
    const before = await fs.readFile(repo.indexPath);
    await assert.rejects(stale.write(repo.indexPath), /index changed/);
    assert.deepEqual(await fs.readFile(repo.indexPath), before);
});

test('stash push cleans worktree and apply preserves later commits without staging', async t => {
    const repo = await fixture(t);
    await fs.writeFile(path.join(repo.worktree, 'a'), 'shelved\n');
    await stash.push(repo);
    assert.equal(await fs.readFile(path.join(repo.worktree, 'a'), 'utf8'), 'base\n');
    await fs.writeFile(path.join(repo.worktree, 'later'), 'later commit\n');
    await ops.addPaths(repo, [path.join(repo.worktree, 'later')]);
    await ops.createCommit(repo, { message: 'later' });
    await stash.apply(repo);
    assert.equal(await fs.readFile(path.join(repo.worktree, 'later'), 'utf8'), 'later commit\n');
    assert.equal(await fs.readFile(path.join(repo.worktree, 'a'), 'utf8'), 'shelved\n');
    assert.deepEqual((await ops.status(repo)).staged, []);
});

test('stash --index restores staged deletions and separates unstaged changes', async t => {
    const repo = await fixture(t);
    await fs.writeFile(path.join(repo.worktree, 'b'), 'b\n');
    await ops.addPaths(repo, [path.join(repo.worktree, 'b')]);
    await ops.createCommit(repo, { message: 'b' });
    await fs.rm(path.join(repo.worktree, 'b'));
    await ops.addPaths(repo, [path.join(repo.worktree, 'b')]);
    await fs.writeFile(path.join(repo.worktree, 'a'), 'unstaged\n');
    await stash.push(repo);
    await stash.apply(repo, 0, { restoreIndex: true });
    const state = await ops.status(repo);
    assert.deepEqual(state.staged, [{ path: 'b', status: 'deleted' }]);
    assert.deepEqual(state.unstaged, [{ path: 'a', status: 'modified' }]);
});

test('checkout recovery remains until index publication and restores prior bytes', async t => {
    const repo = await fixture(t);
    const index = await GitIndex.read(repo.indexPath);
    const target = new Map([['a', { mode: index.get('a').mode, oid: await repo.objects.write('blob', Buffer.from('target\n')) }]]);
    const current = new Map(index.staged().map(e => [e.path, e]));
    const before = await fs.readFile(repo.indexPath);
    await worktree.applyCheckout(repo, await worktree.planCheckout(repo, { from: current, to: target, index }), { index });
    assert.ok(await worktree.pendingCheckout(repo));
    await worktree.abortCheckout(repo);
    assert.equal(await fs.readFile(path.join(repo.worktree, 'a'), 'utf8'), 'base\n');
    assert.deepEqual(await fs.readFile(repo.indexPath), before);
    assert.equal(await worktree.pendingCheckout(repo), null);
});

test('recovery refuses intervening file edits', async t => {
    const repo = await fixture(t);
    const index = await GitIndex.read(repo.indexPath);
    const current = new Map(index.staged().map(e => [e.path, e]));
    const target = new Map([['a', { mode: index.get('a').mode, oid: await repo.objects.write('blob', Buffer.from('target\n')) }]]);
    await worktree.applyCheckout(repo, await worktree.planCheckout(repo, { from: current, to: target, index }), { index });
    await fs.writeFile(path.join(repo.worktree, 'a'), 'new user work\n');
    await assert.rejects(worktree.abortCheckout(repo), /changed after checkout/);
    assert.equal(await fs.readFile(path.join(repo.worktree, 'a'), 'utf8'), 'new user work\n');
});

test('checkout can recover failure after index publication but before HEAD update', async t => {
    const repo = await fixture(t);
    await ops.createBranch(repo, 'other');
    await fs.writeFile(path.join(repo.worktree, 'a'), 'main\n');
    await ops.addPaths(repo, [path.join(repo.worktree, 'a')]);
    await ops.createCommit(repo, { message: 'main' });
    const before = await fs.readFile(repo.indexPath);
    const original = repo.refs.setHeadSymbolic;
    repo.refs.setHeadSymbolic = async () => { throw new Error('injected HEAD failure'); };
    await assert.rejects(ops.checkout(repo, 'other'), /injected HEAD failure/);
    repo.refs.setHeadSymbolic = original;
    assert.equal(await fs.readFile(path.join(repo.worktree, 'a'), 'utf8'), 'base\n');
    assert.ok(await worktree.pendingCheckout(repo));
    await worktree.abortCheckout(repo);
    assert.equal(await fs.readFile(path.join(repo.worktree, 'a'), 'utf8'), 'main\n');
    assert.deepEqual(await fs.readFile(repo.indexPath), before);
    assert.equal((await repo.refs.head()).branch, 'main');
});

test('init refuses legacy metadata without changing it', async t => {
    const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'gent-legacy-')));
    t.after(() => fs.rm(root, { recursive: true, force: true }));
    await fs.mkdir(path.join(root, '.gent'));
    await fs.writeFile(path.join(root, '.gent', 'commits.json'), '{"legacy":true}');
    await assert.rejects(repository.init(root), /v12 repository/);
    assert.equal(await fs.readFile(path.join(root, '.gent', 'commits.json'), 'utf8'), '{"legacy":true}');
    assert.equal(await fs.access(path.join(root, '.git')).then(() => true, () => false), false);
});

test('init ignores unrelated parent .gent config directories', async t => {
    const parent = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'gent-parent-config-')));
    t.after(() => fs.rm(parent, { recursive: true, force: true }));
    await fs.mkdir(path.join(parent, '.gent'));
    await fs.writeFile(path.join(parent, '.gent', 'auth.json'), '{}');
    await fs.writeFile(path.join(parent, '.gent', 'cli-config.json'), '{}');

    const child = path.join(parent, 'project');
    const result = await repository.init(child);

    assert.equal(result.created, true);
    assert.equal(result.gitdir, path.join(child, '.gent'));
    assert.equal(await fs.access(path.join(child, '.git')).then(() => true, () => false), true);
});

test('stash conflict refuses before mutation and retains the stash', async t => {
    const repo = await fixture(t);
    await fs.writeFile(path.join(repo.worktree, 'a'), 'stashed\n');
    await stash.push(repo);
    await fs.writeFile(path.join(repo.worktree, 'a'), 'new committed\n');
    await ops.addPaths(repo, [path.join(repo.worktree, 'a')]);
    await ops.createCommit(repo, { message: 'new' });
    const before = await fs.readFile(repo.indexPath);
    await assert.rejects(stash.pop(repo), /stash conflicts/);
    assert.equal(await fs.readFile(path.join(repo.worktree, 'a'), 'utf8'), 'new committed\n');
    assert.deepEqual(await fs.readFile(repo.indexPath), before);
    assert.equal((await stash.list(repo)).length, 1);
});

test('rm preflights all paths and preserves unstaged content', async t => {
    const repo = await fixture(t);
    await fs.writeFile(path.join(repo.worktree, 'a'), 'keep me\n');
    await assert.rejects(ops.removePaths(repo, [path.join(repo.worktree, 'a')]), /local changes/);
    assert.equal(await fs.readFile(path.join(repo.worktree, 'a'), 'utf8'), 'keep me\n');
    assert.ok((await GitIndex.read(repo.indexPath)).get('a'));
});

test('rm publishes an actual staged deletion', async t => {
    const repo = await fixture(t);
    await ops.removePaths(repo, [path.join(repo.worktree, 'a')]);
    assert.equal(await fs.access(path.join(repo.worktree, 'a')).then(() => true, () => false), false);
    assert.deepEqual((await ops.status(repo)).staged, [{ path: 'a', status: 'deleted' }]);
    assert.equal(await worktree.pendingCheckout(repo), null);
});
