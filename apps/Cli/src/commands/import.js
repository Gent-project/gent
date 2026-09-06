/**
 * SHA-1 Git import adapter. Git is used only as a read-only object provider;
 * Gent writes every destination object itself in its native SHA-256 format.
 */
const fs = require('fs').promises;
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const repository = require('../utils/repository');
const transport = require('../utils/smart-http');
const apiClient = require('../utils/api-client');
const authStorage = require('../utils/auth-storage');
const { API_ENDPOINTS } = require('../utils/constants');
const { serializeTree, serializeCommit, serializeTag, parseIdentity } = require('../utils/git-objects');
const { assertRefName } = require('../utils/refs');
const ops = require('../utils/gent-ops');

const SOURCE_OID = /^[0-9a-f]{40}$/;

function git(dir, args, input) {
    const result = spawnSync('git', ['-C', dir, ...args], {
        input, encoding: null, maxBuffer: 512 * 1024 * 1024
    });
    if (result.error) throw new Error(`Git is required for import: ${result.error.message}`);
    if (result.status !== 0) throw new Error(result.stderr.toString('utf8').trim() || `git ${args[0]} failed`);
    return result.stdout;
}

function sourceHeaders(payload) {
    const split = payload.indexOf(Buffer.from('\n\n'));
    if (split < 0) throw new Error('source commit has no header terminator');
    const headers = [];
    let current = null;
    for (const line of payload.subarray(0, split).toString('utf8').split('\n')) {
        if (line.startsWith(' ')) {
            if (!current) throw new Error('source commit has a malformed continuation header');
            current[1] += `\n${line}`;
            continue;
        }
        const space = line.indexOf(' ');
        if (space < 1) throw new Error('source commit has a malformed header');
        current = [line.slice(0, space), line.slice(space + 1)];
        headers.push(current);
    }
    return { headers, message: payload.subarray(split + 2) };
}

function header(headers, name) { return headers.find(([key]) => key === name)?.[1] || null; }

function parseSourceTree(payload) {
    const entries = [];
    for (let offset = 0; offset < payload.length;) {
        const space = payload.indexOf(0x20, offset);
        const nul = payload.indexOf(0, space + 1);
        if (space < 0 || nul < 0 || nul + 21 > payload.length) throw new Error('source tree is malformed');
        const mode = Number.parseInt(payload.toString('ascii', offset, space), 8);
        const nameBytes = payload.subarray(space + 1, nul);
        const name = nameBytes.toString('utf8');
        if (!Buffer.from(name, 'utf8').equals(nameBytes)) throw new Error('non-UTF-8 Git path names cannot be imported yet');
        entries.push({ mode, name, oid: payload.toString('hex', nul + 1, nul + 21) });
        offset = nul + 21;
    }
    return entries;
}

async function createRemote(repo, name, isPrivate) {
    if (!await authStorage.isAuthenticated()) throw new Error('run gent login before using --remote');
    if (!/^[A-Za-z0-9_-]+$/.test(name)) throw new Error('remote repository name must use letters, digits, _ or -');
    const head = await repo.refs.head();
    const data = await apiClient.post(API_ENDPOINTS.REPOS_CREATE, {
        name, description: 'Imported from Git', is_private: Boolean(isPrivate),
        default_branch: head.branch || 'main', object_format: 'sha256'
    });
    const remote = data.repository || data;
    const base = (await apiClient.resolveBaseUrl()).replace(/\/api\/?$/, '').replace(/\/$/, '');
    const url = `${base}/${encodeURIComponent(remote.owner_id)}/${encodeURIComponent(remote.name)}.git`;
    repo.localConfig.set('remote.origin.url', url);
    repo.localConfig.set('remote.origin.fetch', '+refs/heads/*:refs/remotes/origin/*');
    if (head.branch) {
        repo.localConfig.set(`branch.${head.branch}.remote`, 'origin');
        repo.localConfig.set(`branch.${head.branch}.merge`, `refs/heads/${head.branch}`);
    }
    await repo.localConfig.save();
    return url;
}

