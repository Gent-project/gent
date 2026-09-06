const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { importRepository } = require('../../src/commands/import');

function git(directory, args) {
    const result = spawnSync('git', ['-C', directory, ...args], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout;
}

test('imports the default branch by default and all refs only with --all', async t => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'gent-import-test-'));
    t.after(() => fs.rm(root, { recursive: true, force: true }));
    const source = path.join(root, 'source');
    const destination = path.join(root, 'all');
    git(root, ['init', '--initial-branch=main', 'source']);
    git(source, ['config', 'user.name', 'Import Test']);
    git(source, ['config', 'user.email', 'import@example.com']);
    await fs.writeFile(path.join(source, 'readme.txt'), 'first\n');
    git(source, ['add', 'readme.txt']);
    git(source, ['commit', '-m', 'first']);
    const first = git(source, ['rev-parse', 'HEAD']).trim();
    git(source, ['checkout', '-b', 'feature']);
    await fs.writeFile(path.join(source, 'feature.txt'), 'feature\n');
    git(source, ['add', 'feature.txt']);
    git(source, ['commit', '-m', 'feature']);
    git(source, ['tag', '-a', 'v1', '-m', 'release']);
    git(source, ['checkout', 'main']);
    await fs.appendFile(path.join(source, 'readme.txt'), 'second\n');
    git(source, ['commit', '-am', 'second']);

    await importRepository(source, destination, { all: true });

    assert.equal(git(destination, ['rev-parse', '--show-object-format']).trim(), 'sha256');
    git(destination, ['fsck', '--full', '--strict']);
    assert.equal(await fs.readFile(path.join(destination, 'readme.txt'), 'utf8'), 'first\nsecond\n');
    assert.equal(git(destination, ['show', 'feature:feature.txt']), 'feature\n');
    const importedCommits = git(destination, ['rev-list', '--all']).trim().split('\n');
    const importedPayloads = importedCommits.map(oid => git(destination, ['cat-file', '-p', oid])).join('\n');
    assert.match(importedPayloads, /gent-source-sha1 /);
    assert.match(importedPayloads, new RegExp(first));
    assert.match(git(destination, ['cat-file', '-p', 'v1']), /release/);
    assert.match(git(destination, ['log', '--all', '--format=raw']), new RegExp(first));

    const defaultDestination = path.join(root, 'default');
    const defaultResult = await importRepository(source, defaultDestination);
    assert.equal(defaultResult.refs, 1);
    assert.equal(git(defaultDestination, ['for-each-ref', '--format=%(refname)']), 'refs/heads/main\n');
    assert.equal(await fs.readFile(path.join(defaultDestination, 'readme.txt'), 'utf8'), 'first\nsecond\n');

    const branchDestination = path.join(root, 'branch');
    await importRepository(source, branchDestination, { branch: 'feature' });
    assert.equal(git(branchDestination, ['branch', '--show-current']).trim(), 'feature');
    assert.equal(git(branchDestination, ['for-each-ref', '--format=%(refname)']), 'refs/heads/feature\n');
    assert.equal(await fs.readFile(path.join(branchDestination, 'feature.txt'), 'utf8'), 'feature\n');
});

test('imports available gitlink commits and checks out nested .gent content', async t => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'gent-import-gitlink-'));
    t.after(() => fs.rm(root, { recursive: true, force: true }));
    const source = path.join(root, 'source');
    const destination = path.join(root, 'destination');
    git(root, ['init', '--initial-branch=main', 'source']);
    git(source, ['config', 'user.name', 'Import Test']);
    git(source, ['config', 'user.email', 'import@example.com']);
    await fs.writeFile(path.join(source, 'readme.txt'), 'base\n');
    git(source, ['add', 'readme.txt']);
    git(source, ['commit', '-m', 'base']);
    const linkedCommit = git(source, ['rev-parse', 'HEAD']).trim();
    git(source, ['update-index', '--add', '--cacheinfo', `160000,${linkedCommit},.worktrees/frontend`]);
    git(source, ['commit', '-m', 'record linked worktree']);
    git(source, ['branch', 'linked']);
    git(source, ['update-index', '--force-remove', '.worktrees/frontend']);
    await fs.mkdir(path.join(source, 'nested', '.gent'), { recursive: true });
    await fs.writeFile(path.join(source, 'nested', '.gent', 'HEAD'), 'tracked content\n');
    git(source, ['add', 'nested/.gent/HEAD']);
    git(source, ['commit', '-m', 'replace link and add nested metadata']);

    await importRepository(source, destination, { all: true });

    git(destination, ['fsck', '--full', '--strict']);
    assert.equal(await fs.readFile(path.join(destination, 'nested', '.gent', 'HEAD'), 'utf8'), 'tracked content\n');
    const link = git(destination, ['ls-tree', 'linked', '.worktrees/frontend']).trim();
    assert.match(link, /^160000 commit [0-9a-f]{64}\t\.worktrees\/frontend$/);
    const importedTarget = link.split(/\s+/)[2];
    assert.equal(git(destination, ['cat-file', '-t', importedTarget]).trim(), 'commit');
});

test('failed checkout removes the transactional destination', async t => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'gent-import-cleanup-'));
    t.after(() => fs.rm(root, { recursive: true, force: true }));
    const source = path.join(root, 'source');
    const destination = path.join(root, 'destination');
    git(root, ['init', '--initial-branch=main', 'source']);
    git(source, ['config', 'user.name', 'Import Test']);
    git(source, ['config', 'user.email', 'import@example.com']);
    await fs.mkdir(path.join(source, '.gent'), { recursive: true });
    await fs.writeFile(path.join(source, '.gent', 'HEAD'), 'unsafe at repository root\n');
    git(source, ['add', '.gent/HEAD']);
    git(source, ['commit', '-m', 'track root metadata']);

    await assert.rejects(importRepository(source, destination), /'.gent' is repository metadata/);
    await assert.rejects(fs.access(destination), { code: 'ENOENT' });
    assert.deepEqual((await fs.readdir(root)).sort(), ['source']);
});

test('unavailable submodule commits report the complete path and leave no destination', async t => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'gent-import-submodule-'));
    t.after(() => fs.rm(root, { recursive: true, force: true }));
    const source = path.join(root, 'source');
    const destination = path.join(root, 'destination');
    git(root, ['init', '--initial-branch=main', 'source']);
    git(source, ['config', 'user.name', 'Import Test']);
    git(source, ['config', 'user.email', 'import@example.com']);
    git(source, ['update-index', '--add', '--cacheinfo', `160000,${'1'.repeat(40)},vendor/submodule`]);
    git(source, ['commit', '-m', 'external submodule']);

    await assert.rejects(importRepository(source, destination), /gitlink at 'vendor\/submodule' points to unavailable commit/);
    await assert.rejects(fs.access(destination), { code: 'ENOENT' });

    const droppedDestination = path.join(root, 'dropped');
    const result = await importRepository(source, droppedDestination, { dropUnavailableGitlinks: true });
    assert.deepEqual(result.droppedGitlinks, [`vendor/submodule ${'1'.repeat(40)}`]);
    assert.equal(git(droppedDestination, ['ls-tree', '-r', 'main']), '');
    git(droppedDestination, ['fsck', '--full', '--strict']);
});
