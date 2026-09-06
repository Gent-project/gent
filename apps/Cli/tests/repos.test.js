const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

const apiClient = require('../src/utils/api-client');
const authStorage = require('../src/utils/auth-storage');
const repos = require('../src/commands/repos');
const clone = require('../src/commands/clone');

async function temporaryDirectory(t, prefix) {
    const directory = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), prefix)));
    t.after(() => fs.rm(directory, { recursive: true, force: true }));
    return directory;
}

function silenceConsole(t) {
    const originalLog = console.log;
    const originalError = console.error;
    console.log = () => {};
    console.error = () => {};
    t.after(() => {
        console.log = originalLog;
        console.error = originalError;
    });
}

test('repos --create --yes initializes SHA-256 storage and links the new remote', { concurrency: false }, async t => {
    const cwd = await temporaryDirectory(t, 'gent-repos-create-');
    const originalCwd = process.cwd();
    const originalAuthenticated = authStorage.isAuthenticated;
    const originalPost = apiClient.post;
    const originalResolveBaseUrl = apiClient.resolveBaseUrl;
    const requests = [];

    process.chdir(cwd);
    authStorage.isAuthenticated = async () => true;
    apiClient.resolveBaseUrl = async () => 'https://gent.example/api';
    apiClient.post = async (url, body) => {
        requests.push({ url, body });
        return { id: 7, name: body.name, owner_id: 3, owner_username: 'tester' };
    };
    silenceConsole(t);
    t.after(() => {
        process.chdir(originalCwd);
        authStorage.isAuthenticated = originalAuthenticated;
        apiClient.post = originalPost;
        apiClient.resolveBaseUrl = originalResolveBaseUrl;
    });

    await repos([], {
        create: 'graduation-project',
        yes: true,
        description: 'Portable Gent repository',
        defaultBranch: 'development',
    });

    assert.equal(requests.length, 1);
    assert.equal(requests[0].body.object_format, 'sha256');
    assert.equal(requests[0].body.name, 'graduation-project');
    assert.equal(requests[0].body.default_branch, 'development');
    assert.equal((await fs.readFile(path.join(cwd, '.git'), 'utf8')).trim(), 'gitdir: .gent');
    assert.equal(
        (await fs.readFile(path.join(cwd, '.gent', 'HEAD'), 'utf8')).trim(),
        'ref: refs/heads/development',
    );
    const config = await fs.readFile(path.join(cwd, '.gent', 'config'), 'utf8');
    assert.match(config, /objectFormat = sha256/i);
    assert.match(config, /url = https:\/\/gent\.example\/tester\/graduation-project\.git/);
});

test('legacy repository creation keeps its numeric REST remote', { concurrency: false }, async t => {
    const cwd = await temporaryDirectory(t, 'gent-repos-legacy-');
    const originalCwd = process.cwd();
    const originalAuthenticated = authStorage.isAuthenticated;
    const originalPost = apiClient.post;

    await fs.mkdir(path.join(cwd, '.gent'));
    await fs.writeFile(path.join(cwd, '.gent', 'commits.json'), '{}');
    await fs.writeFile(path.join(cwd, '.gent', 'config.json'), JSON.stringify({ remotes: {} }));
    process.chdir(cwd);
    authStorage.isAuthenticated = async () => true;
    apiClient.post = async (_url, body) => ({
        id: 8,
        name: body.name,
        owner_id: 3,
        owner_username: 'tester',
    });
    silenceConsole(t);
    t.after(() => {
        process.chdir(originalCwd);
        authStorage.isAuthenticated = originalAuthenticated;
        apiClient.post = originalPost;
    });

    await repos([], { create: 'legacy-project' });

    const config = JSON.parse(await fs.readFile(path.join(cwd, '.gent', 'config.json'), 'utf8'));
    assert.equal(config.remotes.origin.url, '/api/repos/3/legacy-project');
});

test('repository-name validation rejects accidental extra words before any mutation', () => {
    const result = repos.validateRepositoryName('graduation', ['project']);
    assert.equal(result.valid, false);
    assert.equal(result.suggestion, 'graduation-project');
});

test('legacy public clone does not require stored authentication', { concurrency: false }, async t => {
    const cwd = await temporaryDirectory(t, 'gent-public-clone-');
    const originalCwd = process.cwd();
    const originalGet = apiClient.get;
    const requested = [];

    process.chdir(cwd);
    apiClient.get = async url => {
        requested.push(url);
        return {
            name: 'public-repository',
            currentBranch: 'main',
            commits: [],
            objects: [],
            branches: {},
            tags: {},
        };
    };
    silenceConsole(t);
    t.after(() => {
        process.chdir(originalCwd);
        apiClient.get = originalGet;
    });

    await clone('/api/repos/3/public-repository', 'checkout');

    assert.deepEqual(requested, ['/api/repos/3/public-repository/clone/']);
    const config = JSON.parse(await fs.readFile(path.join(cwd, 'checkout', '.gent', 'config.json'), 'utf8'));
    assert.equal(config.remotes.origin.url, '/api/repos/3/public-repository');
});