async function importRepository(source, destination, options = {}) {
    const target = path.resolve(destination);
    if (await fs.access(target).then(() => true, () => false)) throw new Error(`destination already exists: ${target}`);
    const scratch = await fs.mkdtemp(path.join(os.tmpdir(), 'gent-import-'));
    const mirror = path.join(scratch, 'source.git');
    try {
        const clone = spawnSync('git', ['clone', '--mirror', '--no-local', '--', source, mirror], { encoding: null, maxBuffer: 1024 * 1024 });
        if (clone.error) throw new Error(`Git is required for import: ${clone.error.message}`);
        if (clone.status !== 0) throw new Error(clone.stderr.toString('utf8').trim() || 'could not clone source repository');
        if (git(mirror, ['rev-parse', '--show-object-format']).toString('utf8').trim() !== 'sha1') {
            throw new Error('import accepts SHA-1 Git repositories only; this source is already SHA-256');
        }
        const lines = git(mirror, ['for-each-ref', '--format=%(refname) %(objectname)']).toString('utf8').trim().split('\n').filter(Boolean);
        const refs = lines.map(line => {
            const [name, oid] = line.split(' ');
            if ((!name.startsWith('refs/heads/') && !name.startsWith('refs/tags/')) || !SOURCE_OID.test(oid)) throw new Error(`unsupported source ref: ${line}`);
            assertRefName(name);
            return { name, oid };
        });
        if (!refs.some(ref => ref.name.startsWith('refs/heads/'))) throw new Error('source has no branch refs to import');
        const sourceHead = git(mirror, ['symbolic-ref', '-q', 'HEAD']).toString('utf8').trim();
        const defaultRef = refs.some(ref => ref.name === sourceHead) ? sourceHead : refs.find(ref => ref.name.startsWith('refs/heads/')).name;
        const { repo } = await repository.init(target, { defaultBranch: defaultRef.slice('refs/heads/'.length) });
        const converted = new Map();
        const read = oid => {
            if (!SOURCE_OID.test(oid)) throw new Error(`invalid source object ID: ${oid}`);
            const type = git(mirror, ['cat-file', '-t', oid]).toString('utf8').trim();
            return { type, payload: git(mirror, ['cat-file', type, oid]) };
        };
        const convert = async oid => {
            if (converted.has(oid)) return converted.get(oid);
            const pending = (async () => {
                const sourceObject = read(oid);
                if (sourceObject.type === 'blob') return repo.objects.write('blob', sourceObject.payload);
                if (sourceObject.type === 'tree') {
                    const entries = [];
                    for (const entry of parseSourceTree(sourceObject.payload)) {
                        if (entry.mode === 0o160000) throw new Error(`submodule at '${entry.name}' cannot be imported; import its repository separately`);
                        entries.push({ mode: entry.mode, name: entry.name, oid: await convert(entry.oid) });
                    }
                    return repo.objects.write('tree', serializeTree(entries));
                }
                if (sourceObject.type === 'commit') {
                    const parsed = sourceHeaders(sourceObject.payload);
                    const tree = header(parsed.headers, 'tree');
                    const author = header(parsed.headers, 'author');
                    const committer = header(parsed.headers, 'committer');
                    if (!tree || !author || !committer) throw new Error(`source commit ${oid} is missing required headers`);
                    const parents = parsed.headers.filter(([key]) => key === 'parent').map(([, value]) => value);
                    const extraHeaders = parsed.headers.filter(([key]) => !['tree', 'parent', 'author', 'committer', 'gpgsig'].includes(key));
                    extraHeaders.push(['gent-source-sha1', oid]);
                    return repo.objects.write('commit', serializeCommit({
                        tree: await convert(tree), parents: await Promise.all(parents.map(convert)),
                        author: parseIdentity(author), committer: parseIdentity(committer), message: parsed.message, extraHeaders
                    }));
                }
                if (sourceObject.type === 'tag') {
                    const parsed = sourceHeaders(sourceObject.payload);
                    const target = header(parsed.headers, 'object'), targetType = header(parsed.headers, 'type'), name = header(parsed.headers, 'tag');
                    if (!target || !targetType || !name) throw new Error(`source tag ${oid} is malformed`);
                    const tagger = header(parsed.headers, 'tagger');
                    const extraHeaders = parsed.headers.filter(([key]) => !['object', 'type', 'tag', 'tagger', 'gpgsig'].includes(key));
                    extraHeaders.push(['gent-source-sha1', oid]);
                    return repo.objects.write('tag', serializeTag({ object: await convert(target), targetType, tag: name, tagger: tagger ? parseIdentity(tagger) : null, message: parsed.message, extraHeaders }));
                }
                throw new Error(`source object ${oid} has unsupported type '${sourceObject.type}'`);
            })();
            converted.set(oid, pending);
            return pending;
        };
        for (const ref of refs) {
            const oid = await convert(ref.oid);
            await repo.refs.update(ref.name, oid, { expectedOldOid: null, reason: `import ${ref.name}` });
        }
        await ops.checkout(repo, defaultRef.slice('refs/heads/'.length), { force: true });
        let remoteUrl;
        if (options.remote) {
            remoteUrl = await createRemote(repo, options.remote, options.private);
            const branches = refs.filter(ref => ref.name.startsWith('refs/heads/')).map(ref => ref.name.slice(11));
            const defaultBranch = defaultRef.slice(11);
            for (const branch of [defaultBranch, ...branches.filter(branch => branch !== defaultBranch)]) await transport.push(repo, 'origin', branch);
            for (const ref of refs.filter(ref => ref.name.startsWith('refs/tags/'))) await transport.push(repo, 'origin', ref.name);
        }
        return { destination: target, commits: [...converted.keys()].filter(oid => read(oid).type === 'commit').length, refs: refs.length, remoteUrl };
    } finally {
        await fs.rm(scratch, { recursive: true, force: true });
    }
}

module.exports = async function importCommand(source, directory, options) {
    try {
        const result = await importRepository(source, directory, options);
        console.log(`Imported ${result.refs} ref(s) into ${result.destination}`);
        if (result.remoteUrl) console.log(`Pushed imported history to ${result.remoteUrl}`);
    } catch (error) {
        console.error(`Error: ${error.message}`);
        process.exitCode = 1;
    }
};
module.exports.importRepository = importRepository;
