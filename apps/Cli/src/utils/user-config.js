/**
 * ============================================================================
 * User Config - Global per-user CLI settings (~/.gent/config.json)
 * ============================================================================
 *
 * PURPOSE:
 *   Persist CLI-wide settings that should NOT live in a project's .gent/ dir:
 *     - API base URL (so users can point at a local backend without code edits)
 *     - Default identity (name/email) used when project .gent/config.json lacks one
 *
 * RESOLUTION ORDER (used by getResolved):
 *     env var  >  ~/.gent/config.json  >  built-in default
 *
 * STORAGE:
 *   Plain JSON at ~/.gent/config.json.
 *
 * KEYS (dot-notation):
 *     api.base_url      Backend base URL (e.g. http://localhost:8000)
 *     web.base_url      Web app (frontend) base URL (e.g. https://gent-nu2e.onrender.com)
 *                       Used by `gent web` / `gent share`. This is a SEPARATE
 *                       deployment from api.base_url — never derive one from
 *                       the other.
 *     user.name         Default author name
 *     user.email        Default author email
 *
 * ============================================================================
 */

const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const { GENT_DIR } = require('./constants');

const CONFIG_FILE_NAME = 'cli-config.json';
const SECRET_KEYS = new Set();

const ALLOWED_KEYS = new Set([
    'api.base_url',
    'web.base_url',
    'user.name',
    'user.email',
]);

const DEFAULTS = {
    'api.base_url': 'https://gent-api.onrender.com',
    // The frontend has no production deployment yet; the server's own
    // FRONTEND_URL setting defaults to the same value. Override with
    // `gent config set web.base_url <url>` or GENT_WEB_URL.
    'web.base_url': 'https://gent-nu2e.onrender.com',
};

const ENV_OVERRIDES = {
    'api.base_url': 'GENT_API_URL',
    'web.base_url': 'GENT_WEB_URL',
};

function getConfigPath() {
    return path.join(os.homedir(), GENT_DIR, CONFIG_FILE_NAME);
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
    setDeep(data, key, value);
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
