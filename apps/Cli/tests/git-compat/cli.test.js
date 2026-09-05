const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
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
    gent('init', '--object-format=sha256', '-y');
    await fs.writeFile(path.join(cwd, 'a'), 'base\n');
    gent('add', 'a'); gent('commit', '-m', 'base');
    assert.match(gent('log', '--oneline'), /base/);
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
