const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const repository = require('../../src/utils/repository');
const ops = require('../../src/utils/gent-ops');
const authStorage = require('../../src/utils/auth-storage');
const transport = require('../../src/utils/smart-http');
const gitObjects = require('../../src/utils/git-objects');
const { buildPack } = require('../../src/utils/packfile');

const ZERO = '0'.repeat(64);

async function fixture(t) {
    const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'gent-transport-')));
    t.after(() => fs.rm(root, { recursive: true, force: true }));
    const { repo } = await repository.init(root);
    repo.identity = async () => ({ name: 'Test', email: 'test@example.com', timestamp: 1700000000, timezone: '+0000' });
    await fs.writeFile(path.join(root, 'file'), 'content\n');
    await ops.addPaths(repo, [path.join(root, 'file')]);
    await ops.createCommit(repo, { message: 'base' });
    return repo;
}

async function server(t, handler) {
    const instance = http.createServer(handler);
    await new Promise(resolve => instance.listen(0, '127.0.0.1', resolve));
    t.after(() => new Promise(resolve => instance.close(resolve)));
    return `http://127.0.0.1:${instance.address().port}`;
}

function advertisement(service, refs, caps = 'report-status object-format=sha256') {
    const rows = [transport.pkt(`# service=${service}\n`), Buffer.from('0000')];
    if (!refs.length) refs = [[ZERO, 'capabilities^{}']];
    refs.forEach(([oid, ref], index) => rows.push(transport.pkt(`${oid} ${ref}${index ? '' : `\0${caps}`}\n`)));
    rows.push(Buffer.from('0000'));
    return Buffer.concat(rows);
}

function configure(repo, url, names = ['origin']) {
    for (const name of names) {
        repo.localConfig.set(`remote.${name}.url`, url);
        repo.localConfig.set(`remote.${name}.fetch`, `+refs/heads/*:refs/remotes/${name}/*`);
    }
}

test('clone removes its destination when a remote branch contains nested Gent metadata', async t => {
    const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'gent-bad-clone-')));
    t.after(() => fs.rm(root, { recursive: true, force: true }));
    const items = [];
    const add = (type, payload) => {
        const item = { type, payload, oid: gitObjects.hashObject(type, payload) };
        items.push(item);
        return item.oid;
    };
    const blob = add('blob', Buffer.from('metadata\n'));
    const metadata = add('tree', gitObjects.serializeTree([
        { mode: gitObjects.MODE.REGULAR, name: 'HEAD', oid: blob },
    ]));
    const cli = add('tree', gitObjects.serializeTree([
        { mode: gitObjects.MODE.TREE, name: '.gent', oid: metadata },
    ]));
    const tree = add('tree', gitObjects.serializeTree([
        { mode: gitObjects.MODE.TREE, name: 'apps', oid: cli },
    ]));
    const identity = { name: 'Test', email: 'test@example.com', timestamp: 1700000000, timezone: '+0000' };
    const commit = add('commit', gitObjects.serializeCommit({
        tree, author: identity, committer: identity, message: 'bad metadata\n',
    }));
    const pack = buildPack(items).pack;
    const url = await server(t, (req, res) => {
        if (req.url.includes('info/refs')) {
            const data = advertisement('git-upload-pack', [[commit, 'refs/heads/main']],
                'object-format=sha256 symref=HEAD:refs/heads/main');
            res.writeHead(200, { 'content-type': 'application/x-git-upload-pack-advertisement' });
            return res.end(data);
        }
        req.resume();
        req.on('end', () => {
            res.writeHead(200, { 'content-type': 'application/x-git-upload-pack-result' });
            res.end(Buffer.concat([transport.pkt('NAK\n'), pack]));
        });
    });
    const destination = path.join(root, 'clone');
    await assert.rejects(transport.clone(`${url}/owner/repo.git`, destination),
        /remote branch contains a reserved metadata path/);
    await assert.rejects(fs.access(destination), error => error.code === 'ENOENT');
});

