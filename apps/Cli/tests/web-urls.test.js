/**
 * Unit tests for web-app URL construction (`gent web` / `gent share`).
 * Run with:  node --test tests/web-urls.test.js
 *
 * Covers: default host, user-config override, env-var override, route shape,
 * encoding, and the branch/commit fallback.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const webUrls = require('../src/utils/web-urls');
const userConfig = require('../src/utils/user-config');

/**
 * Point HOME at a scratch dir so ~/.gent/cli-config.json reads/writes are
 * isolated from the developer's real config, and clear the env override.
 */
function withIsolatedConfig(fn) {
    return async () => {
        const home = fs.mkdtempSync(path.join(os.tmpdir(), 'gent-webcfg-'));
        const prevHome = process.env.HOME;
        const prevUserProfile = process.env.USERPROFILE;
        const prevWebUrl = process.env.GENT_WEB_URL;
        process.env.HOME = home;
        process.env.USERPROFILE = home;
        delete process.env.GENT_WEB_URL;
        try {
            await fn(home);
        } finally {
            if (prevHome === undefined) delete process.env.HOME; else process.env.HOME = prevHome;
            if (prevUserProfile === undefined) delete process.env.USERPROFILE; else process.env.USERPROFILE = prevUserProfile;
            if (prevWebUrl === undefined) delete process.env.GENT_WEB_URL; else process.env.GENT_WEB_URL = prevWebUrl;
            fs.rmSync(home, { recursive: true, force: true });
        }
    };
}

const INFO = { owner_id: '10', repo_name: 'first-project' };

// --- config resolution -----------------------------------------------------

test('web.base_url is an allowed config key with its own default and env var', () => {
    assert.equal(userConfig.isAllowedKey('web.base_url'), true);
    assert.equal(userConfig.DEFAULTS['web.base_url'], 'https://gent-nu2e.onrender.com');
    assert.equal(userConfig.ENV_OVERRIDES['web.base_url'], 'GENT_WEB_URL');
});

test('web.base_url is distinct from api.base_url', () => {
    assert.notEqual(
        userConfig.DEFAULTS['web.base_url'],
        userConfig.DEFAULTS['api.base_url'],
    );
});

test('default host is used when nothing is configured', withIsolatedConfig(async () => {
    const base = await webUrls.getWebBaseUrl();
    assert.equal(base, 'https://gent-nu2e.onrender.com');
}));

test('stored config overrides the default host', withIsolatedConfig(async () => {
    await userConfig.set('web.base_url', 'https://web.gent.test');
    assert.equal(await webUrls.getWebBaseUrl(), 'https://web.gent.test');
}));

// --- validation ------------------------------------------------------------
// A scheme-less value is the realistic typo. Without validation it yields a
// relative path that looks like a link but isn't one, which is the exact class
// of bug this module exists to prevent.

for (const bad of ['gent.example.com', '///', '   ', 'not a url']) {
    test(`rejects invalid web.base_url ${JSON.stringify(bad)}`, withIsolatedConfig(async () => {
        process.env.GENT_WEB_URL = bad;
        await assert.rejects(
            () => webUrls.getWebBaseUrl(),
            /Invalid web\.base_url/,
            `expected ${JSON.stringify(bad)} to be rejected`,
        );
    }));
}

test('an empty GENT_WEB_URL is treated as unset, not as invalid', withIsolatedConfig(async () => {
    process.env.GENT_WEB_URL = '';
    assert.equal(await webUrls.getWebBaseUrl(), userConfig.DEFAULTS['web.base_url']);
}));

test('rejects non-http(s) schemes', withIsolatedConfig(async () => {
    for (const bad of ['javascript:alert(1)', 'file:///etc/passwd', 'ftp://x.test']) {
        process.env.GENT_WEB_URL = bad;
        await assert.rejects(() => webUrls.getWebBaseUrl(), /Invalid web\.base_url/);
    }
}));

