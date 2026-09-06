/** Direct, low-latency OpenAI client for Gent's local AI commands. */

const axios = require('axios');

const API_URL = 'https://api.openai.com/v1/responses';
const DEFAULT_MODEL = 'gpt-4.1-mini';

const PROMPTS = Object.freeze({
    chat: 'Answer as a concise senior engineer. Use the repository context. Give the direct answer first.',
    review: 'Review fast. Return only concrete correctness, security, or regression risks, then brief fixes. If none, say "No blocking issues."',
    merge: 'Resolve this merge conflict fast. Preserve both intended behaviors. Return only the final merged text with no markdown fence or explanation.',
    commit: 'Write one concise conventional commit message. Return only the message.',
    explain: 'Explain this change briefly and concretely. Return short bullets only.',
    docs: 'Write concise, accurate repository documentation from only the supplied context.',
    changelog: 'Create a concise user-facing changelog. Group related changes and omit filler.',
    summary: 'Give a concise repository health assessment with the most important risk first.',
});

function getApiKey() {
    return process.env.OPENAI_API_KEY || null;
}

function getModel() {
    return process.env.GENT_AI_MODEL || DEFAULT_MODEL;
}

function getApiUrl() {
    return process.env.GENT_AI_API_URL || API_URL;
}

async function resolveKey() {
    const value = getApiKey();
    return { value, source: value ? 'local Gent installation' : 'unset' };
}

async function resolveModel() {
    return getModel();
}

async function prime() {
    return resolveKey();
}

function isEnabled() {
    return Boolean(getApiKey());
}

function disabledHint() {
    return 'Gent AI is unavailable in this CLI installation.';
}

function extractText(payload) {
    const chunks = [];
    for (const item of payload?.output || []) {
        if (item.type !== 'message') continue;
        for (const content of item.content || []) {
            if (content.type === 'output_text' && content.text) chunks.push(content.text);
        }
    }
    return chunks.join('').trim();
}

async function complete({ prompt, system, profile = 'chat', maxTokens = 1024 }) {
    const apiKey = getApiKey();
    if (!apiKey) throw new Error(disabledHint());

    const instructions = [PROMPTS[profile], system].filter(Boolean).join('\n\n');
    try {
        const response = await axios.post(getApiUrl(), {
            model: getModel(),
            input: prompt,
            instructions,
            max_output_tokens: maxTokens,
            store: false,
        }, {
            headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            timeout: 30000,
        });
        const text = extractText(response.data);
        if (!text) throw new Error('OpenAI returned an empty response');
        return text;
    } catch (error) {
        throw enrichAiError(error);
    }
}

function enrichAiError(error) {
    const status = error?.response?.status;
    const apiError = error?.response?.data?.error;
    if (status === 401 || status === 403) return new Error('Gent AI credential was rejected.');
    if (apiError?.code === 'insufficient_quota') return new Error('Gent AI quota is exhausted.');
    if (status === 429) return new Error('Gent AI is busy. Retry in a moment.');
    if (apiError?.message) return new Error(`Gent AI failed: ${apiError.message}`);
    return error;
}

async function suggestCommitMessage(diffSummary) {
    return complete({ profile: 'commit', prompt: diffSummary, maxTokens: 160 });
}

async function explainChanges(content, profile = 'explain') {
    return complete({ profile, prompt: content, maxTokens: 500 });
}

async function reviewChanges(content, context = '') {
    return complete({
        profile: 'review',
        system: context,
        prompt: content,
        maxTokens: 800,
    });
}

async function resolveConflictHunk({ base, ours, theirs, fileName }) {
    const prompt =
        `File: ${fileName || 'unknown'}\n` +
        `BASE:\n${base || '(none)'}\n\n` +
        `OURS:\n${ours}\n\n` +
        `THEIRS:\n${theirs}`;
    return complete({ profile: 'merge', prompt, maxTokens: 1400 });
}

module.exports = {
    PROMPTS,
    DEFAULT_MODEL,
    isEnabled,
    getModel,
    getApiKey,
    disabledHint,
    prime,
    resolveKey,
    resolveModel,
    complete,
    suggestCommitMessage,
    explainChanges,
    reviewChanges,
    resolveConflictHunk,
    extractText,
};
