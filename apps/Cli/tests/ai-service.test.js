const test = require('node:test');
const assert = require('node:assert/strict');

const axios = require('axios');
const ai = require('../src/utils/ai-service');

const originalPost = axios.post;
const originalKey = process.env.OPENROUTER_API_KEY;
const originalModel = process.env.GENT_AI_MODEL;
const originalApiUrl = process.env.GENT_AI_API_URL;

test.afterEach(() => {
    axios.post = originalPost;
    if (originalKey === undefined) delete process.env.OPENROUTER_API_KEY;
    else process.env.OPENROUTER_API_KEY = originalKey;
    if (originalModel === undefined) delete process.env.GENT_AI_MODEL;
    else process.env.GENT_AI_MODEL = originalModel;
    if (originalApiUrl === undefined) delete process.env.GENT_AI_API_URL;
    else process.env.GENT_AI_API_URL = originalApiUrl;
});

test('calls OpenRouter directly with the fast task prompt', async () => {
    process.env.OPENROUTER_API_KEY = 'test-key';
    process.env.GENT_AI_MODEL = 'xiaomi/mimo-v2.5:nitro';
    delete process.env.GENT_AI_API_URL;
    axios.post = async (url, body, config) => {
        assert.equal(url, 'https://openrouter.ai/api/v1/chat/completions');
        assert.equal(body.model, 'xiaomi/mimo-v2.5:nitro');
        assert.equal(body.messages[1].content, 'review me');
        assert.match(body.messages[0].content, /Review fast/);
        assert.equal(Object.hasOwn(body, 'max_tokens'), false);
        assert.equal(body.reasoning.effort, 'low');
        assert.equal(config.headers.Authorization, 'Bearer test-key');
        return {
            data: { choices: [{ finish_reason: 'stop', message: { content: '  No blocking issues.  ' } }] },
        };
    };

    const result = await ai.complete({
        profile: 'review',
        prompt: 'review me',
        maxTokens: 80,
    });
    assert.equal(result, 'No blocking issues.');
});

test('local development key calls OpenRouter without Gent server authentication', async () => {
    process.env.OPENROUTER_API_KEY = 'test-key';
    assert.equal(ai.isEnabled(), true);
    assert.equal((await ai.resolveKey()).source, 'local CLI configuration (OpenRouter)');
});

test('unconfigured installations explain the one-time CLI setup', async () => {
    delete process.env.OPENROUTER_API_KEY;
    await ai.prime();
    assert.equal(ai.isEnabled(), false);
    assert.match(ai.disabledHint(), /gent ai configure/);
});

test('reports exhausted quota clearly', async () => {
    process.env.OPENROUTER_API_KEY = 'test-key';
    axios.post = async () => {
        const error = new Error('request failed');
        error.response = {
            status: 429,
            data: { error: { code: 'insufficient_quota' } },
        };
        throw error;
    };
    await assert.rejects(ai.complete({ prompt: 'hello' }), /no credits left/);
});

// OpenAI sends billing exhaustion as type=insufficient_quota with a distinct
// code; without matching both it fell through to the generic rate-limit text.
test('reports an exhausted credit balance as billing, not rate limiting', async () => {
    process.env.OPENROUTER_API_KEY = 'test-key';
    axios.post = async () => {
        const error = new Error('request failed');
        error.response = {
            status: 429,
            data: { error: { type: 'insufficient_quota', code: 'credit_balance_exhausted' } },
        };
        throw error;
    };
    await assert.rejects(ai.complete({ prompt: 'hello' }), /no credits left/);
});

test('reports genuine rate limiting separately', async () => {
    process.env.OPENROUTER_API_KEY = 'test-key';
    axios.post = async () => {
        const error = new Error('request failed');
        error.response = {
            status: 429,
            data: { error: { type: 'rate_limit_error', code: 'rate_limit_exceeded' } },
        };
        throw error;
    };
    await assert.rejects(ai.complete({ prompt: 'hello' }), /rate limited/);
});

test('does not impose a client-side output token limit', async () => {
    process.env.OPENROUTER_API_KEY = 'test-key';
    let sent = null;
    axios.post = async (_url, body) => {
        sent = body;
        return { data: { choices: [{ finish_reason: 'stop', message: { content: 'pong' } }] } };
    };
    await ai.complete({ prompt: 'ping', maxTokens: 8 });
    assert.equal(Object.hasOwn(sent, 'max_tokens'), false);
});

test('returns merged text with a brief conflict summary', async () => {
    process.env.OPENROUTER_API_KEY = 'test-key';
    axios.post = async () => ({
        data: {
            output: [{
                type: 'message',
                content: [{
                    type: 'output_text',
                    text: JSON.stringify({
                        merged: 'main\nfeature',
                        ours_summary: 'The current branch updates the main behavior.',
                        theirs_summary: 'The incoming branch adds the feature behavior.',
                        summary: 'Kept the main change and added the feature behavior.',
                    }),
                }],
            }],
        },
    });

    const result = await ai.resolveConflictHunk({
        fileName: 'app.txt',
        ours: 'main',
        theirs: 'feature',
    });
    assert.deepEqual(result, {
        merged: 'main\nfeature',
        oursSummary: 'The current branch updates the main behavior.',
        theirsSummary: 'The incoming branch adds the feature behavior.',
        summary: 'Kept the main change and added the feature behavior.',
    });
});

test('keeps plain-text merge responses compatible', () => {
    assert.deepEqual(ai.parseMergeResolution('main\nfeature'), {
        merged: 'main\nfeature',
        oursSummary: 'The current branch contributes the OURS lines shown above.',
        theirsSummary: 'The incoming branch contributes the THEIRS lines shown above.',
        summary: 'Combined the non-duplicate intent from both branches.',
    });
});

test('limits AI conflict summaries even when the model is verbose', () => {
    const result = ai.parseMergeResolution(JSON.stringify({
        merged: 'resolved',
        summary: Array.from({ length: 30 }, (_, index) => `word${index + 1}`).join(' '),
    }));
    assert.equal(result.summary.split(/\s+/).length, 24);
    assert.match(result.summary, /\.\.\.$/);
});
