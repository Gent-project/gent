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
