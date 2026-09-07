const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const config = require('../../src/utils/git-graph-config');
const graph = require('../../src/commands/graph');
const repository = require('../../src/utils/repository');

async function fixture(t) {
    const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'gent graph setup-')));
    t.after(() => fs.rm(root, { recursive: true, force: true }));

    const bin = path.join(root, 'bin with spaces');
    await fs.mkdir(bin);
    const gitPath = path.join(bin, 'real git');
    const adapterPath = path.join(bin, 'gent-git-graph');
    await fs.writeFile(gitPath, `#!/bin/sh
if [ "$1" = "--version" ]; then echo "git version 2.50.1.test"; exit 0; fi
if [ "$1" = "init" ]; then
  for last_arg in "$@"; do :; done
  mkdir -p "$last_arg"
  exit 0
fi
if [ "$1" = "-C" ] && [ "$3" = "rev-parse" ] && [ "$4" = "--show-object-format" ]; then
  echo sha256
  exit 0
fi
echo unsupported >&2
exit 2
`);
    await fs.writeFile(adapterPath, '#!/bin/sh\nexit 0\n');
    await fs.chmod(gitPath, 0o755);
    await fs.chmod(adapterPath, 0o755);
    return { root, gitPath, adapterPath, configPath: path.join(root, 'config', 'graph.json') };
}

async function withGraphConfig(configPath, callback) {
    const previous = process.env.GENT_GRAPH_CONFIG;
    process.env.GENT_GRAPH_CONFIG = configPath;
    try {
        return await callback();
    } finally {
        if (previous === undefined) delete process.env.GENT_GRAPH_CONFIG;
        else process.env.GENT_GRAPH_CONFIG = previous;
    }
}

function captureConsole(callback) {
    const lines = [];
    const original = console.log;
    console.log = (...args) => lines.push(args.join(' '));
    return Promise.resolve()
        .then(callback)
        .then(result => ({ result, output: lines.join('\n') }))
        .finally(() => { console.log = original; });
}

function runCli(args, options) {
    return new Promise((resolve, reject) => {
        const child = spawn(process.execPath, [path.resolve(__dirname, '../../src/index.js'), ...args], {
            cwd: options.cwd,
            env: { ...process.env, ...options.env },
            stdio: ['ignore', 'pipe', 'pipe'],
        });
        const stdout = [];
        const stderr = [];
        child.stdout.on('data', chunk => stdout.push(chunk));
        child.stderr.on('data', chunk => stderr.push(chunk));
        child.on('error', reject);
        child.on('close', code => resolve({
            code,
            stdout: Buffer.concat(stdout).toString('utf8'),
            stderr: Buffer.concat(stderr).toString('utf8'),
        }));
    });
}

test('dedicated config honors GENT_GRAPH_CONFIG and stores only realGitPath', async t => {
    const f = await fixture(t);
    await withGraphConfig(f.configPath, async () => {
        assert.equal(config.getConfigPath(), f.configPath);
        await config.writeConfig({ realGitPath: f.gitPath, ignored: 'value' });
        assert.deepEqual(await config.readConfig(), { realGitPath: f.gitPath });
        assert.equal((await fs.stat(f.configPath)).mode & 0o777, 0o600);
    });
});

test('real Git validation requires an absolute executable and prevents adapter recursion', async t => {
    const f = await fixture(t);
    await assert.rejects(config.validateRealGit('git'), /absolute path/);
    await assert.rejects(config.validateRealGit(f.adapterPath, f.adapterPath), /resolves to gent-git-graph/);
    assert.deepEqual(await config.validateRealGit(f.gitPath, f.adapterPath), {
        path: f.gitPath,
        version: 'git version 2.50.1.test',
    });
});

