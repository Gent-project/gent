const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const repository = require('../../src/utils/repository');
const ops = require('../../src/utils/gent-ops');

const adapter = path.resolve(__dirname, '../../src/git-graph.js');
const gitPath = spawnSync('which', ['git'], { encoding: 'utf8' }).stdout.trim();

async function fixture(t) {
    const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'gent-graph-adapter-')));
    t.after(() => fs.rm(root, { recursive: true, force: true }));
    const configPath = path.join(root, 'git-graph.json');
    await fs.writeFile(configPath, JSON.stringify({ realGitPath: gitPath }));
    const work = path.join(root, 'work with ünicode');
    const { repo } = await repository.init(work);
    repo.identity = async () => ({ name: 'Graph Test', email: 'graph@example.com', timestamp: 1700000000, timezone: '+0000' });
    await fs.writeFile(path.join(work, 'hello world.txt'), 'base\n');
    await ops.addPaths(repo, [path.join(work, 'hello world.txt')]);
    const base = await ops.createCommit(repo, { message: 'base' });
    const env = {
        ...process.env,
        GENT_GRAPH_CONFIG: configPath,
        GIT_AUTHOR_NAME: 'Graph Test',
        GIT_AUTHOR_EMAIL: 'graph@example.com',
        GIT_COMMITTER_NAME: 'Graph Test',
        GIT_COMMITTER_EMAIL: 'graph@example.com'
    };
    const run = (args, expected = 0, cwd = work) => {
        const result = spawnSync(process.execPath, [adapter, ...args], { cwd, env, encoding: 'utf8' });
        assert.equal(result.status, expected, result.stderr || result.stdout);
        return result;
    };
    return { root, work, repo, base: base.oid, run, env };
}

test('forwards pinned Git Graph reads without changing canonical state', async t => {
    const f = await fixture(t);
    const beforeHead = await fs.readFile(path.join(f.work, '.gent', 'HEAD'));
    const beforeIndex = await fs.readFile(path.join(f.work, '.gent', 'index'));
    assert.equal(f.run(['rev-parse', '--show-toplevel']).stdout.trim(), f.work);
    assert.match(f.run(['branch', '--no-color']).stdout, /main/);
    assert.match(f.run(['-c', 'log.showSignature=false', 'log', '--max-count=10', '--format=%H%x1f%P%x1f%an%x1f%ae%x1f%ct%x1f%s', '--date-order', '--branches', 'HEAD', '--']).stdout, /base/);
    assert.equal(f.run(['show', `${f.base}:hello world.txt`]).stdout, 'base\n');
    assert.deepEqual(await fs.readFile(path.join(f.work, '.gent', 'HEAD')), beforeHead);
    assert.deepEqual(await fs.readFile(path.join(f.work, '.gent', 'index')), beforeIndex);
});

test('routes local Git Graph mutations through the Gent engine', async t => {
    const f = await fixture(t);
    f.run(['checkout', '-b', 'topic', f.base]);
    await fs.writeFile(path.join(f.work, 'hello world.txt'), 'topic\n');
    await ops.addPaths(await repository.open(f.work), [path.join(f.work, 'hello world.txt')]);
    const topic = await ops.createCommit(await repository.open(f.work), { message: 'topic' });
    let repo = await repository.open(f.work);
    repo.localConfig.set('branch.topic.remote', 'origin');
    repo.localConfig.set('branch.topic.merge', 'refs/heads/topic');
    await repo.localConfig.save();
    const oldLog = await fs.readFile(repo.refs.reflogPath('refs/heads/topic'));
    f.run(['branch', '-m', 'topic', 'renamed']);
    repo = await repository.open(f.work);
    assert.equal((await repo.refs.head()).branch, 'renamed');
    assert.equal(await repo.refs.resolveToOid('refs/heads/topic'), null);
    assert.equal(await repo.refs.resolveToOid('refs/heads/renamed'), topic.oid);
    assert.equal(repo.config.get('branch.renamed.remote'), 'origin');
    assert.equal(repo.config.get('branch.renamed.merge'), 'refs/heads/topic');
    assert.equal(repo.config.get('branch.topic.remote'), undefined);
    assert.deepEqual(await fs.readFile(repo.refs.reflogPath('refs/heads/renamed')), oldLog);

    f.run(['tag', 'v1', f.base]);
    f.run(['tag', '-a', 'v2', '-m', 'release', topic.oid]);
    repo = await repository.open(f.work);
    assert.deepEqual((await ops.listTags(repo)).map(item => item.name), ['v1', 'v2']);

    f.run(['reset', '--hard', f.base]);
    assert.equal(await fs.readFile(path.join(f.work, 'hello world.txt'), 'utf8'), 'base\n');
    await fs.writeFile(path.join(f.work, 'hello world.txt'), 'stashed\n');
    f.run(['stash', 'push', '--message', 'from graph']);
    assert.equal(await fs.readFile(path.join(f.work, 'hello world.txt'), 'utf8'), 'base\n');
    f.run(['stash', 'pop', 'stash@{0}']);
    assert.equal(await fs.readFile(path.join(f.work, 'hello world.txt'), 'utf8'), 'stashed\n');
});

