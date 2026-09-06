const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const authStorage = require('../src/utils/auth-storage');

const LEGACY_FIXTURE = 'U2FsdGVkX18AESIzRFVmd6+RNfrtQbSBwUgcUHjf0v4MzF8ff1c/cJR2YfzTIo1z/VGAJTAWyjspGIFTAoUVf0YuxebNUXIxNwj0FJcGWfDiOtWUygnBcKMXXwbrwTAD5BYbNTQMfx1ifs+p0McHzzqBj3c8C0Yp3Zj4QIUkhePBIoW34vzSQLWiwSAhhFVENNVrkNlUTs6426n11JSosQ==';

async function withHome(run) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gent-auth-storage-'));
    const previousHome = process.env.HOME;
    const previousProfile = process.env.USERPROFILE;
    process.env.HOME = root;
    process.env.USERPROFILE = root;
    try {
        await run(root);
    } finally {
        if (previousHome === undefined) delete process.env.HOME; else process.env.HOME = previousHome;
        if (previousProfile === undefined) delete process.env.USERPROFILE; else process.env.USERPROFILE = previousProfile;
        fs.rmSync(root, { recursive: true, force: true });
    }
}

test('stores authenticated data with built-in AES-GCM and mode 600', async () => {
    await withHome(async root => {
        await authStorage.saveTokens('access', 'refresh', { email: 'user@example.test' });
        const authPath = path.join(root, '.gent', 'auth.json');
        const stored = JSON.parse(fs.readFileSync(authPath, 'utf8'));
        assert.match(stored.data, /^v2:/);
        assert.equal(fs.statSync(authPath).mode & 0o777, 0o600);
        assert.equal(await authStorage.getAccessToken(), 'access');
        assert.equal(await authStorage.getRefreshToken(), 'refresh');
        assert.deepEqual(await authStorage.getUser(), { email: 'user@example.test' });
    });
});

test('reads auth files written by the former CryptoJS implementation', async () => {
    await withHome(async root => {
        const gentDir = path.join(root, '.gent');
        fs.mkdirSync(gentDir);
        fs.writeFileSync(path.join(gentDir, 'auth.json'), JSON.stringify({ data: LEGACY_FIXTURE }));
        assert.equal(await authStorage.getAccessToken(), 'legacy-access');
        assert.equal(await authStorage.getRefreshToken(), 'legacy-refresh');
        assert.deepEqual(await authStorage.getUser(), { email: 'legacy@example.test' });
    });
});
