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

test('imports SHA-1 branches, annotated tags and provenance into SHA-256 Gent objects', async t => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'gent-import-test-'));
    t.after(() => fs.rm(root, { recursive: true, force: true }));
    const source = path.join(root, 'source');
    const destination = path.join(root, 'destination');
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

    await importRepository(source, destination);

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
});
