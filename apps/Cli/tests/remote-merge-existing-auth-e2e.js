#!/usr/bin/env node

/**
 * Live merge/checkout compatibility test using the currently authenticated
 * Gent account. The test copies auth into an isolated HOME, creates one unique
 * public repository, and leaves it available for website inspection.
 *
 * Run explicitly with:
 *   GENT_LIVE_E2E=1 node tests/remote-merge-existing-auth-e2e.js
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

if (process.env.GENT_LIVE_E2E !== '1') {
    console.error('Refusing to create a live repository without GENT_LIVE_E2E=1');
    process.exit(2);
}

const CLI = path.resolve(__dirname, '..', 'src', 'index.js');
const runId = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
const repoName = `exam_merge_e2e_${runId}`;
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gent-live-merge-'));
const home = path.join(root, 'home');
const source = path.join(root, 'source');
const clone = path.join(root, 'clone');
const authSource = path.join(os.homedir(), '.gent', 'auth.json');
const authTarget = path.join(home, '.gent', 'auth.json');

assert.ok(fs.existsSync(authSource), 'Log in with gent before running this test');
fs.mkdirSync(path.dirname(authTarget), { recursive: true });
fs.copyFileSync(authSource, authTarget);
fs.mkdirSync(source, { recursive: true });

const env = { ...process.env, HOME: home, USERPROFILE: home, NO_COLOR: '1' };
delete env.GENT_API_BASE_URL;

function run(cwd, args, expectedStatus = 0) {
    const result = spawnSync(process.execPath, [CLI, ...args], {
        cwd,
        env,
        encoding: 'utf8',
        timeout: 120000,
    });
    const output = `${result.stdout || ''}${result.stderr || ''}`;
    if (result.error) throw result.error;
    assert.equal(result.status, expectedStatus, `gent ${args.join(' ')}\n${output}`);
    return output;
}

function write(dir, name, content) {
    const destination = path.join(dir, name);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, content);
}

console.log(`[live] creating ${repoName}`);
const created = run(source, ['repos', '--create', repoName, '--description', 'Gent checkout and merge live E2E']);
const remoteMatch = created.match(/\/api\/repos\/(\d+)\/([A-Za-z0-9_-]+)/);
assert.ok(remoteMatch, created);
const ownerId = remoteMatch[1];
const remoteUrl = `/api/repos/${ownerId}/${repoName}`;

run(source, ['init', '-y', '--object-format', 'legacy']);
run(source, ['remote', 'add', 'origin', remoteUrl]);
write(source, 'test.json', '{"version":"base"}\n');
run(source, ['add', 'test.json']);
run(source, ['commit', '-m', 'base']);
run(source, ['push', 'origin', 'main']);

run(source, ['checkout', '-b', 'feature']);
write(source, 'test.json', '{"version":"feature"}\n');
run(source, ['add', 'test.json']);
run(source, ['commit', '-m', 'feature changes test json']);
run(source, ['push', 'origin', 'feature']);

run(source, ['checkout', 'main']);
assert.equal(fs.readFileSync(path.join(source, 'test.json'), 'utf8'), '{"version":"base"}\n');
write(source, 'main.txt', 'main branch only\n');
run(source, ['add', 'main.txt']);
run(source, ['commit', '-m', 'main adds separate file']);
run(source, ['push', 'origin', 'main']);

const mergeOutput = run(source, ['merge', 'feature']);
assert.match(mergeOutput, /Merged 'feature' into 'main'/);
const repository = JSON.parse(fs.readFileSync(path.join(source, '.gent', 'commits.json'), 'utf8'));
const mergeHash = repository.branches.main;
const mergeCommit = repository.commits.find(commit => commit.hash === mergeHash);
assert.ok(mergeCommit?.parent && mergeCommit?.mergeParent, 'merge commit must have two parents');
assert.equal(fs.readFileSync(path.join(source, 'test.json'), 'utf8'), '{"version":"feature"}\n');

run(source, ['push', 'origin', 'main']);
assert.match(run(source, ['merge', 'feature']), /Already up to date/);
assert.equal(
    JSON.parse(fs.readFileSync(path.join(source, '.gent', 'commits.json'), 'utf8')).branches.main,
    mergeHash,
    'ancestor merge must not create a second merge commit'
);

run(root, ['clone', remoteUrl, clone]);
assert.equal(fs.readFileSync(path.join(clone, 'test.json'), 'utf8'), '{"version":"feature"}\n');
assert.equal(fs.readFileSync(path.join(clone, 'main.txt'), 'utf8'), 'main branch only\n');

write(source, 'pulled.txt', 'remote pull proof\n');
run(source, ['add', 'pulled.txt']);
run(source, ['commit', '-m', 'pull verification']);
run(source, ['push', 'origin', 'main']);
assert.match(run(clone, ['pull', 'origin', 'main']), /Fast-forward/);
assert.equal(fs.readFileSync(path.join(clone, 'pulled.txt'), 'utf8'), 'remote pull proof\n');

process.env.HOME = home;
process.env.USERPROFILE = home;
const api = require('../src/utils/api-client');

(async () => {
    const branches = await api.get(`${remoteUrl}/branches/`);
    const commits = await api.get(`${remoteUrl}/commits/`);
    const diff = await api.get(`${remoteUrl}/commits/${mergeHash}/diff/`);
    const main = branches.find(branch => branch.name === 'main');
    const feature = branches.find(branch => branch.name === 'feature');
    assert.ok(main && feature, 'website API must expose main and feature');
    assert.ok(commits.some(commit => commit.sha === mergeHash || commit.hash === mergeHash));
    assert.ok((diff.files || []).some(file => (file.path || file.file_path) === 'test.json'));
    assert.ok((diff.total_additions || diff.additions || 0) > 0 || (diff.total_deletions || diff.deletions || 0) > 0);

    fs.rmSync(home, { recursive: true, force: true });
    console.log('[live] PASS checkout, branches, merge, push, clone, pull, API history and merge diff');
    console.log(`[live] repository: ${remoteUrl}`);
    console.log(`[live] merge commit: ${mergeHash}`);
    console.log(`[live] temp worktree: ${root} (authentication copy removed)`);
})().catch(error => {
    fs.rmSync(home, { recursive: true, force: true });
    console.error('[live] FAIL');
    console.error(error.stack || error.message);
    console.error(`[live] repository may exist: ${remoteUrl}`);
    console.error(`[live] temp worktree: ${root} (authentication copy removed)`);
    process.exit(1);
});
