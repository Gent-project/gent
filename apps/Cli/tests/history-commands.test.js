const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');

const cli = path.resolve(__dirname, '../src/index.js');
const identityEnv = {
    ...process.env,
    GIT_AUTHOR_NAME: 'History Tester',
    GIT_AUTHOR_EMAIL: 'history@gent.test',
    GIT_COMMITTER_NAME: 'History Tester',
    GIT_COMMITTER_EMAIL: 'history@gent.test',
};

function run(cwd, args, expectedStatus = 0, env = identityEnv) {
    const result = spawnSync(process.execPath, [cli, ...args], { cwd, env, encoding: 'utf8' });
    assert.equal(result.status, expectedStatus, result.stderr || result.stdout);
    return result;
}

async function setLegacyIdentity(cwd) {
    const configPath = path.join(cwd, '.gent', 'config.json');
    const config = JSON.parse(await fs.readFile(configPath, 'utf8'));
    config.user = { name: 'History Tester', email: 'history@gent.test' };
    await fs.writeFile(configPath, JSON.stringify(config, null, 2));
}

test('help lists and documents blame, revert, and reset', () => {
    const cwd = path.resolve(__dirname, '..');
    const help = run(cwd, ['--help']).stdout;
    assert.match(help, /^  blame\s+Show the commit and author responsible for each line$/m);
    assert.match(help, /^  revert\s+Create a new commit that reverses an earlier commit$/m);
    assert.match(help, /^  reset\s+Unstage files or reset HEAD to a commit$/m);

    assert.match(run(cwd, ['help', 'blame']).stdout, /gent blame \[options\] <file> \[revision\]/);
    const revertHelp = run(cwd, ['help', 'revert']).stdout;
    assert.match(revertHelp, /gent revert \[options\] <commit>/);
    assert.match(revertHelp, /--mainline <parent>/);
    assert.match(revertHelp, /--no-commit/);
    const resetHelp = run(cwd, ['help', 'reset']).stdout;
    assert.match(resetHelp, /--hard \[hash\]/);
    assert.match(resetHelp, /--soft \[hash\]/);
});

test('legacy CLI supports blame, revert, and reset --hard <hash>', async t => {
    const cwd = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'gent-history-legacy-')));
    t.after(() => fs.rm(cwd, { recursive: true, force: true }));
    run(cwd, ['init', '-y']);
    await setLegacyIdentity(cwd);

    await fs.writeFile(path.join(cwd, 'story.txt'), 'one\ntwo\n');
    run(cwd, ['add', 'story.txt']);
    run(cwd, ['commit', '-m', 'first']);
    let repository = JSON.parse(await fs.readFile(path.join(cwd, '.gent', 'commits.json'), 'utf8'));
    const first = repository.branches.main;

    await fs.writeFile(path.join(cwd, 'story.txt'), 'one\nTWO\nthree\n');
    run(cwd, ['add', 'story.txt']);
    run(cwd, ['commit', '-m', 'second']);
    repository = JSON.parse(await fs.readFile(path.join(cwd, '.gent', 'commits.json'), 'utf8'));
    const second = repository.branches.main;

    const blame = run(cwd, ['blame', 'story.txt']).stdout;
    assert.match(blame, new RegExp(`^${first.slice(0, 12)} .* one$`, 'm'));
    assert.match(blame, new RegExp(`^${second.slice(0, 12)} .* TWO$`, 'm'));
    assert.match(blame, new RegExp(`^${second.slice(0, 12)} .* three$`, 'm'));

    await fs.writeFile(path.join(cwd, 'other.txt'), 'unrelated\n');
    run(cwd, ['add', 'other.txt']);
    run(cwd, ['commit', '-m', 'unrelated later edit']);
    run(cwd, ['revert', second]);
    assert.equal(await fs.readFile(path.join(cwd, 'story.txt'), 'utf8'), 'one\ntwo\n');
    assert.equal(await fs.readFile(path.join(cwd, 'other.txt'), 'utf8'), 'unrelated\n');
    repository = JSON.parse(await fs.readFile(path.join(cwd, '.gent', 'commits.json'), 'utf8'));
    assert.match(repository.commits.find(commit => commit.hash === repository.branches.main).message, /^Revert "second"/);

    await fs.writeFile(path.join(cwd, 'extra.txt'), 'tracked later\n');
    run(cwd, ['add', 'extra.txt']);
    run(cwd, ['commit', '-m', 'extra']);
    run(cwd, ['reset', '--hard', second]);
    repository = JSON.parse(await fs.readFile(path.join(cwd, '.gent', 'commits.json'), 'utf8'));
    assert.equal(repository.branches.main, second);
    assert.equal(await fs.readFile(path.join(cwd, 'story.txt'), 'utf8'), 'one\nTWO\nthree\n');
    await assert.rejects(fs.access(path.join(cwd, 'extra.txt')));
    await assert.rejects(fs.access(path.join(cwd, 'other.txt')));
});

test('canonical CLI history commands remain valid Git SHA-256 operations', async t => {
    const cwd = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'gent-history-canonical-')));
    t.after(() => fs.rm(cwd, { recursive: true, force: true }));
    run(cwd, ['init', '--object-format=sha256', '-y']);

    await fs.writeFile(path.join(cwd, 'story.txt'), 'one\ntwo\n');
    run(cwd, ['add', 'story.txt']);
    run(cwd, ['commit', '-m', 'first']);
    const first = (await fs.readFile(path.join(cwd, '.gent', 'refs', 'heads', 'main'), 'utf8')).trim();

    await fs.writeFile(path.join(cwd, 'story.txt'), 'one\nTWO\nthree\n');
    run(cwd, ['commit', '-am', 'second']);
    const second = (await fs.readFile(path.join(cwd, '.gent', 'refs', 'heads', 'main'), 'utf8')).trim();
    const blame = run(cwd, ['blame', 'story.txt']).stdout;
    assert.match(blame, new RegExp(`^${first.slice(0, 12)} .* one$`, 'm'));
    assert.match(blame, new RegExp(`^${second.slice(0, 12)} .* TWO$`, 'm'));

    await fs.writeFile(path.join(cwd, 'other.txt'), 'unrelated\n');
    run(cwd, ['add', 'other.txt']);
    run(cwd, ['commit', '-m', 'unrelated later edit']);
    run(cwd, ['revert', second]);
    assert.equal(await fs.readFile(path.join(cwd, 'story.txt'), 'utf8'), 'one\ntwo\n');
    assert.equal(await fs.readFile(path.join(cwd, 'other.txt'), 'utf8'), 'unrelated\n');
    run(cwd, ['reset', '--hard', second]);
    assert.equal(await fs.readFile(path.join(cwd, 'story.txt'), 'utf8'), 'one\nTWO\nthree\n');
    await assert.rejects(fs.access(path.join(cwd, 'other.txt')));

    const git = spawnSync('git', ['--git-dir=.gent', '--work-tree=.', 'fsck', '--full', '--strict'], {
        cwd, env: identityEnv, encoding: 'utf8'
    });
    assert.equal(git.status, 0, git.stderr || git.stdout);
});