test('confirmed and up-to-date pushes update tracking and set upstream; rejection does not', async t => {
    const repo = await fixture(t);
    const oid = (await repo.refs.head()).oid;
    let advertised = oid;
    let reject = false;
    const url = await server(t, (req, res) => {
        if (req.url.includes('info/refs')) {
            const data = advertisement('git-receive-pack', advertised === ZERO ? [] : [[advertised, 'refs/heads/main']]);
            res.writeHead(200, { 'content-type': 'application/x-git-receive-pack-advertisement' });
            return res.end(data);
        }
        req.resume();
        req.on('end', () => {
            const status = Buffer.concat([
                transport.pkt('unpack ok\n'),
                transport.pkt(`${reject ? 'ng refs/heads/main denied' : 'ok refs/heads/main'}\n`),
                Buffer.from('0000')
            ]);
            res.writeHead(200, { 'content-type': 'application/x-git-receive-pack-result' });
            res.end(status);
        });
    });
    configure(repo, url);
    await transport.push(repo, 'origin', 'main', { setUpstream: true });
    assert.equal(await repo.refs.resolveToOid('refs/remotes/origin/main'), oid);
    assert.equal(repo.config.get('branch.main.remote'), 'origin');
    assert.equal(repo.config.get('branch.main.merge'), 'refs/heads/main');

    await repo.refs.delete('refs/remotes/origin/main', { expectedOldOid: oid });
    advertised = ZERO;
    reject = true;
    await assert.rejects(transport.push(repo, 'origin', 'main'), /push rejected/);
    assert.equal(await repo.refs.resolveToOid('refs/remotes/origin/main'), null);
});

test('remote deletion checks report-status and updates only branch tracking state', async t => {
    const repo = await fixture(t);
    const oid = (await repo.refs.head()).oid;
    let command = '';
    const url = await server(t, (req, res) => {
        if (req.url.includes('info/refs')) {
            const data = advertisement('git-receive-pack', [[oid, 'refs/heads/main']]);
            res.writeHead(200, { 'content-type': 'application/x-git-receive-pack-advertisement' });
            return res.end(data);
        }
        const chunks = [];
        req.on('data', chunk => chunks.push(chunk));
        req.on('end', () => {
            command = Buffer.concat(chunks).toString('utf8');
            const data = Buffer.concat([transport.pkt('unpack ok\n'), transport.pkt('ok refs/heads/main\n'), Buffer.from('0000')]);
            res.writeHead(200, { 'content-type': 'application/x-git-receive-pack-result' });
            res.end(data);
        });
    });
    configure(repo, url);
    await repo.refs.update('refs/remotes/origin/main', oid, { expectedOldOid: null });
    await transport.deleteRemoteRef(repo, 'origin', 'refs/heads/main');
    assert.match(command, new RegExp(`${oid} ${ZERO} refs/heads/main`));
    assert.equal(await repo.refs.resolveToOid('refs/remotes/origin/main'), null);
    assert.equal(await repo.refs.resolveToOid('refs/heads/main'), oid);
});

test('push rejects branch/tag shorthand ambiguity before writing', async t => {
    const repo = await fixture(t);
    const oid = (await repo.refs.head()).oid;
    let writes = 0;
    const url = await server(t, (req, res) => {
        if (!req.url.includes('info/refs')) writes++;
        const data = advertisement('git-receive-pack', [[oid, 'refs/heads/main']]);
        res.writeHead(200, { 'content-type': 'application/x-git-receive-pack-advertisement' });
        res.end(data);
    });
    configure(repo, url);
    await repo.refs.update('refs/tags/main', oid, { expectedOldOid: null });
    await assert.rejects(transport.push(repo, 'origin', 'main'), /ambiguous ref/);
    assert.equal(writes, 0);
});

