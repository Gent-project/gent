#!/usr/bin/env node

const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');

const CLI = path.resolve(__dirname, '..', 'src', 'index.js');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gent-ai-merge-'));
const home = path.join(root, 'home');
const work = path.join(root, 'repo');
fs.mkdirSync(home, { recursive: true });
fs.mkdirSync(work, { recursive: true });

function runIn(cwd, args, expected = 0, extraEnv = {}) {
    const result = spawnSync('node', [CLI, ...args], {
        cwd,
        env: { ...process.env, HOME: home, USERPROFILE: home, ...extraEnv },
        encoding: 'utf8',
    });
    assert.equal(result.status, expected, result.stdout + result.stderr);
    return result.stdout + result.stderr;
}

function run(args, expected = 0, extraEnv = {}) {
    return runIn(work, args, expected, extraEnv);
}

function runAsync(cwd, args, extraEnv) {
    return new Promise((resolve, reject) => {
        const child = spawn('node', [CLI, ...args], {
            cwd,
            env: { ...process.env, HOME: home, USERPROFILE: home, ...extraEnv },
        });
        let output = '';
        child.stdout.on('data', chunk => { output += chunk; });
        child.stderr.on('data', chunk => { output += chunk; });
        child.on('error', reject);
        child.on('close', code => resolve({ code, output }));
    });
}

function write(lines) {
    fs.writeFileSync(path.join(work, 'app.txt'), lines.join('\n'));
}

run(['init', '-y']);
const configPath = path.join(work, '.gent', 'config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
config.user = { name: 'AI Test', email: 'ai@example.test' };
fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

write(['alpha', 'base']);
run(['add', 'app.txt']);
run(['commit', '-m', 'base']);
run(['checkout', '-b', 'feature']);
write(['alpha', 'feature']);
run(['add', 'app.txt']);
run(['commit', '-m', 'feature']);
run(['checkout', 'main']);
write(['alpha', 'main']);
run(['add', 'app.txt']);
run(['commit', '-m', 'main']);

const server = http.createServer((request, response) => {
    let body = '';
    request.on('data', chunk => { body += chunk; });
    request.on('end', () => {
        const payload = JSON.parse(body);
        const text = /Resolve this merge conflict/.test(payload.instructions)
            ? (/BASE:\nalpha\nbase/.test(payload.input) ? 'alpha\nmain\nfeature' : 'main\nfeature')
            : 'No blocking issues.';
        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({
            output: [{ type: 'message', content: [{ type: 'output_text', text }] }],
        }));
    });
});

server.listen(0, '127.0.0.1', async () => {
    try {
        const address = server.address();
        const aiEnv = {
            OPENAI_API_KEY: 'test-key',
            GENT_AI_API_URL: `http://127.0.0.1:${address.port}/v1/responses`,
            GENT_NO_PET: '1',
        };
        const result = await runAsync(work, ['merge', 'feature', '--ai'], aiEnv);
        assert.equal(result.code, 0, result.output);
        assert.match(result.output, /Merge committed/);
        assert.match(result.output, /AI review of the completed merge/);
        assert.match(result.output, /No blocking issues/);
        assert.equal(fs.readFileSync(path.join(work, 'app.txt'), 'utf8'), 'alpha\nmain\nfeature');

        const repository = JSON.parse(fs.readFileSync(path.join(work, '.gent', 'commits.json'), 'utf8'));
        const head = repository.commits.find(commit => commit.hash === repository.branches.main);
        assert.ok(head.mergeParent, 'AI resolution must create a real two-parent merge commit');

        const canonical = path.join(root, 'canonical');
        fs.mkdirSync(canonical, { recursive: true });
        runIn(canonical, ['init', '--object-format', 'sha256']);
        runIn(canonical, ['config', 'set', 'user.name', 'AI Test']);
        runIn(canonical, ['config', 'set', 'user.email', 'ai@example.test']);
        fs.writeFileSync(path.join(canonical, 'app.txt'), 'alpha\nbase');
        runIn(canonical, ['add', 'app.txt']);
        runIn(canonical, ['commit', '-m', 'base']);
        runIn(canonical, ['branch', 'feature']);
        runIn(canonical, ['checkout', 'feature']);
        fs.writeFileSync(path.join(canonical, 'app.txt'), 'alpha\nfeature');
        runIn(canonical, ['add', 'app.txt']);
        runIn(canonical, ['commit', '-m', 'feature']);
        runIn(canonical, ['checkout', 'main']);
        fs.writeFileSync(path.join(canonical, 'app.txt'), 'alpha\nmain');
        runIn(canonical, ['add', 'app.txt']);
        runIn(canonical, ['commit', '-m', 'main']);

        const canonicalResult = await runAsync(canonical, ['merge', 'feature', '--ai'], aiEnv);
        assert.equal(canonicalResult.code, 0, canonicalResult.output);
        assert.match(canonicalResult.output, /Merge committed/);
        assert.match(canonicalResult.output, /AI review of the completed merge/);
        assert.equal(fs.readFileSync(path.join(canonical, 'app.txt'), 'utf8'), 'alpha\nmain\nfeature');
        const fsck = spawnSync('git', ['fsck', '--strict'], { cwd: canonical, encoding: 'utf8' });
        assert.equal(fsck.status, 0, fsck.stdout + fsck.stderr);

        console.log('AI merge e2e: legacy and canonical merges resolved, committed, and reviewed');
    } finally {
        server.close();
    }
});
