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
 *   Set ANTHROPIC_API_KEY in the environment to enable. Optionally set
 *   GENT_AI_MODEL to pick a model (default: claude-opus-4-8). For a cheaper /
 *   faster option set GENT_AI_MODEL=claude-haiku-4-5.
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

const API_URL = 'https://api.anthropic.com/v1/messages';
const API_VERSION = '2023-06-01';
const DEFAULT_MODEL = 'claude-opus-4-8';

/**
 * Resolve the API key (env only — keeps secrets out of the repo).
 * @returns {String|null}
 */
function getApiKey() {
    return process.env.ANTHROPIC_API_KEY || null;
}

/**
 * @returns {Boolean} whether AI features are enabled.
 */
function isEnabled() {
    return !!getApiKey();
}

/**
 * @returns {String} the model id to use.
 */
function getModel() {
    return process.env.GENT_AI_MODEL || DEFAULT_MODEL;
}

/**
 * One-line hint shown by commands when AI is requested but no key is set.
 * @returns {String}
 */
function disabledHint() {
    return 'AI features are off — set ANTHROPIC_API_KEY to enable (optional: GENT_AI_MODEL).';
}

/**
 * Low-level single-shot completion. Returns the assistant's text.
 * @param {Object} opts
 * @param {String} opts.prompt - user content
 * @param {String} [opts.system] - system prompt
 * @param {Number} [opts.maxTokens]
 * @returns {Promise<String>}
 */
async function complete({ prompt, system, maxTokens = 1024 }) {
    const apiKey = getApiKey();
    if (!apiKey) throw new Error('AI not enabled');

    const body = {
        model: getModel(),
        max_tokens: maxTokens,
        messages: [{ role: 'user', content: prompt }]
    };
    if (system) body.system = system;

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
    return complete({ system, prompt, maxTokens: 2048 });
}

module.exports = {
    isEnabled,
    getModel,
    disabledHint,
    complete,
    suggestCommitMessage,
    explainChanges,
    resolveConflictHunk
};
