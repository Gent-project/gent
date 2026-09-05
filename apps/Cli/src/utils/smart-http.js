/** Independent bounded protocol-v0 client. No external Git engine. */
const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');
const objects = require('./git-objects');
const { buildPack, readPackStream } = require('./packfile');
const { assertRefName: validateRefName } = require('./refs');
const repository = require('./repository');
const ops = require('./gent-ops');
const MAX_BYTES = 128 * 1024 * 1024;
const ZERO = '0'.repeat(64);

function pkt(value) {
    const data = Buffer.isBuffer(value) ? value : Buffer.from(value);
    if (data.length > 65516) throw new Error('packet exceeds limit');
    return Buffer.concat([Buffer.from((data.length + 4).toString(16).padStart(4, '0')), data]);
}
function packet(data, pos) {
    const raw = data.toString('ascii', pos, pos + 4);
    if (!/^[0-9a-f]{4}$/i.test(raw)) throw new Error('invalid packet length');
    const size = parseInt(raw, 16);
    if (!size) return { line: null, pos: pos + 4 };
    if (size < 4 || size > 65520 || pos + size > data.length) throw new Error('truncated packet');
    const line = data.subarray(pos + 4, pos + size);
    if (line.toString().startsWith('ERR ')) throw new Error(line.toString().trim());
    return { line, pos: pos + size };
}
function remoteUrl(value) {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
        throw new Error('use an HTTP(S) URL without credentials, query or fragment');
    }
    if (url.protocol !== 'https:' && !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) {
        throw new Error('remote connections require HTTPS (HTTP is allowed on loopback for development)');
    }
    return url.toString().replace(/\/$/, '');
}
async function request(url, service, body) {
    const headers = {};
    if (process.env.GENT_HTTP_TOKEN) {
        if (!process.env.GENT_HTTP_USER) throw new Error('set GENT_HTTP_USER with GENT_HTTP_TOKEN');
        headers.Authorization = 'Basic ' + Buffer.from(`${process.env.GENT_HTTP_USER}:${process.env.GENT_HTTP_TOKEN}`).toString('base64');
    }
    const suffix = body ? service : `info/refs?service=${service}`;
    if (body) headers['Content-Type'] = `application/x-${service}-request`;
    const result = await axios({ url: `${remoteUrl(url)}/${suffix}`, method: body ? 'POST' : 'GET', data: body,
        headers, responseType: 'arraybuffer', timeout: 30000, maxRedirects: 0,
        maxBodyLength: MAX_BYTES, maxContentLength: MAX_BYTES,
        validateStatus: () => true });
    if (result.status !== 200) throw new Error(`remote returned HTTP ${result.status}`);
    const expected = `application/x-${service}-${body ? 'result' : 'advertisement'}`;
    if (result.headers['content-type']?.split(';')[0] !== expected) throw new Error('invalid smart HTTP content type');
    return Buffer.from(result.data);
}
async function discover(url, service = 'git-upload-pack') {
    const data = await request(url, service);
    let row = packet(data, 0);
    if (row.line?.toString() !== `# service=${service}\n`) throw new Error('invalid service advertisement');
    row = packet(data, row.pos);
    if (row.line !== null) throw new Error('missing service flush');
    const refs = new Map(); let caps = [], first = true, pos = row.pos;
    while (pos < data.length) {
        row = packet(data, pos); pos = row.pos;
        if (row.line === null) break;
        const [value, capabilities] = row.line.toString().replace(/\n$/, '').split('\0');
        if (first) caps = (capabilities || '').split(' ');
        else if (capabilities) throw new Error('unexpected capabilities');
        first = false;
        const [oid, name] = value.split(' ');
        objects.assertObjectId(oid);
        if (name === 'capabilities^{}' && oid === ZERO) continue;
        if (name !== 'HEAD') validateRefName(name.replace(/\^\{\}$/, ''));
        refs.set(name, oid);
    }
    if (!caps.includes('object-format=sha256')) throw new Error('remote must negotiate SHA-256');
    return { refs, caps, head: caps.find(c => c.startsWith('symref=HEAD:'))?.slice(12) };
}
function dependencies(item) {
    if (item.type === 'blob') return [];
    if (item.type === 'tree') return objects.parseTree(item.payload).filter(e => e.mode !== 0o160000).map(e => [e.oid, e.type]);
    if (item.type === 'commit') {
        const c = objects.parseCommit(item.payload);
        if (!c.author || !c.committer) throw new Error('commit identities required');
        return [[c.tree, 'tree'], ...c.parents.map(p => [p, 'commit'])];
    }
    if (item.type === 'tag') { const t = objects.parseTag(item.payload); return [[t.object, t.targetType]]; }
    throw new Error('invalid object type');
}
async function closure(roots, resolve) {
    const result = new Map(), todo = [...roots]; let total = 0;
    while (todo.length) {
        const [oid, expected] = todo.pop();
        const item = result.get(oid) || await resolve(oid);
        if (!item || (expected && item.type !== expected)) throw new Error(`missing or mistyped object ${oid}`);
        if (result.has(oid)) continue;
        if (objects.hashObject(item.type, item.payload) !== oid) throw new Error('object ID mismatch');
        total += item.payload.length;
        if (total > MAX_BYTES || result.size >= 10000) throw new Error('history exceeds transfer limits');
        result.set(oid, { ...item, oid }); todo.push(...dependencies(item));
    }
    return result;
}
function nameCheck(name) {
    if (!/^[A-Za-z0-9_-]+$/.test(name)) throw new Error('remote name must use letters, digits, _ or -');
}
function configured(repo, name = 'origin') {
    nameCheck(name);
    const fetchSpecs = repo.config.getAll(`remote.${name}.fetch`);
    if (fetchSpecs.some(spec => spec !== `+refs/heads/*:refs/remotes/${name}/*`)) throw new Error('custom fetch refspecs are not supported; use the full branch mapping');
    for (const key of ['mirror', 'promisor', 'uploadpack', 'receivepack', 'proxy', 'pushurl', 'tagopt']) {
        if (repo.config.get(`remote.${name}.${key}`) !== undefined) throw new Error(`remote.${name}.${key} is not supported by the canonical transport`);
    }
    const url = repo.config.get(`remote.${name}.url`);
    if (!url) throw new Error(`remote '${name}' is not configured; use gent remote add ${name} <url>`);
    return remoteUrl(url);
}
async function fetch(repo, name = 'origin', url = configured(repo, name)) {
    nameCheck(name);
    const ad = await discover(url);
    const selected = [...ad.refs].filter(([ref]) => ref.startsWith('refs/heads/') || (ref.startsWith('refs/tags/') && !ref.endsWith('^{}')));
    const updates = [];
    for (const [ref, oid] of selected) {
        const target = ref.startsWith('refs/heads/') ? `refs/remotes/${name}/${ref.slice(11)}` : ref;
        const before = await repo.refs.resolveToOid(target);
        if (ref.startsWith('refs/tags/') && before && before !== oid) throw new Error(`remote tag differs: ${ref}`);
        updates.push({ name: target, newOid: oid, expectedOldOid: before });
    }
    if (selected.length) {
        const wants = [...new Set(selected.map(([, oid]) => oid))];
        const body = Buffer.concat([...wants.map((oid, i) => pkt(`want ${oid}${i ? '' : ' object-format=sha256'}\n`)), Buffer.from('0000'), pkt('done\n')]);
        const data = await request(url, 'git-upload-pack', body);
        const first = packet(data, 0);
        if (first.line?.toString() !== 'NAK\n') throw new Error('unsupported upload response');
        const incoming = await readPackStream(data.subarray(first.pos), { maxObjects: 10000, resolveBase: oid => repo.objects.has(oid).then(has => has ? repo.objects.read(oid) : null) });
        const byOid = new Map(incoming.map(item => [item.oid, item]));
        await closure(selected.map(([ref, oid]) => [oid, ref.startsWith('refs/heads/') ? 'commit' : null]), oid => byOid.get(oid) || repo.objects.read(oid));
        for (const item of incoming) await repo.objects.writeVerified(item.oid, item.type, item.payload);
        await repo.refs.updateMany(updates, `fetch ${name}`);
    }
    return ad;
}
async function push(repo, name = 'origin', branch, options = {}) {
    const url = configured(repo, name), head = await repo.refs.head();
    branch ||= head.branch;
    if (!branch) throw new Error('specify a branch from detached HEAD');
    const ref = branch.startsWith('refs/') ? branch : `refs/heads/${branch}`;
    validateRefName(ref);
    if (!ref.startsWith('refs/heads/') && !ref.startsWith('refs/tags/')) throw new Error('only branches and tags may be pushed');
    const target = await repo.refs.resolveToOid(ref);
    if (!target) throw new Error(`unknown ref ${ref}`);
    const ad = await discover(url, 'git-receive-pack'), old = ad.refs.get(ref) || ZERO;
    if (target === old) return;
    if (old !== ZERO && !options.force && (ref.startsWith('refs/tags/') || !(await ops.isAncestor(repo, old, target)))) {
        throw new Error('non-fast-forward push; fetch and merge first');
    }
    if (!ad.caps.includes('report-status')) throw new Error('remote must report ref status');
    const all = await closure([[target, ref.startsWith('refs/heads/') ? 'commit' : null]], oid => repo.objects.read(oid));
    const body = Buffer.concat([pkt(`${old} ${target} ${ref}\0report-status object-format=sha256\n`), Buffer.from('0000'), buildPack([...all.values()]).pack]);
    const data = await request(url, 'git-receive-pack', body);
    let pos = 0; const lines = [];
    while (pos < data.length) { const row = packet(data, pos); pos = row.pos; if (row.line === null) break; lines.push(row.line.toString().trim()); }
    if (lines[0] !== 'unpack ok' || !lines.includes(`ok ${ref}`) || lines.some(line => line.startsWith('ng '))) throw new Error(`push rejected: ${lines.join('; ')}`);
}
async function clone(url, directory) {
    url = remoteUrl(url);
    const ad = await discover(url);
    const destination = path.resolve(directory || new URL(url).pathname.split('/').pop().replace(/\.git$/, ''));
    // Exclusive directory creation avoids touching existing user files on failure.
    await fs.mkdir(destination);
    const branch = ad.head?.startsWith('refs/heads/') ? ad.head.slice(11) : 'main';
    validateRefName(`refs/heads/${branch}`);
    const { repo } = await repository.init(destination, { defaultBranch: branch });
    repo.localConfig.set('remote.origin.url', url);
    repo.localConfig.set('remote.origin.fetch', '+refs/heads/*:refs/remotes/origin/*');
    repo.localConfig.set(`branch.${branch}.remote`, 'origin');
    repo.localConfig.set(`branch.${branch}.merge`, `refs/heads/${branch}`);
    await repo.localConfig.save();
    const current = await fetch(repo, 'origin', url), tip = current.refs.get(`refs/heads/${branch}`);
    if (tip) {
        await repo.refs.update(`refs/heads/${branch}`, tip, { expectedOldOid: null, reason: 'clone' });
        await ops.checkout(repo, branch, { force: true });
    }
    return destination;
}
async function migrationInfo(url) {
    const headers = {};
    if (process.env.GENT_HTTP_TOKEN) {
        if (!process.env.GENT_HTTP_USER) throw new Error('set GENT_HTTP_USER with GENT_HTTP_TOKEN');
        headers.Authorization = 'Basic ' + Buffer.from(`${process.env.GENT_HTTP_USER}:${process.env.GENT_HTTP_TOKEN}`).toString('base64');
    }
    const result = await axios.get(remoteUrl(url) + '/gent-migration', { headers, timeout: 30000, maxRedirects: 0, maxContentLength: MAX_BYTES });
    if (result.data?.format !== 'gent-migration-1' || result.data.object_format !== 'sha256') throw new Error('server cutover must finish before connected migration');
    return result.data;
}
module.exports = { migrationInfo, pkt, packet, discover, closure, fetch, push, clone, configured, remoteUrl, nameCheck };