test('rejects unapproved Gent commands but passes ordinary repositories through', async t => {
    const f = await fixture(t);
    const rejected = f.run(['clean', '-fd'], 1);
    assert.match(rejected.stderr, /unsupported Git Graph action 'clean'/);
    assert.equal(await fs.readFile(path.join(f.work, 'hello world.txt'), 'utf8'), 'base\n');

    const ordinary = path.join(f.root, 'ordinary');
    const initialized = spawnSync(gitPath, ['init', ordinary], { encoding: 'utf8' });
    assert.equal(initialized.status, 0, initialized.stderr);
    assert.equal(f.run(['rev-parse', '--is-inside-work-tree'], 0, ordinary).stdout.trim(), 'true');
});

test('handles version discovery without a repository', async t => {
    const f = await fixture(t);
    assert.match(f.run(['--version'], 0, f.root).stdout, /^git version /);
});

test('show rejects an output option containing a colon without overwriting files', async t => {
    const f = await fixture(t);
    const output = path.join(f.root, 'review:output');
    await fs.writeFile(output, 'keep this content');
    assert.match(f.run(['show', `--output=${output}`], 1).stderr, /unapproved show query/);
    assert.equal(await fs.readFile(output, 'utf8'), 'keep this content');
    assert.equal(f.run(['show', `${f.base}:hello world.txt`]).stdout, 'base\n');
});

test('rename namespace collisions leave no recovery marker or blocked mutations', async t => {
    const f = await fixture(t);
    const marker = path.join(f.repo.gentWorktreeMetaDir, 'branch-rename.json');
    assert.match(f.run(['branch', '-m', 'main', 'main/topic'], 1).stderr, /namespace conflicts/);
    await ops.createBranch(f.repo, 'topic/child');
    assert.match(f.run(['branch', '-m', 'main', 'topic'], 1).stderr, /namespace conflicts/);
    await assert.rejects(fs.access(marker), { code: 'ENOENT' });
    f.run(['tag', 'after-refusal', f.base]);
    const repo = await repository.open(f.work);
    assert.equal((await repo.refs.head()).branch, 'main');
    assert.equal(await repo.refs.resolveToOid('refs/tags/after-refusal'), f.base);
});

test('an unstarted rename from the previous implementation no longer blocks writes', async t => {
    const f = await fixture(t);
    const marker = path.join(f.repo.gentWorktreeMetaDir, 'branch-rename.json');
    await fs.writeFile(marker, JSON.stringify({
        oldName: 'main', newName: 'main/topic', oid: f.base,
        headWasOld: true, config: {}, reflog: null
    }));
    f.run(['tag', 'after-recovery', f.base]);
    await assert.rejects(fs.access(marker), { code: 'ENOENT' });
    const repo = await repository.open(f.work);
    assert.equal((await repo.refs.head()).branch, 'main');
    assert.equal(await repo.refs.resolveToOid('refs/heads/main'), f.base);
    assert.equal(await repo.refs.resolveToOid('refs/tags/after-recovery'), f.base);
});

