/** Direct, low-latency OpenRouter client for Gent's local AI commands. */

const axios = require('axios');

const API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_MODEL = 'xiaomi/mimo-v2.5:nitro';

const PROMPTS = Object.freeze({
    chat: 'Answer as a concise senior engineer. Use the repository context. Give the direct answer first.',
    review: 'Review fast. Return only concrete correctness, security, or regression risks, then brief fixes. If none, say "No blocking issues."',
    merge: 'Resolve this merge conflict carefully. Preserve both intended behaviors. Return only valid JSON with this shape: {"ours_summary":"specific description of what the current branch contributes, at most 24 words","theirs_summary":"specific description of what the incoming branch contributes, at most 24 words","merged":"final merged text","summary":"specific explanation of the merge decision, at most 24 words"}. Do not use markdown fences.',
    commit: 'Write one concise conventional commit message. Return only the message.',
    explain: 'Explain this change briefly and concretely. Return short bullets only.',
    docs: 'Write concise, accurate repository documentation from only the supplied context.',
    changelog: 'Create a concise user-facing changelog. Group related changes and omit filler.',
    summary: 'Give a concise repository health assessment with the most important risk first.',
});

function getApiKey() {
    // OPENAI_API_KEY stays readable so installs configured before the
    // OpenRouter switch keep working until they reconfigure.
    return process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY || null;
}

function getModel() {
    return process.env.GENT_AI_MODEL || DEFAULT_MODEL;
}

function getApiUrl() {
    return process.env.GENT_AI_API_URL || API_URL;
}

async function resolveKey() {
    const value = getApiKey();
    return { value, source: value ? 'local CLI configuration (OpenRouter)' : 'unset' };
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
    return 'Gent AI is unavailable. Run `gent ai configure` once on this computer.';
}

function extractText(payload) {
    const chunks = [];
    // OpenRouter / chat-completions shape.
    for (const choice of payload?.choices || []) {
        const content = choice?.message?.content;
        if (typeof content === 'string') {
            chunks.push(content);
        } else if (Array.isArray(content)) {
            for (const part of content) {
                if (typeof part?.text === 'string') chunks.push(part.text);
            }
        }
    }
    // Responses-API shape, still accepted so a custom GENT_AI_API_URL works.
    for (const item of payload?.output || []) {
        if (item.type !== 'message') continue;
        for (const content of item.content || []) {
            if (content.type === 'output_text' && content.text) chunks.push(content.text);
        }
    }
    return chunks.join('').trim();
}

function truncatedByBudget(payload) {
    return (payload?.choices || []).some(choice => choice?.finish_reason === 'length');
}

async function complete({ prompt, system, profile = 'chat', maxTokens = 1024 }) {
    const apiKey = getApiKey();
    if (!apiKey) throw new Error(disabledHint());
    const instructions = [PROMPTS[profile], system].filter(Boolean).join('\n\n');
    try {
        const response = await axios.post(getApiUrl(), {
            model: getModel(),
            messages: [
                ...(instructions ? [{ role: 'system', content: instructions }] : []),
                { role: 'user', content: prompt },
            ],
            // Do not impose a Gent-side output ceiling. Reasoning models can
            // consume a fixed max_tokens budget before producing visible text.
            // OpenRouter and the selected model still enforce their own limits.
            // Keep reasoning models brief; ignored by models without reasoning.
            reasoning: { effort: 'low' },
        }, {
            headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'https://github.com/gent-cli',
                'X-Title': 'Gent CLI',
            },
            timeout: 60000,
        });
        const text = extractText(response.data);
        if (!text) {
            throw new Error(truncatedByBudget(response.data)
                ? `Model "${getModel()}" reached its provider output limit before replying. Try again or set GENT_AI_MODEL to another model.`
                : `Model "${getModel()}" returned an empty response.`);
        }
        return text;
    } catch (error) {
        throw enrichAiError(error);
    }
}

function enrichAiError(error) {
    const status = error?.response?.status;
    const apiError = error?.response?.data?.error;
    const apiCode = typeof apiError === 'object' ? apiError?.code : null;
    const apiType = typeof apiError === 'object' ? apiError?.type : null;
    const quotaCodes = ['insufficient_quota', 'credit_balance_exhausted', 'billing_hard_limit_reached'];
    if (status === 401 || status === 403) return new Error('OpenRouter rejected the configured CLI credential. Run `gent ai configure` with a valid key.');
    if (status === 404) return new Error(`OpenRouter has no model "${getModel()}". Set GENT_AI_MODEL to a model id from https://openrouter.ai/models.`);
    if (status === 402 || quotaCodes.includes(apiCode) || quotaCodes.includes(apiType)) {
        return new Error('OpenRouter billing: this key has no credits left. Add credits at https://openrouter.ai/credits — the key itself is valid.');
    }
    if (status === 429) return new Error('Gent AI is rate limited. Retry in a moment.');
    if (apiError?.message) return new Error(`Gent AI failed: ${apiError.message}`);
    if (typeof apiError === 'string') return new Error(apiError);
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
    const response = await complete({ profile: 'merge', prompt, maxTokens: 1400 });
    return parseMergeResolution(response);
}

function parseMergeResolution(response) {
    const cleaned = response
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/, '')
        .trim();
    try {
        const parsed = JSON.parse(cleaned);
        if (typeof parsed.merged !== 'string') throw new Error('missing merged text');
        return {
            merged: parsed.merged,
            oursSummary: briefSummary(parsed.ours_summary, 'The current branch contributes the OURS lines shown above.'),
            theirsSummary: briefSummary(parsed.theirs_summary, 'The incoming branch contributes the THEIRS lines shown above.'),
            summary: briefSummary(parsed.summary, 'Combined the non-duplicate intent from both branches.'),
        };
    } catch {
        return {
            merged: response,
            oursSummary: 'The current branch contributes the OURS lines shown above.',
            theirsSummary: 'The incoming branch contributes the THEIRS lines shown above.',
            summary: 'Combined the non-duplicate intent from both branches.',
        };
    }
}

function briefSummary(value, fallback = 'Combined the conflicting changes.') {
    const summary = typeof value === 'string'
        ? value.replace(/\s+/g, ' ').trim()
        : '';
    if (!summary) return fallback;
    const words = summary.split(' ');
    const wordLimited = words.length <= 24
        ? summary
        : `${words.slice(0, 24).join(' ')}...`;
    return wordLimited.length <= 160
        ? wordLimited
        : `${wordLimited.slice(0, 157).trimEnd()}...`;
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
    parseMergeResolution,
    extractText,
};
