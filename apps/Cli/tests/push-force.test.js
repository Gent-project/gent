const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');

const cli = path.resolve(__dirname, '../src/index.js');
const authStoragePath = path.resolve(__dirname, '../src/utils/auth-storage.js');

function run(cwd, home, args, expected = 0, extraEnv = {}) {
    const result = spawnSync(process.execPath, [cli, ...args], {
        cwd,
        env: { ...process.env, HOME: home, USERPROFILE: home, GENT_NO_PET: '1', ...extraEnv },
        encoding: 'utf8',
    });
    assert.equal(result.status, expected, result.stdout + result.stderr);
    return result;
}

function runAsync(cwd, home, args, extraEnv) {
    return new Promise((resolve, reject) => {
        const child = spawn(process.execPath, [cli, ...args], {
            cwd,
            env: { ...process.env, HOME: home, USERPROFILE: home, GENT_NO_PET: '1', ...extraEnv },
        });
        let output = '';
        child.stdout.on('data', chunk => { output += chunk; });
        child.stderr.on('data', chunk => { output += chunk; });
        child.on('error', reject);
        child.on('close', code => resolve({ code, output }));
    });
}

test('force push updates a rewound remote branch even with zero new commits', async t => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gent-force-push-'));
    const home = path.join(root, 'home');
    const cwd = path.join(root, 'repo');
    fs.mkdirSync(home, { recursive: true });
    fs.mkdirSync(cwd, { recursive: true });
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));

    const auth = spawnSync(process.execPath, ['-e', `require(${JSON.stringify(authStoragePath)}).saveTokens('access', 'refresh', {email: 'push@example.test'})`], {
        env: { ...process.env, HOME: home, USERPROFILE: home },
        encoding: 'utf8',
    });
    assert.equal(auth.status, 0, auth.stderr);

    run(cwd, home, ['init', '-y']);
    const configPath = path.join(cwd, '.gent', 'config.json');
    const commitsPath = path.join(cwd, '.gent', 'commits.json');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    config.user = { name: 'Push Tester', email: 'push@example.test' };
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

    fs.writeFileSync(path.join(cwd, 'file.txt'), 'first\n');
    run(cwd, home, ['add', 'file.txt']);
    run(cwd, home, ['commit', '-m', 'first']);
    const first = JSON.parse(fs.readFileSync(commitsPath, 'utf8')).branches.main;
    fs.writeFileSync(path.join(cwd, 'file.txt'), 'second\n');
    run(cwd, home, ['add', 'file.txt']);
    run(cwd, home, ['commit', '-m', 'second']);
    const second = JSON.parse(fs.readFileSync(commitsPath, 'utf8')).branches.main;

    let received = null;
    const server = http.createServer((request, response) => {
        const chunks = [];
        request.on('data', chunk => chunks.push(chunk));
        request.on('end', () => {
            received = JSON.parse(Buffer.concat(chunks).toString('utf8'));
            response.writeHead(201, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ message: 'Push successful', branches_updated: 1 }));
        });
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    t.after(() => server.close());
    const baseUrl = `http://127.0.0.1:${server.address().port}`;

    const linked = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    linked.remotes = { origin: { url: `${baseUrl}/api/repos/1/public-repo` } };
    linked.remoteRefs = { 'origin/main': second };
    fs.writeFileSync(configPath, JSON.stringify(linked, null, 2));

    run(cwd, home, ['reset', '--hard', first]);
    const rejected = run(cwd, home, ['push', 'origin', 'main'], 1, { GENT_API_URL: baseUrl });
    assert.match(rejected.stdout + rejected.stderr, /non-fast-forward/);
    assert.equal(received, null);

    const pushed = await runAsync(cwd, home, ['push', '--force', 'origin', 'main'], { GENT_API_URL: baseUrl });
    assert.equal(pushed.code, 0, pushed.output);
    assert.match(pushed.output, /Force-updated origin\/main/);
    assert.deepEqual(received.pack, { commits: [], trees: [], blobs: [] });
    assert.deepEqual(received.branch_updates, [{ name: 'main', commit_sha: first }]);
    assert.equal(received.force, true);

    const updated = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    assert.equal(updated.remoteRefs['origin/main'], first);
});
