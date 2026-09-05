const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const CLI = path.resolve(__dirname, '..', 'src', 'index.js');

function run(cwd, args, env) {
    return new Promise((resolve, reject) => {
        const child = spawn(process.execPath, [CLI, ...args], { cwd, env });
        let output = '';
        const timer = setTimeout(() => {
            child.kill('SIGTERM');
            reject(new Error(`gent ${args.join(' ')} timed out\n${output}`));
        }, 15000);

        child.stdout.on('data', chunk => { output += chunk.toString('utf8'); });
        child.stderr.on('data', chunk => { output += chunk.toString('utf8'); });
        child.on('error', error => {
            clearTimeout(timer);
            reject(new Error(`gent ${args.join(' ')} failed\n${error.message}\n${output}`));
        });
        child.on('close', code => {
            clearTimeout(timer);
            if (code !== 0) {
                reject(new Error(`gent ${args.join(' ')} failed with ${code}\n${output}`));
                return;
            }
            resolve(output);
        });
    });
}

function readBody(req) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        req.on('data', chunk => chunks.push(chunk));
        req.on('end', () => {
            try {
                const text = Buffer.concat(chunks).toString('utf8');
                resolve(text ? JSON.parse(text) : {});
            } catch (error) {
                reject(error);
            }
        });
        req.on('error', reject);
    });
}

function createApiServer() {
    const requests = [];
    const server = http.createServer(async (req, res) => {
        try {
            const body = await readBody(req);
            requests.push({
                method: req.method,
                url: req.url,
                authorization: req.headers.authorization || '',
                body
            });

            if (req.method === 'POST' && req.url === '/api/repos/1/merge-test/push/') {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ ok: true }));
                return;
            }

            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ detail: 'not found' }));
        } catch (error) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ detail: error.message }));
        }
    });

    return new Promise((resolve, reject) => {
        server.listen(0, '127.0.0.1', () => resolve({ server, requests }));
        server.on('error', reject);
    });
}

test('init remote add commit push sends main branch to remote API', async t => {
    const { server, requests } = await createApiServer();
    t.after(() => server.close());

    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gent-remote-push-'));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));

    const home = path.join(root, 'home');
    const work = path.join(root, 'work');
    fs.mkdirSync(path.join(home, '.gent'), { recursive: true });
    fs.mkdirSync(work, { recursive: true });

    const originalHome = process.env.HOME;
    const originalUserProfile = process.env.USERPROFILE;
    process.env.HOME = home;
    process.env.USERPROFILE = home;
    const authStorage = require('../src/utils/auth-storage');
    await authStorage.saveTokens('test-access-token', 'test-refresh-token', {
        id: 1,
        email: 'tester@gent.test',
        first_name: 'Integration',
        last_name: 'Tester'
    });
    process.env.HOME = originalHome;
    process.env.USERPROFILE = originalUserProfile;

    const env = {
        ...process.env,
        HOME: home,
        USERPROFILE: home,
        GENT_API_URL: `http://127.0.0.1:${server.address().port}`,
        HTTP_PROXY: '',
        HTTPS_PROXY: '',
        ALL_PROXY: '',
        http_proxy: '',
        https_proxy: '',
        all_proxy: '',
        NO_PROXY: '127.0.0.1,localhost'
    };

    fs.writeFileSync(path.join(work, 'README.md'), 'Initial remote push test\n');
    await run(work, ['init'], env);
    await run(work, ['remote', 'add', 'origin', 'https://gent-api.onrender.com/api/repos/1/merge-test'], env);
    await run(work, ['add', '.'], env);
    await run(work, ['commit', '-m', 'Initial commit'], env);
    const pushOutput = await run(work, ['push', 'origin', 'main'], env);

    assert.match(pushOutput, /Pushed 1 commit\(s\) to origin\/main/);

    const push = requests.find(request => request.url === '/api/repos/1/merge-test/push/');
    assert.ok(push, 'expected a push request');
    assert.equal(push.method, 'POST');
    assert.equal(push.authorization, 'Bearer test-access-token');
    assert.deepEqual(push.body.branch_updates.map(update => update.name), ['main']);
    assert.equal(push.body.pack.commits.length, 1);
    assert.equal(push.body.pack.commits[0].message, 'Initial commit');
    assert.equal(push.body.pack.commits[0].author_email, 'tester@gent.test');
    assert.equal(push.body.pack.blobs.length, 1);
    assert.equal(push.body.pack.trees.length, 1);

    const config = JSON.parse(fs.readFileSync(path.join(work, '.gent', 'config.json'), 'utf8'));
    assert.equal(config.remotes.origin.url, 'https://gent-api.onrender.com/api/repos/1/merge-test');
    assert.equal(config.remoteRefs['origin/main'], push.body.branch_updates[0].commit_sha);
});
