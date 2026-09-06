const fs = require('fs').promises;
const os = require('os');
const path = require('path');
const { GENT_DIR } = require('./constants');

const KEY_NAME = 'OPENROUTER_API_KEY';
// Written alongside the key so an install configured before the OpenRouter
// switch does not keep pinning a stale OpenAI model id.
const LEGACY_KEY_NAMES = ['OPENAI_API_KEY'];

function getEnvPath() {
    return path.join(os.homedir(), GENT_DIR, '.env');
}

function validateApiKey(value) {
    return typeof value === 'string' && /^sk-or-v1-[A-Za-z0-9]{32,}$/.test(value.trim());
}

async function saveApiKey(value, { model } = {}) {
    const apiKey = typeof value === 'string' ? value.trim() : '';
    if (!validateApiKey(apiKey)) throw new Error('Enter a valid OpenRouter API key beginning with sk-or-v1-.');

    const envPath = getEnvPath();
    const directory = path.dirname(envPath);
    const existing = await fs.readFile(envPath, 'utf8').catch(error => {
        if (error.code === 'ENOENT') return '';
        throw error;
    });
    const managed = [KEY_NAME, ...LEGACY_KEY_NAMES];
    const lines = existing
        .split(/\r?\n/)
        .filter(line => !managed.some(name => new RegExp(`^\\s*${name}\\s*=`).test(line)))
        // Drop any model pinned for a previous provider; the service default wins.
        .filter(line => !/^\s*GENT_AI_MODEL\s*=/.test(line));
    while (lines.length && lines[lines.length - 1] === '') lines.pop();
    lines.push(`${KEY_NAME}=${apiKey}`);
    if (model) lines.push(`GENT_AI_MODEL=${model}`);

    await fs.mkdir(directory, { recursive: true, mode: 0o700 });
    const temporary = `${envPath}.tmp-${process.pid}`;
    await fs.writeFile(temporary, lines.join('\n') + '\n', { encoding: 'utf8', mode: 0o600 });
    await fs.rename(temporary, envPath);
    await fs.chmod(envPath, 0o600);
    process.env[KEY_NAME] = apiKey;
    for (const name of LEGACY_KEY_NAMES) delete process.env[name];
    if (model) process.env.GENT_AI_MODEL = model;
    else delete process.env.GENT_AI_MODEL;
    return envPath;
}

module.exports = { getEnvPath, validateApiKey, saveApiKey, KEY_NAME };