test('fetch prune runs only after successful advertisement and fetch-all names failures', async t => {
    const repo = await fixture(t);
    const oid = (await repo.refs.head()).oid;
    let fail = true;
    const url = await server(t, (req, res) => {
        if (fail) { res.writeHead(500); return res.end('no'); }
        const data = advertisement('git-upload-pack', [], 'object-format=sha256');
        res.writeHead(200, { 'content-type': 'application/x-git-upload-pack-advertisement' });
        res.end(data);
    });
    configure(repo, url, ['origin', 'backup']);
    await repo.refs.update('refs/remotes/origin/stale', oid, { expectedOldOid: null });
    await repo.refs.update('refs/tags/keep', oid, { expectedOldOid: null });
    await assert.rejects(transport.fetch(repo, 'origin', { prune: true }), /HTTP 500/);
    assert.equal(await repo.refs.resolveToOid('refs/remotes/origin/stale'), oid);
    await assert.rejects(transport.fetchAll(repo, { prune: true }), /fetch 'origin' failed/);
    fail = false;
    await transport.fetch(repo, 'origin', { prune: true });
    assert.equal(await repo.refs.resolveToOid('refs/remotes/origin/stale'), null);
    assert.equal(await repo.refs.resolveToOid('refs/heads/main'), oid);
    assert.equal(await repo.refs.resolveToOid('refs/tags/keep'), oid);
});

test('ambiguous receive-pack failure is not retried', async t => {
    let requests = 0;
    const url = await server(t, (req) => {
        requests++;
        req.socket.destroy();
    });
    await assert.rejects(
        transport.request(`${url}/repo`, 'git-receive-pack', Buffer.from('0000')),
        /push result is unknown.*fetch before retrying/
    );
    assert.equal(requests, 1);
});

test('saved auth is origin-bound, refreshes once on 401, and explicit basic auth is preserved', async t => {
    const original = {
        access: authStorage.getAccessToken,
        refresh: authStorage.getRefreshToken,
        update: authStorage.updateTokens
    };
    let access = 'expired', refreshCalls = 0, updateArgs = null, forbiddenCalls = 0;
    authStorage.getAccessToken = async () => access;
    authStorage.getRefreshToken = async () => 'refresh-old';
    authStorage.updateTokens = async (...args) => { updateArgs = args; access = args[0]; };
    t.after(() => Object.assign(authStorage, { getAccessToken: original.access, getRefreshToken: original.refresh, updateTokens: original.update }));
    t.after(() => { delete process.env.GENT_API_URL; delete process.env.GENT_HTTP_USER; delete process.env.GENT_HTTP_TOKEN; });

    const api = await server(t, (req, res) => {
        if (req.url === '/api/auth/token/refresh/') {
            refreshCalls++;
            res.writeHead(200, { 'content-type': 'application/json' });
            return res.end(JSON.stringify({ access: 'fresh', refresh: 'refresh-new' }));
        }
        if (req.url.startsWith('/forbidden/')) {
            forbiddenCalls++;
            res.writeHead(403);
            return res.end();
        }
        if (req.headers.authorization !== 'Bearer fresh') {
            res.writeHead(401);
            return res.end();
        }
        const data = advertisement('git-upload-pack', [], 'object-format=sha256');
        res.writeHead(200, { 'content-type': 'application/x-git-upload-pack-advertisement' });
        res.end(data);
    });
    process.env.GENT_API_URL = api;
    await transport.discover(`${api}/repo`);
    assert.equal(refreshCalls, 1);
    assert.deepEqual(updateArgs, ['fresh', 'refresh-new']);
    await assert.rejects(transport.request(`${api}/forbidden`, 'git-upload-pack'), /HTTP 403/);
    assert.equal(refreshCalls, 1);
    assert.equal(forbiddenCalls, 1);

    let otherAuth;
    const other = await server(t, (req, res) => {
        otherAuth = req.headers.authorization;
        const data = advertisement('git-upload-pack', [], 'object-format=sha256');
        res.writeHead(200, { 'content-type': 'application/x-git-upload-pack-advertisement' });
        res.end(data);
    });
    await transport.discover(`${other}/repo`);
    assert.equal(otherAuth, undefined);
    process.env.GENT_HTTP_USER = 'user';
    process.env.GENT_HTTP_TOKEN = 'token';
    await transport.discover(`${other}/repo`);
    assert.equal(otherAuth, `Basic ${Buffer.from('user:token').toString('base64')}`);
});
