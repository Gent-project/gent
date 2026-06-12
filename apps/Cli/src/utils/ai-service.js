/**
 * ============================================================================
 * AI Service - Optional, key-gated Claude integration (hybrid layer)
 * ============================================================================
 *
 * PURPOSE:
 *   Power Gent's *optional* "smart" features (commit-message suggestions, diff
 *   explanations, AI-assisted conflict resolution). Every feature has a
 *   reliable algorithmic path; this layer only activates when the user has set
 *   an API key, and degrades gracefully (never throws into a command) when it
 *   is absent or the request fails.
 *
 * ENABLEMENT:
 *   Either set ANTHROPIC_API_KEY in the environment, OR save it once with
 *   `gent config set ai.api_key <key>` (stored in ~/.gent/cli-config.json).
 *   Optionally pick a model with GENT_AI_MODEL or `gent config set ai.model`.
 *   Default model: claude-opus-4-7. For a cheaper / faster option try
 *   claude-haiku-4-5 or claude-sonnet-4-6.
 *
 * IMPLEMENTATION NOTE:
 *   Calls the Anthropic Messages API (POST /v1/messages) directly over the
 *   project's existing `axios` dependency, to honour Gent's "no new runtime
 *   dependencies" constraint. A production app would normally use the official
 *   `@anthropic-ai/sdk`; raw HTTP is a deliberate trade-off here because the AI
 *   layer is optional and self-contained.
 *
 * ============================================================================
 */

const axios = require('axios');
const userConfig = require('./user-config');

const API_URL = 'https://api.anthropic.com/v1/messages';
const API_VERSION = '2023-06-01';
const DEFAULT_MODEL = 'claude-opus-4-7';

// Per-process cache so repeated AI calls don't keep hitting disk.
let _resolvedKey;
let _resolvedKeySource;
let _resolvedModel;

async function resolveKey() {
    if (_resolvedKey !== undefined) {
        return { value: _resolvedKey, source: _resolvedKeySource };
    }
    const r = await userConfig.getResolved('ai.api_key');
    _resolvedKey = r.value || null;
    _resolvedKeySource = r.source;
    return { value: _resolvedKey, source: _resolvedKeySource };
}

async function resolveModel() {
    if (_resolvedModel) return _resolvedModel;
    const r = await userConfig.getResolved('ai.model');
    _resolvedModel = r.value || DEFAULT_MODEL;
    return _resolvedModel;
}

/**
 * Synchronous getter used in hot paths. Returns whatever was last resolved,
 * or falls back to env-only (the original behavior) on cold start.
 */
function getApiKey() {
    if (_resolvedKey !== undefined) return _resolvedKey;
    return process.env.ANTHROPIC_API_KEY || null;
}

function getModel() {
    if (_resolvedModel) return _resolvedModel;
    return process.env.GENT_AI_MODEL || DEFAULT_MODEL;
}

/**
 * Async pre-flight resolver — call once from a command before doing AI work
 * so isEnabled()/getModel() see the user-config values even if env is empty.
 */
async function prime() {
    await resolveKey();
    await resolveModel();
}

function isEnabled() {
    return !!getApiKey();
}

function disabledHint() {
    return 'AI features are off — save a key with `gent config set ai.api_key <key>` or set ANTHROPIC_API_KEY in your env.';
}

/**
 * Low-level single-shot completion. Returns the assistant's text.
 * @param {Object} opts
 * @param {String} opts.prompt - user content
 * @param {String} [opts.system] - system prompt
 * @param {Number} [opts.maxTokens]
 * @returns {Promise<String>}
 */
async function complete({ prompt, system, maxTokens = 1024, thinking = false }) {
    // Make sure env/config-stored values are resolved even if the caller
    // didn't prime() first.
    await prime();

    const apiKey = getApiKey();
    if (!apiKey) throw new Error('AI not enabled');

    const body = {
        model: getModel(),
        max_tokens: maxTokens,
        messages: [{ role: 'user', content: prompt }]
    };
    if (system) body.system = system;
    // Adaptive thinking — opt-in per caller. We leave display at the API
    // default ("omitted") so reasoning never leaks into CLI output; this just
    // lets the model think harder on complex tasks (review, conflict resolve)
    // without changing what the user sees.
    if (thinking) body.thinking = { type: 'adaptive' };

    try {
        const res = await axios.post(API_URL, body, {
            headers: {
                'x-api-key': apiKey,
                'anthropic-version': API_VERSION,
                'content-type': 'application/json'
            },
            timeout: 60000
        });

        const blocks = (res.data && res.data.content) || [];
        return blocks
            .filter(b => b.type === 'text')
            .map(b => b.text)
            .join('')
            .trim();
    } catch (err) {
        throw enrichAiError(err);
    }
}

/**
 * Wrap raw Anthropic errors with hints that actually help the user.
 */
function enrichAiError(err) {
    const status = err?.response?.status;
    const apiMsg = err?.response?.data?.error?.message || err?.response?.data?.message;
    if (status === 401) {
        return new Error('Anthropic rejected the API key (401). Check `gent config get ai.api_key` and try `gent ai test`.');
    }
    if (status === 404 || (apiMsg && /model/i.test(apiMsg))) {
        return new Error(`Anthropic rejected the model "${getModel()}" — set a valid one with \`gent config set ai.model claude-opus-4-7\`.`);
    }
    if (status === 429) {
        return new Error('Anthropic rate-limited the request (429). Retry in a moment or switch to a lighter model.');
    }
    if (apiMsg) return new Error(`AI request failed: ${apiMsg}`);
    return err;
}

// ─── High-level helpers ─────────────────────────────────

/**
 * Suggest a concise commit message from a staged diff / summary.
 * @param {String} diffSummary
 * @returns {Promise<String>}
 */
async function suggestCommitMessage(diffSummary) {
    const system =
        'You write clear, conventional git commit messages. Reply with ONLY the commit ' +
        'message: a concise imperative subject line (<=72 chars), optionally followed by ' +
        'a blank line and short body. No quotes, no preamble, no markdown fences.';
    const prompt = `Write a commit message for these staged changes:\n\n${diffSummary}`;
    return complete({ system, prompt, maxTokens: 512 });
}

/**
 * Explain a commit or diff in plain language.
 * @param {String} content - diff or commit details
 * @returns {Promise<String>}
 */
async function explainChanges(content) {
    const system =
        'You are a senior engineer explaining a code change to a teammate. Summarize what ' +
        'changed and why it matters in a few short bullet points. Be specific and concise.';
    const prompt = `Explain these changes:\n\n${content}`;
    return complete({ system, prompt, maxTokens: 1024 });
}

/**
 * Propose a resolution for a single merge-conflict hunk.
 * @param {Object} hunk - { base?, ours, theirs, fileName? }
 * @returns {Promise<String>} the suggested merged text (no conflict markers)
 */
async function resolveConflictHunk({ base, ours, theirs, fileName }) {
    const system =
        'You resolve git merge conflicts. Combine the intent of BOTH sides into a single ' +
        'correct version. Reply with ONLY the resolved file section — no conflict markers, ' +
        'no explanation, no markdown fences.';
    const prompt =
        `File: ${fileName || 'unknown'}\n\n` +
        `<<<<<<< BASE (common ancestor)\n${base || '(none)'}\n` +
        `======= OURS\n${ours}\n` +
        `======= THEIRS\n${theirs}\n>>>>>>>\n\n` +
        'Return the merged result for this section.';
    return complete({ system, prompt, maxTokens: 2048, thinking: true });
}

module.exports = {
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
    resolveConflictHunk,
    DEFAULT_MODEL,
};