test('shell metacharacters in the base URL never reach a shell', withIsolatedConfig(async () => {
    // Regression guard for the exec() injection: this value is a valid URL, so
    // it passes validation — safety comes from execFile passing it as argv.
    process.env.GENT_WEB_URL = 'https://x.test/a";touch /tmp/gent_pwn_guard;"';
    const base = await webUrls.getWebBaseUrl();
    const url = webUrls.repoUrl(base, '1', 'r');
    assert.ok(url.startsWith('https://x.test/'), `unexpected base: ${url}`);
    const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'commands', 'web.js'), 'utf8');
    assert.ok(!/\bexec\(/.test(src), 'web.js must not call exec() — use execFile so no shell parses the URL');
    assert.ok(/execFile\(/.test(src), 'web.js should launch the browser via execFile');
}));

test('surfaces the trailing slash and normalizes via the URL parser', withIsolatedConfig(async () => {
    process.env.GENT_WEB_URL = 'https://web.gent.test/';
    assert.equal(await webUrls.getWebBaseUrl(), 'https://web.gent.test');
}));

test('GENT_WEB_URL env var overrides stored config', withIsolatedConfig(async () => {
    await userConfig.set('web.base_url', 'https://web.gent.test');
    process.env.GENT_WEB_URL = 'http://localhost:4000';
    assert.equal(await webUrls.getWebBaseUrl(), 'http://localhost:4000');
}));

test('a trailing slash on the configured host is stripped', withIsolatedConfig(async () => {
    await userConfig.set('web.base_url', 'https://web.gent.test/');
    assert.equal(await webUrls.getWebBaseUrl(), 'https://web.gent.test');
    assert.equal(
        webUrls.repoUrl('https://web.gent.test///', 10, 'demo'),
        'https://web.gent.test/dashboard/repository/10/demo',
    );
}));

// --- route shape -----------------------------------------------------------

test('repo path matches the route the frontend actually serves', () => {
    assert.equal(
        webUrls.repoPath(10, 'first-project'),
        '/dashboard/repository/10/first-project',
    );
});

test('repo URL never points at the API host', withIsolatedConfig(async () => {
    const base = await webUrls.getWebBaseUrl();
    const { url } = webUrls.buildRepoLink(base, INFO);
    assert.equal(url, 'https://gent-nu2e.onrender.com/dashboard/repository/10/first-project');
    assert.ok(!url.includes('gent-api.onrender.com'));
    assert.ok(!url.includes('/api/'));
}));

test('owner id and repo name are URL-encoded', () => {
    assert.equal(
        webUrls.repoUrl('https://web.gent.test', 10, 'my repo/x'),
        'https://web.gent.test/dashboard/repository/10/my%20repo%2Fx',
    );
});

// --- branch / commit fallback ---------------------------------------------

test('--branch falls back to the repo page and reports it as unsupported', () => {
    const { url, unsupported } = webUrls.buildRepoLink(
        'https://web.gent.test', INFO, { branch: 'feature/x' },
    );
    assert.equal(unsupported, 'branch');
    assert.equal(url, 'https://web.gent.test/dashboard/repository/10/first-project');
    assert.ok(!url.includes('/tree/'));
});

test('--commit falls back to the repo page and reports it as unsupported', () => {
    const { url, unsupported } = webUrls.buildRepoLink(
        'https://web.gent.test', INFO, { commit: 'abc1234' },
    );
    assert.equal(unsupported, 'commit');
    assert.equal(url, 'https://web.gent.test/dashboard/repository/10/first-project');
    assert.ok(!url.includes('/commit/'));
});

test('commit takes precedence over branch when both are given', () => {
    const { unsupported } = webUrls.buildRepoLink(
        'https://web.gent.test', INFO, { branch: 'main', commit: 'abc1234' },
    );
    assert.equal(unsupported, 'commit');
});

test('no target reports nothing unsupported', () => {
    const { unsupported } = webUrls.buildRepoLink('https://web.gent.test', INFO);
    assert.equal(unsupported, null);
});