test('a rename that published its new ref still finishes recovery', async t => {
    const f = await fixture(t);
    const marker = path.join(f.repo.gentWorktreeMetaDir, 'branch-rename.json');
    const reflog = await fs.readFile(f.repo.refs.reflogPath('refs/heads/main'));
    await fs.writeFile(marker, JSON.stringify({
        oldName: 'main', newName: 'renamed', oid: f.base,
        headWasOld: true, config: { remote: 'origin', merge: 'refs/heads/main' },
        reflog: reflog.toString('base64')
    }));
    await f.repo.refs.update('refs/heads/renamed', f.base, { expectedOldOid: null });
    f.run(['tag', 'after-recovery', f.base]);
    const repo = await repository.open(f.work);
    assert.equal((await repo.refs.head()).branch, 'renamed');
    assert.equal(await repo.refs.resolveToOid('refs/heads/main'), null);
    assert.equal(repo.config.get('branch.renamed.remote'), 'origin');
    assert.deepEqual(await fs.readFile(repo.refs.reflogPath('refs/heads/renamed')), reflog);
    await assert.rejects(fs.access(marker), { code: 'ENOENT' });
});

test('-C checks interrupted migration in the resolved repository before mutation', async t => {
    const f = await fixture(t);
    await fs.mkdir(path.join(f.work, 'sub'));
    await fs.writeFile(path.join(f.work, '.gent-migration.json'), '{}');
    const result = f.run(['-C', f.work, '-C', 'sub', 'branch', 'blocked', f.base], 1, f.root);
    assert.match(result.stderr, /interrupted migration/);
    assert.equal(await (await repository.open(f.work)).refs.resolveToOid('refs/heads/blocked'), null);
});

test('create-and-checkout refuses staged work before creating a branch and permits retry', async t => {
    const f = await fixture(t);
    const file = path.join(f.work, 'hello world.txt');
    await fs.writeFile(file, 'staged\n');
    await ops.addPaths(f.repo, [file]);
    const index = await fs.readFile(f.repo.indexPath);
    assert.match(f.run(['checkout', '-b', 'new', f.base], 1).stderr, /staged changes/);
    let repo = await repository.open(f.work);
    assert.equal(await repo.refs.resolveToOid('refs/heads/new'), null);
    assert.equal((await repo.refs.head()).branch, 'main');
    assert.deepEqual(await fs.readFile(repo.indexPath), index);
    assert.equal(await fs.readFile(file, 'utf8'), 'staged\n');
    await ops.createCommit(f.repo, { message: 'save staged work' });
    f.run(['checkout', '-b', 'new', f.base]);
    repo = await repository.open(f.work);
    assert.equal((await repo.refs.head()).branch, 'new');
    assert.equal((await repo.refs.head()).oid, f.base);
    assert.equal(await fs.readFile(file, 'utf8'), 'base\n');
});

test('create-and-checkout detects untracked overwrites before creating a branch', async t => {
    const f = await fixture(t);
    const file = path.join(f.work, 'collision.txt');
    await fs.writeFile(file, 'committed\n');
    await ops.addPaths(f.repo, [file]);
    const target = await ops.createCommit(f.repo, { message: 'target' });
    await ops.checkout(f.repo, f.base);
    await fs.writeFile(file, 'untracked\n');
    const result = f.run(['checkout', '-b', 'new', target.oid], 1);
    assert.match(result.stderr, /untracked/);
    assert.equal(await (await repository.open(f.work)).refs.resolveToOid('refs/heads/new'), null);
    assert.equal(await fs.readFile(file, 'utf8'), 'untracked\n');
});

test('a late checkout failure reports the created branch and retains abort recovery', async t => {
    const f = await fixture(t);
    const worktree = require('../../src/utils/worktree');
    const file = path.join(f.work, 'hello world.txt');
    await fs.writeFile(file, 'target\n');
    await ops.addPaths(f.repo, [file]);
    const target = await ops.createCommit(f.repo, { message: 'target' });
    await ops.checkout(f.repo, f.base);
    t.mock.method(f.repo.refs, 'setHeadSymbolic', async () => { throw new Error('injected HEAD write failure'); });
    await assert.rejects(ops.checkout(f.repo, 'new', { create: true, startPoint: target.oid }),
        /injected HEAD write failure[\s\S]*Branch 'new' was created[\s\S]*gent checkout --abort/);
    assert.equal(await f.repo.refs.resolveToOid('refs/heads/new'), target.oid);
    assert.equal(await fs.readFile(file, 'utf8'), 'target\n');
    assert.ok(await worktree.pendingCheckout(f.repo));
    await worktree.abortCheckout(f.repo);
    assert.equal(await fs.readFile(file, 'utf8'), 'base\n');
    assert.equal(await worktree.pendingCheckout(f.repo), null);
});