test('graph setup saves real Git and prints the adapter git.path snippet', async t => {
    const f = await fixture(t);
    await withGraphConfig(f.configPath, async () => {
        const { output } = await captureConsole(() => graph.setup({
            gitPath: f.gitPath,
            adapterPath: f.adapterPath,
        }));
        assert.deepEqual(await config.readConfig(), { realGitPath: f.gitPath });
        assert.match(output, new RegExp(JSON.stringify(f.adapterPath).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
        assert.match(output, /dedicated VS Code profile/);
    });
});

test('graph setup configures the current canonical VS Code workspace', async t => {
    const f = await fixture(t);
    const worktree = path.join(f.root, 'canonical');
    await repository.init(worktree);
    await withGraphConfig(f.configPath, async () => {
        const { result, output } = await captureConsole(() => graph.setup({
            cwd: worktree,
            gitPath: f.gitPath,
            adapterPath: f.adapterPath,
        }));
        const settingsPath = path.join(worktree, '.vscode', 'settings.json');
        assert.equal(result.workspaceSettings, settingsPath);
        assert.deepEqual(JSON.parse(await fs.readFile(settingsPath, 'utf8')), { 'git.path': f.adapterPath });
        assert.match(await fs.readFile(path.join(worktree, '.gent', 'info', 'exclude'), 'utf8'),
            /^\/\.vscode\/settings\.json$/m);
        assert.match(output, /Configured VS Code workspace/);
        assert.match(output, /Reload the VS Code window/);
        assert.equal((await graph.checkWorkspaceSettings(worktree, f.adapterPath)).status, 'pass');
    });
});

test('graph doctor verifies Git SHA-256 support and canonical repository state', async t => {
    const f = await fixture(t);
    const worktree = path.join(f.root, 'canonical');
    const { repo } = await repository.init(worktree);
    repo.localConfig.set('remote.origin.url', 'https://secret-user:secret-token@example.test/repo.git');
    await repo.localConfig.save();

    await withGraphConfig(f.configPath, async () => {
        await config.writeConfig({ realGitPath: f.gitPath });
        await graph.installWorkspaceSettings(worktree, f.adapterPath);
        const previousExitCode = process.exitCode;
        process.exitCode = undefined;
        try {
            const { result: checks, output } = await captureConsole(() => graph.doctor({
                cwd: worktree,
                adapterPath: f.adapterPath,
            }));
            assert.equal(checks.find(check => check.name === 'Git SHA-256 support').status, 'pass');
            assert.match(checks.find(check => check.name === 'Repository').detail, /canonical Gent repository/);
            assert.equal(checks.find(check => check.name === 'Remote configuration').detail, 'configured: origin');
            assert.equal(checks.find(check => check.name === 'VS Code workspace').status, 'pass');
            assert.doesNotMatch(output, /secret-user|secret-token/);
            assert.equal(process.exitCode, undefined);
        } finally {
            process.exitCode = previousExitCode;
        }
    });
});

test('repository doctor distinguishes ordinary Git, legacy Gent, and no repository', async t => {
    const f = await fixture(t);
    const ordinary = path.join(f.root, 'ordinary');
    await fs.mkdir(path.join(ordinary, '.git', 'objects'), { recursive: true });
    await fs.mkdir(path.join(ordinary, '.git', 'refs'));
    await fs.writeFile(path.join(ordinary, '.git', 'HEAD'), 'ref: refs/heads/main\n');
    await fs.writeFile(path.join(ordinary, '.git', 'config'), '[core]\n\trepositoryformatversion = 0\n');

    const legacy = path.join(f.root, 'legacy');
    await fs.mkdir(path.join(legacy, '.gent'), { recursive: true });
    await fs.writeFile(path.join(legacy, '.gent', 'commits.json'), '{}');

    const malformed = path.join(f.root, 'malformed');
    await fs.mkdir(path.join(malformed, '.gent', 'objects'), { recursive: true });
    await fs.mkdir(path.join(malformed, '.gent', 'refs'));
    await fs.writeFile(path.join(malformed, '.gent', 'HEAD'), 'ref: refs/heads/main\n');
    await fs.writeFile(path.join(malformed, '.gent', 'config'), '[core]\n\trepositoryformatversion = 1\n[extensions]\n\tobjectformat = sha256\n');

    const empty = path.join(f.root, 'none');
    await fs.mkdir(empty);

    assert.match((await graph.checkRepository(ordinary)).repository.detail, /ordinary Git repository/);
    assert.equal((await graph.checkRepository(legacy)).repository.status, 'fail');
    assert.match((await graph.checkRepository(malformed)).repository.detail, /marker is missing/);
    assert.equal((await graph.checkRepository(empty)).repository.status, 'warn');
});

test('CLI registers graph setup and persists configuration', async t => {
    const f = await fixture(t);
    const result = await runCli(['graph', 'setup', '--git-path', f.gitPath], {
        cwd: f.root,
        env: {
            GENT_GRAPH_CONFIG: f.configPath,
            GENT_GRAPH_ADAPTER: f.adapterPath,
        },
    });
    assert.equal(result.code, 0, result.stderr);
    assert.deepEqual(JSON.parse(await fs.readFile(f.configPath, 'utf8')), { realGitPath: f.gitPath });
    assert.match(result.stdout, /"git.path"/);
});
