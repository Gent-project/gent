#!/usr/bin/env node

/**
 * Remote-only E2E test for the Gent CLI.
 *
 * This test intentionally uses the deployed API from src/utils/constants.js.
 * It does not set GENT_API_BASE_URL, does not start a local server, and uses an
 * isolated HOME directory so the user's real ~/.gent/auth.json is untouched.
 */

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const https = require('https');
const { API_BASE_URL } = require('../src/utils/constants');
const packageJson = require('../package.json');

const CLI = path.resolve(__dirname, '..', 'src', 'index.js');
const EXPECTED_API = 'https://gent-api.onrender.com';
const runId = `${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gent-remote-e2e-'));
const home = path.join(root, 'home');
const work = path.join(root, 'work');
const autoInitRemoteDir = path.join(root, 'auto-init-remote');
const cloneDir = path.join(root, 'clone');
const autoDir = path.join(root, 'auto');
const password = 'StrongPass123!';
const email = `remote_e2e_${runId}@example.com`;
const repoName = `remote_e2e_${runId}`;
const autoRepoName = `auto_remote_e2e_${runId}`;

fs.mkdirSync(home, { recursive: true });
fs.mkdirSync(work, { recursive: true });
fs.mkdirSync(autoInitRemoteDir, { recursive: true });
fs.mkdirSync(autoDir, { recursive: true });

const env = {
    ...process.env,
    HOME: home,
};
delete env.GENT_API_BASE_URL;

function log(step) {
    console.log(`\n[remote:e2e] ${step}`);
}

function run(args, cwd, options = {}) {
    const result = spawnSync(process.execPath, [CLI, ...args], {
        cwd,
        env,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: options.timeout || 120000,
    });
    const output = `${result.stdout || ''}${result.stderr || ''}`;

    if (result.error) {
        throw result.error;
    }
    if (result.status !== 0) {
        const error = new Error(`Command failed: gent ${args.join(' ')}`);
        error.stdout = result.stdout || '';
        error.stderr = result.stderr || '';
        error.status = result.status;
        throw error;
    }

    if (output.includes('localhost') || output.includes('127.0.0.1')) {
        throw new Error(`Command output referenced a local URL: gent ${args.join(' ')}`);
    }

    return output;
}

function expectOutput(args, cwd, expected) {
    const output = run(args, cwd);
    assert.match(output, expected, `Expected "gent ${args.join(' ')}" to match ${expected}\n${output}`);
    return output;
}

function expectFailure(args, cwd, expected) {
    try {
        run(args, cwd);
    } catch (error) {
        const output = `${error.stdout || ''}${error.stderr || ''}`;
        assert.match(output, expected, `Expected failing "gent ${args.join(' ')}" to match ${expected}\n${output}`);
        return output;
    }
    throw new Error(`Expected "gent ${args.join(' ')}" to fail`);
}

function request(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let body = '';
            res.setEncoding('utf8');
            res.on('data', chunk => body += chunk);
            res.on('end', () => resolve({ statusCode: res.statusCode, body }));
        }).on('error', reject);
    });
}

async function waitForRemoteApi() {
    const deadline = Date.now() + 120000;
    let lastError;

    while (Date.now() < deadline) {
        try {
            const response = await request(`${EXPECTED_API}/api/`);
            if (response.statusCode === 200 && response.body.includes('Welcome to Gent API')) {
                return;
            }
            lastError = new Error(`HTTP ${response.statusCode}: ${response.body.slice(0, 160)}`);
        } catch (error) {
            lastError = error;
        }
        await new Promise(resolve => setTimeout(resolve, 5000));
    }

    throw new Error(`Remote API did not become ready: ${lastError && lastError.message}`);
}

(async () => {
    assert.strictEqual(API_BASE_URL, EXPECTED_API, 'CLI must use the deployed remote API URL');
    assert.strictEqual(env.GENT_API_BASE_URL, undefined, 'Test must not override API URL');

    log(`health check ${EXPECTED_API}/api/`);
    await waitForRemoteApi();

    log('auth: register, whoami, login');
    expectOutput([
        'register',
        '-e', email,
        '-p', password,
        '--password-confirm', password,
        '--first-name', 'Remote',
        '--last-name', 'Tester'
    ], work, /You are now logged in/);
    expectOutput(['whoami'], work, new RegExp(email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    expectOutput(['login', '-e', email, '-p', password], work, /You are now logged in/);

    log('remote repository: create and list');
    const repoOutput = expectOutput([
        'repos',
        '--create', repoName,
        '--description', 'Remote E2E repository'
    ], work, /URL: \/api\/repos\//);
    const remoteUrlMatch = repoOutput.match(/\/api\/repos\/(\d+)\/([A-Za-z0-9_-]+)/);
    assert(remoteUrlMatch, `Could not parse created repo URL:\n${repoOutput}`);
    const ownerId = remoteUrlMatch[1];
    const remoteUrl = `/api/repos/${ownerId}/${repoName}`;
    assert.strictEqual(remoteUrlMatch[2], repoName);
    expectOutput(['repos'], work, new RegExp(repoName));

    log('remote add can initialize an empty local folder');
    expectOutput(['remote', 'add', 'origin', remoteUrl], autoInitRemoteDir, /Added remote/);
    assert(fs.existsSync(path.join(autoInitRemoteDir, '.gent', 'config.json')));

    log('local repository: init, remote, status, add, diff, commit');
    fs.writeFileSync(path.join(work, 'README.md'), 'remote hello\n');
    expectOutput(['init'], work, /Initialized empty Gent repository/);
    expectOutput(['remote', 'add', 'origin', remoteUrl], work, /Added remote/);
    expectOutput(['remote', '-v'], work, new RegExp(remoteUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    expectOutput(['status'], work, /Untracked files/);
    expectOutput(['add', 'README.md'], work, /README\.md/);
    expectOutput(['diff', '--staged', '--stat'], work, /README\.md/);
    expectOutput(['commit', '-m', 'Initial remote commit'], work, /Initial remote commit/);
    expectOutput(['log', '--oneline'], work, /Initial remote commit/);
    expectOutput(['show', '--no-patch'], work, /Initial remote commit/);

    log('remote sync: push, branch sync, tag sync');
    expectOutput(['push'], work, /origin\/main|blob/);
    run(['push'], work);
    expectOutput(['branch', 'feature_remote_e2e'], work, /Created branch/);
    expectOutput(['branch'], work, /feature_remote_e2e/);
    expectOutput(['tag', `v-${runId}`, '-m', 'Remote E2E tag'], work, /Created tag/);
    expectOutput(['tag'], work, new RegExp(`v-${runId}`));

    log('clone from remote and verify working tree');
    expectOutput(['clone', remoteUrl, cloneDir], root, /commit\(s\), 1 object\(s\), 1 file\(s\)/);
    assert.strictEqual(fs.readFileSync(path.join(cloneDir, 'README.md'), 'utf8'), 'remote hello\n');
    expectOutput(['status'], cloneDir, /Last commit/);

    log('second commit: push from source, pull into clone');
    fs.writeFileSync(path.join(work, 'README.md'), 'remote hello\nsecond remote line\n');
    expectOutput(['add', 'README.md'], work, /README\.md/);
    expectOutput(['commit', '-m', 'Second remote commit'], work, /Second remote commit/);
    expectOutput(['push'], work, /origin\/main|blob/);
    expectOutput(['pull'], cloneDir, /origin\/main/);
    assert.strictEqual(
        fs.readFileSync(path.join(cloneDir, 'README.md'), 'utf8'),
        'remote hello\nsecond remote line\n'
    );
    expectOutput(['status'], cloneDir, /Last commit/);

    log('init --remote creates and links deployed repository');
    expectOutput(['init', '--remote', autoRepoName], autoDir, /Remote 'origin' configured/);
    const config = JSON.parse(fs.readFileSync(path.join(autoDir, '.gent', 'config.json'), 'utf8'));
    assert.match(config.remotes.origin.url, new RegExp(`/api/repos/${ownerId}/${autoRepoName}`));

    log('logout and unauthenticated guard');
    expectOutput(['logout'], work, /session has been ended/i);
    expectOutput(['whoami'], work, /not logged in/);
    expectOutput(['repos'], work, /Not authenticated/);

    log('version flag');
    expectOutput(['-V'], work, new RegExp(packageJson.version.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));

    console.log('\n[remote:e2e] PASS');
    console.log(`[remote:e2e] API: ${EXPECTED_API}`);
    console.log(`[remote:e2e] temp dir: ${root}`);
})().catch((error) => {
    console.error('\n[remote:e2e] FAIL');
    console.error(error.stack || error.message);
    console.error(`[remote:e2e] temp dir: ${root}`);
    process.exit(1);
});
