const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { spawn } = require('node:child_process');

const repos = require('../src/commands/repos');
const authStorage = require('../src/utils/auth-storage');

const cli = path.resolve(__dirname, '../src/index.js');

function run(args, options) {
    return new Promise((resolve, reject) => {
        const child = spawn(process.execPath, [cli, ...args], options);
        let stdout = '';
        let stderr = '';
        child.stdout.on('data', chunk => { stdout += chunk; });
        child.stderr.on('data', chunk => { stderr += chunk; });
        child.on('error', reject);
        child.on('close', code => resolve({ code, stdout, stderr }));
    });
}

test('repository-name validation rejects extra words and suggests a slug', () => {
    assert.deepEqual(repos.validateRepositoryName('hello', ['world']), {
        valid: false,
        suggestion: 'hello-world',
        message: "Invalid repository name 'hello world'. Repository names cannot contain spaces or unsupported characters.",
    });
    assert.equal(repos.validateRepositoryName('hello-world').valid, true);
});

test('invalid multi-word create exits before authentication or network access', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gent-repos-invalid-'));
    try {
        const result = await run(['repos', '--create', 'hello', 'world'], {
            cwd: root,
            env: { ...process.env, HOME: root, USERPROFILE: root, NO_COLOR: '1' },
        });
        assert.equal(result.code, 1);
        assert.match(result.stderr, /Invalid repository name 'hello world'/);
        assert.match(result.stdout, /gent repos --create hello-world/);
        assert.equal(fs.existsSync(path.join(root, '.gent')), false);
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});

test('create --yes initializes locally, creates remotely, and links origin', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gent-repos-create-'));
    const worktree = path.join(root, 'worktree');
    const home = path.join(root, 'home');
    fs.mkdirSync(worktree);
    fs.mkdirSync(home);
    const previousHome = process.env.HOME;
    const previousProfile = process.env.USERPROFILE;
    process.env.HOME = home;
    process.env.USERPROFILE = home;
    await authStorage.saveTokens('test-access', 'test-refresh', { email: 'test@example.com' });
    if (previousHome === undefined) delete process.env.HOME; else process.env.HOME = previousHome;
    if (previousProfile === undefined) delete process.env.USERPROFILE; else process.env.USERPROFILE = previousProfile;

    let requestBody = null;
    const server = http.createServer((request, response) => {
        if (request.method !== 'POST' || request.url !== '/api/repos/create/') {
            response.writeHead(404).end();
            return;
        }
        const chunks = [];
        request.on('data', chunk => chunks.push(chunk));
        request.on('end', () => {
            requestBody = JSON.parse(Buffer.concat(chunks).toString('utf8'));
            response.writeHead(201, { 'content-type': 'application/json' });
            response.end(JSON.stringify({ repository: { owner_id: 7, owner_username: 'tester', name: 'hello-world' } }));
        });
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));

    try {
        const address = server.address();
        const result = await run(['repos', '--create', 'hello-world', '--yes'], {
            cwd: worktree,
            env: {
                ...process.env,
                HOME: home,
                USERPROFILE: home,
                GENT_API_URL: `http://127.0.0.1:${address.port}`,
                NO_COLOR: '1',
            },
        });
        assert.equal(result.code, 0, result.stderr || result.stdout);
        assert.equal(requestBody.name, 'hello-world');
        const config = JSON.parse(fs.readFileSync(path.join(worktree, '.gent', 'config.json'), 'utf8'));
        assert.equal(config.remotes.origin.url, '/api/repos/7/hello-world');
        assert.match(result.stdout, /Linked local repository/);
    } finally {
        await new Promise(resolve => server.close(resolve));
        fs.rmSync(root, { recursive: true, force: true });
    }
});
