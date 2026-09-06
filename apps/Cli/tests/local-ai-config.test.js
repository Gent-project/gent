const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const config = require('../src/utils/local-ai-config');

test('saves and replaces the local OpenAI key without changing other env values', async () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'gent-ai-config-'));
    const previousHome = process.env.HOME;
    const previousProfile = process.env.USERPROFILE;
    const previousKey = process.env.OPENROUTER_API_KEY;
    process.env.HOME = home;
    process.env.USERPROFILE = home;
    try {
        const gentDir = path.join(home, '.gent');
        fs.mkdirSync(gentDir);
        fs.writeFileSync(
            path.join(gentDir, '.env'),
            'GENT_AI_MODEL=gpt-4.1-mini\nOPENAI_API_KEY=sk-old-old-old-old-old-old\nGENT_HTTP_USER=keep-me\n'
        );
        const key = `sk-or-v1-${'a1b2c3d4'.repeat(8)}`;
        const savedPath = await config.saveApiKey(key);
        const content = fs.readFileSync(savedPath, 'utf8');
        // A model pinned for the previous provider must not survive reconfiguration.
        assert.doesNotMatch(content, /GENT_AI_MODEL=/);
        assert.doesNotMatch(content, /OPENAI_API_KEY=/);
        assert.match(content, /GENT_HTTP_USER=keep-me/);
        assert.equal((content.match(/OPENROUTER_API_KEY=/g) || []).length, 1);
        assert.match(content, new RegExp(`OPENROUTER_API_KEY=${key}`));
        assert.equal(fs.statSync(savedPath).mode & 0o777, 0o600);
        assert.equal(process.env.OPENROUTER_API_KEY, key);
        assert.equal(process.env.OPENAI_API_KEY, undefined);
    } finally {
        if (previousHome === undefined) delete process.env.HOME; else process.env.HOME = previousHome;
        if (previousProfile === undefined) delete process.env.USERPROFILE; else process.env.USERPROFILE = previousProfile;
        if (previousKey === undefined) delete process.env.OPENROUTER_API_KEY; else process.env.OPENROUTER_API_KEY = previousKey;
        fs.rmSync(home, { recursive: true, force: true });
    }
});

test('pins an explicit model and clears it when none is given', async () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'gent-ai-model-'));
    const previousHome = process.env.HOME;
    const previousProfile = process.env.USERPROFILE;
    const previousModel = process.env.GENT_AI_MODEL;
    process.env.HOME = home;
    process.env.USERPROFILE = home;
    try {
        const key = `sk-or-v1-${'a1b2c3d4'.repeat(8)}`;
        let content = fs.readFileSync(await config.saveApiKey(key, { model: 'vendor/model:tag' }), 'utf8');
        assert.match(content, /GENT_AI_MODEL=vendor\/model:tag/);
        assert.equal(process.env.GENT_AI_MODEL, 'vendor/model:tag');

        content = fs.readFileSync(await config.saveApiKey(key), 'utf8');
        assert.doesNotMatch(content, /GENT_AI_MODEL=/);
        assert.equal(process.env.GENT_AI_MODEL, undefined);
    } finally {
        if (previousHome === undefined) delete process.env.HOME; else process.env.HOME = previousHome;
        if (previousProfile === undefined) delete process.env.USERPROFILE; else process.env.USERPROFILE = previousProfile;
        if (previousModel === undefined) delete process.env.GENT_AI_MODEL; else process.env.GENT_AI_MODEL = previousModel;
        fs.rmSync(home, { recursive: true, force: true });
    }
});

test('rejects malformed keys', async () => {
    assert.equal(config.validateApiKey('not-a-key'), false);
    // An OpenAI-style key is no longer valid for the OpenRouter endpoint.
    assert.equal(config.validateApiKey(`sk-proj-${'a1b2c3d4'.repeat(6)}`), false);
    assert.equal(config.validateApiKey(`sk-or-v1-${'a1b2c3d4'.repeat(8)}`), true);
    await assert.rejects(config.saveApiKey('not-a-key'), /valid OpenRouter API key/);
});
