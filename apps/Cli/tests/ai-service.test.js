const test = require('node:test');
const assert = require('node:assert/strict');

const axios = require('axios');
const ai = require('../src/utils/ai-service');

const originalPost = axios.post;
const originalKey = process.env.OPENAI_API_KEY;
const originalModel = process.env.GENT_AI_MODEL;
const originalApiUrl = process.env.GENT_AI_API_URL;

test.afterEach(() => {
    axios.post = originalPost;
    if (originalKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = originalKey;
    if (originalModel === undefined) delete process.env.GENT_AI_MODEL;
    else process.env.GENT_AI_MODEL = originalModel;
    if (originalApiUrl === undefined) delete process.env.GENT_AI_API_URL;
    else process.env.GENT_AI_API_URL = originalApiUrl;
});

test('calls OpenAI directly with the fast task prompt', async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    process.env.GENT_AI_MODEL = 'gpt-4.1-mini';
    delete process.env.GENT_AI_API_URL;
    axios.post = async (url, body, config) => {
        assert.equal(url, 'https://api.openai.com/v1/responses');
        assert.equal(body.model, 'gpt-4.1-mini');
        assert.equal(body.input, 'review me');
        assert.match(body.instructions, /Review fast/);
        assert.equal(body.max_output_tokens, 80);
        assert.equal(body.store, false);
        assert.equal(config.headers.Authorization, 'Bearer test-key');
        return {
            data: {
                output: [{
                    type: 'message',
                    content: [{ type: 'output_text', text: '  No blocking issues.  ' }],
                }],
            },
        };
    };

    const result = await ai.complete({
        profile: 'review',
        prompt: 'review me',
        maxTokens: 80,
    });
    assert.equal(result, 'No blocking issues.');
});

test('does not require Gent server authentication', async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    assert.equal(ai.isEnabled(), true);
    assert.equal((await ai.resolveKey()).source, 'local Gent installation');
});

test('does not reveal setup instructions when unavailable', async () => {
    delete process.env.OPENAI_API_KEY;
    assert.equal(ai.isEnabled(), false);
    await assert.rejects(ai.complete({ prompt: 'hello' }), /unavailable/);
    assert.doesNotMatch(ai.disabledHint(), /API[_ -]?key|OPENAI_API_KEY/i);
});

test('reports exhausted quota clearly', async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    axios.post = async () => {
        const error = new Error('request failed');
        error.response = {
            status: 429,
            data: { error: { code: 'insufficient_quota' } },
        };
        throw error;
    };
    await assert.rejects(ai.complete({ prompt: 'hello' }), /quota is exhausted/);
});
