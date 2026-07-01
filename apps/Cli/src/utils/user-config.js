/**
 * ============================================================================
 * User Config - Global per-user CLI settings (~/.gent/config.json)
 * ============================================================================
 *
 * PURPOSE:
 *   Persist CLI-wide settings that should NOT live in a project's .gent/ dir:
 *     - AI key, AI model
 *     - API base URL (so users can point at a local backend without code edits)
 *     - Default identity (name/email) used when project .gent/config.json lacks one
 *
 * RESOLUTION ORDER (used by getResolved):
 *     env var  >  ~/.gent/config.json  >  built-in default
 *
 * STORAGE:
 *   Plain JSON at ~/.gent/config.json. The AI key field is lightly obfuscated
 *   (AES via crypto-js, same scheme as auth-storage) so it isn't readable at a
 *   glance — not a real secret store, but better than plaintext on disk.
 *
 * KEYS (dot-notation):
 *     ai.api_key        Anthropic API key
 *     ai.model          Model id (e.g. claude-opus-4-7, claude-haiku-4-5)
 *     api.base_url      Backend base URL (e.g. http://localhost:8000)
 *     user.name         Default author name
 *     user.email        Default author email
 *
 * ============================================================================
 */

const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const CryptoJS = require('crypto-js');
const { GENT_DIR } = require('./constants');

const CONFIG_FILE_NAME = 'cli-config.json';
const SECRET_KEYS = new Set(['ai.api_key']);
const OBFUSCATION_KEY = 'gent-cli-config-v1';
const OBFUSCATION_PREFIX = 'enc:v1:';

const ALLOWED_KEYS = new Set([
    'ai.api_key',
    'ai.model',
    'api.base_url',
    'user.name',
    'user.email',
]);

const DEFAULTS = {
    'ai.model': 'claude-opus-4-7',
    'api.base_url': 'https://gent-api.onrender.com',
};

const ENV_OVERRIDES = {
    'ai.api_key': 'ANTHROPIC_API_KEY',
    'ai.model': 'GENT_AI_MODEL',
    'api.base_url': 'GENT_API_URL',
};

function getConfigPath() {
    return path.join(os.homedir(), GENT_DIR, CONFIG_FILE_NAME);
}

function obfuscate(plaintext) {
    if (typeof plaintext !== 'string' || plaintext.length === 0) return plaintext;
    return OBFUSCATION_PREFIX + CryptoJS.AES.encrypt(plaintext, OBFUSCATION_KEY).toString();
}

function deobfuscate(value) {
    if (typeof value !== 'string' || !value.startsWith(OBFUSCATION_PREFIX)) return value;
    try {
        const bytes = CryptoJS.AES.decrypt(value.slice(OBFUSCATION_PREFIX.length), OBFUSCATION_KEY);
        return bytes.toString(CryptoJS.enc.Utf8);
    } catch {
        return null;
    }
}

function setDeep(obj, dottedKey, value) {
    const parts = dottedKey.split('.');
    let cur = obj;
    for (let i = 0; i < parts.length - 1; i++) {
        if (typeof cur[parts[i]] !== 'object' || cur[parts[i]] === null) {
            cur[parts[i]] = {};
        }
        cur = cur[parts[i]];
    }
    cur[parts[parts.length - 1]] = value;
}

function getDeep(obj, dottedKey) {
    const parts = dottedKey.split('.');
    let cur = obj;
    for (const p of parts) {
        if (!cur || typeof cur !== 'object') return undefined;
        cur = cur[p];
    }
    return cur;
}

function unsetDeep(obj, dottedKey) {
    const parts = dottedKey.split('.');
    let cur = obj;
    for (let i = 0; i < parts.length - 1; i++) {
        if (!cur || typeof cur[parts[i]] !== 'object') return;
        cur = cur[parts[i]];
    }
    delete cur[parts[parts.length - 1]];
}

async function readRaw() {
    try {
        const raw = await fs.readFile(getConfigPath(), 'utf-8');
        return JSON.parse(raw);
    } catch {
        return {};
    }
}

async function writeRaw(data) {
    const dir = path.dirname(getConfigPath());
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(getConfigPath(), JSON.stringify(data, null, 2) + '\n', 'utf-8');
}

function isAllowedKey(key) {
    return ALLOWED_KEYS.has(key);
}

function listAllowedKeys() {
    return Array.from(ALLOWED_KEYS);
}

/**
 * Get raw stored value (decoded if secret). Does NOT consult env or defaults.
 */
async function get(key) {
    if (!isAllowedKey(key)) throw new Error(`Unknown config key: ${key}`);
    const data = await readRaw();
    const raw = getDeep(data, key);
    if (raw === undefined || raw === null) return undefined;
    if (SECRET_KEYS.has(key)) return deobfuscate(raw);
    return raw;
}

/**
 * Resolve a config value using: env > stored > default.
 * Returns { value, source } where source is 'env' | 'config' | 'default' | 'unset'.
 */
async function getResolved(key) {
    if (!isAllowedKey(key)) throw new Error(`Unknown config key: ${key}`);
    const envName = ENV_OVERRIDES[key];
    if (envName && process.env[envName]) {
        return { value: process.env[envName], source: 'env', envName };
    }
    const stored = await get(key);
    if (stored !== undefined && stored !== null && stored !== '') {
        return { value: stored, source: 'config' };
    }
    if (DEFAULTS[key] !== undefined) {
        return { value: DEFAULTS[key], source: 'default' };
    }
    return { value: undefined, source: 'unset' };
}

async function set(key, value) {
    if (!isAllowedKey(key)) {
        throw new Error(`Unknown config key '${key}'. Allowed: ${listAllowedKeys().join(', ')}`);
    }
    if (typeof value !== 'string') value = String(value);
    const data = await readRaw();
    const toStore = SECRET_KEYS.has(key) ? obfuscate(value) : value;
    setDeep(data, key, toStore);
    await writeRaw(data);
}

async function unset(key) {
    if (!isAllowedKey(key)) throw new Error(`Unknown config key: ${key}`);
    const data = await readRaw();
    unsetDeep(data, key);
    await writeRaw(data);
}

/**
 * Return all stored values (secrets masked) plus their resolved value/source.
 */
async function listAll() {
    const out = [];
    for (const key of listAllowedKeys()) {
        const resolved = await getResolved(key);
        const isSecret = SECRET_KEYS.has(key);
        const display = isSecret && resolved.value
            ? maskSecret(resolved.value)
            : resolved.value;
        out.push({
            key,
            value: display,
            rawValue: resolved.value,
            source: resolved.source,
            envName: resolved.envName,
            isSecret,
        });
    }
    return out;
}

function maskSecret(s) {
    if (!s || typeof s !== 'string') return s;
    if (s.length <= 12) return '****';
    return s.slice(0, 8) + '...' + s.slice(-4);
}

module.exports = {
    get,
    set,
    unset,
    getResolved,
    listAll,
    isAllowedKey,
    listAllowedKeys,
    getConfigPath,
    maskSecret,
    ENV_OVERRIDES,
    DEFAULTS,
};
