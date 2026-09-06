const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const repository = require('../../src/utils/repository');
const { GitIndex } = require('../../src/utils/git-index');
const cli = path.resolve(__dirname, '../../src/index.js');

test('canonical CLI initializes, commits, checks out, stashes and rejects unconfigured remote writes', async t => {
    const cwd = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'gent-cli-canonical-')));
    t.after(() => fs.rm(cwd, { recursive: true, force: true }));
    const env = { ...process.env, GIT_AUTHOR_NAME: 'Test', GIT_AUTHOR_EMAIL: 'test@example.com', GIT_COMMITTER_NAME: 'Test', GIT_COMMITTER_EMAIL: 'test@example.com' };
    function gent(...args) {
        const result = spawnSync(process.execPath, [cli, ...args], { cwd, env, encoding: 'utf8' });
        assert.equal(result.status, 0, result.stderr || result.stdout);
        return result.stdout;
    }
    gent('init', '-y');
    await fs.writeFile(path.join(cwd, 'a'), 'base\n');
    gent('add', 'a'); gent('commit', '-m', 'base');
    assert.match(gent('log', '--oneline'), /base/);
    assert.match(gent('log', '--graph', '--stat'), /^\* .+base\n 1 file changed/m);
    gent('undo');
    assert.match(gent('status'), /staged added: a/);
    gent('redo');
    assert.match(gent('status'), /clean/);
    gent('branch', 'feature'); gent('checkout', 'feature');
    await fs.writeFile(path.join(cwd, 'a'), 'feature\n');
    assert.match(gent('diff'), /feature/);
    gent('commit', '-am', 'feature');
    gent('checkout', 'main');
    gent('undo');
    assert.equal(await fs.readFile(path.join(cwd, 'a'), 'utf8'), 'feature\n');
    gent('redo');
    assert.equal(await fs.readFile(path.join(cwd, 'a'), 'utf8'), 'base\n');
    await fs.writeFile(path.join(cwd, 'a'), 'dirty\n');
    gent('stash');
    assert.equal(await fs.readFile(path.join(cwd, 'a'), 'utf8'), 'base\n');
    gent('stash', 'pop');
    assert.equal(await fs.readFile(path.join(cwd, 'a'), 'utf8'), 'dirty\n');
    gent('reset', '--hard');
    assert.match(gent('status'), /clean/);
    const push = spawnSync(process.execPath, [cli, 'push'], { cwd, env, encoding: 'utf8' });
    assert.equal(push.status, 1);
    assert.match(push.stderr, /not configured/);
});

test('built-in templates initialize canonical repositories', async t => {
    const cwd = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'gent-template-canonical-')));
    t.after(() => fs.rm(cwd, { recursive: true, force: true }));
    const result = spawnSync(process.execPath, [cli, 'template', 'use', 'node', 'project'], {
        cwd,
        encoding: 'utf8',
    });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.equal((await fs.readFile(path.join(cwd, 'project', '.git'), 'utf8')).trim(), 'gitdir: .gent');
    assert.match(await fs.readFile(path.join(cwd, 'project', '.gent', 'config'), 'utf8'), /objectFormat = sha256/i);
    assert.equal(await fs.readFile(path.join(cwd, 'project', '.gitignore'), 'utf8'), 'node_modules/\n.env\n');
});

test('remote add outside a repository initializes canonical storage', async t => {
    const cwd = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'gent-remote-canonical-')));
    t.after(() => fs.rm(cwd, { recursive: true, force: true }));
    const result = spawnSync(process.execPath, [cli, 'remote', 'add', 'origin', 'http://127.0.0.1:8000/1/project.git'], {
        cwd,
        encoding: 'utf8',
    });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.equal((await fs.readFile(path.join(cwd, '.git'), 'utf8')).trim(), 'gitdir: .gent');
    assert.match(await fs.readFile(path.join(cwd, '.gent', 'config'), 'utf8'), /objectFormat = sha256/i);
});

test('canonical CLI completes the Git-compatible conflict, abort and resolve lifecycle', async t => {
    const cwd = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'gent-cli-merge-')));
    t.after(() => fs.rm(cwd, { recursive: true, force: true }));
    const env = { ...process.env, GIT_AUTHOR_NAME: 'Test', GIT_AUTHOR_EMAIL: 'test@example.com', GIT_COMMITTER_NAME: 'Test', GIT_COMMITTER_EMAIL: 'test@example.com' };
    function run(args, expectedStatus = 0) {
        const result = spawnSync(process.execPath, [cli, ...args], { cwd, env, encoding: 'utf8' });
        assert.equal(result.status, expectedStatus, result.stderr || result.stdout);
        return result;
    }
    const gent = (...args) => run(args).stdout;
    const ref = name => fs.readFile(path.join(cwd, '.gent', 'refs', 'heads', name), 'utf8').then(value => value.trim());

    gent('init', '--object-format=sha256', '-y');
    await fs.writeFile(path.join(cwd, 'shared.txt'), 'shared base\n');
    gent('add', 'shared.txt');
    gent('commit', '-m', 'base commit');
    gent('branch', 'feature');

    await fs.writeFile(path.join(cwd, 'shared.txt'), 'main version\n');
    gent('commit', '-am', 'main edit');
    const mainTip = await ref('main');

    gent('checkout', 'feature');
    await fs.writeFile(path.join(cwd, 'shared.txt'), 'feature version\n');
    gent('commit', '-am', 'feature edit');
    const featureTip = await ref('feature');
    gent('checkout', 'main');

    const conflicted = run(['merge', 'feature'], 1);
    assert.match(conflicted.stdout, /CONFLICT \(content\): Merge conflict in shared\.txt/);
    assert.equal(
        await fs.readFile(path.join(cwd, 'shared.txt'), 'utf8'),
        '<<<<<<< HEAD\nmain version\n=======\nfeature version\n>>>>>>> feature\n'
    );
    assert.match(gent('status'), /conflict: shared\.txt/);
    assert.deepEqual(
        (await GitIndex.read(path.join(cwd, '.gent', 'index'))).getAll('shared.txt').map(entry => String(entry.stage)),
        ['1', '2', '3']
    );
    assert.equal((await fs.readFile(path.join(cwd, '.gent', 'MERGE_HEAD'), 'utf8')).trim(), featureTip);
    assert.match(await fs.readFile(path.join(cwd, '.gent', 'MERGE_MSG'), 'utf8'), /^Merge branch 'feature'/);

    const unresolved = run(['merge', '--continue', '-m', 'must not succeed'], 1);
    assert.match(unresolved.stderr, /shared\.txt/);
    assert.equal(await ref('main'), mainTip);
    assert.match(gent('status'), /conflict: shared\.txt/);

    await fs.writeFile(path.join(cwd, 'shared.txt'), 'edited after conflict\n');
    gent('merge', '--abort');
    assert.equal(await fs.readFile(path.join(cwd, 'shared.txt'), 'utf8'), 'main version\n');
    assert.equal(await ref('main'), mainTip);
    assert.match(gent('status'), /Working tree clean/);

    run(['merge', 'feature'], 1);
    await fs.writeFile(path.join(cwd, 'shared.txt'), 'resolved version\n');
    gent('add', 'shared.txt');
    gent('merge', '--continue', '-m', 'resolve conflict');

    const repo = await repository.open(cwd);
    const commit = await repo.objects.readCommit((await repo.refs.head()).oid);
    assert.deepEqual(commit.parents, [mainTip, featureTip]);
    assert.equal(commit.message.toString().trim(), 'resolve conflict');
    assert.match(gent('status'), /Working tree clean/);
});
