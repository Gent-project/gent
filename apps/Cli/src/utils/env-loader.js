/**
 * Env Loader - Load .env files into process.env before commands run.
 *
 * Precedence (lower wins — does NOT clobber existing env):
 *   1. process.env (real shell vars)            ← highest, untouched
 *   2. <cwd>/.env                                ← project-local
 *   3. ~/.gent/.env                              ← user-global
 *
 * No new dependency: a tiny KEY=VALUE parser (supports quoted values + comments).
 * Silently no-ops if files are missing or malformed.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { GENT_DIR } = require('./constants');

function parse(content) {
    const out = {};
    const lines = content.split(/\r?\n/);
    for (const raw of lines) {
        const line = raw.trim();
        if (!line || line.startsWith('#')) continue;
        const eq = line.indexOf('=');
        if (eq < 1) continue;
        const key = line.slice(0, eq).trim();
        let value = line.slice(eq + 1).trim();
        if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;

        if ((value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
        } else {
            const hash = value.indexOf(' #');
            if (hash !== -1) value = value.slice(0, hash).trim();
        }
        out[key] = value;
    }
    return out;
}

function loadOne(filePath) {
    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const parsed = parse(content);
        for (const [k, v] of Object.entries(parsed)) {
            if (process.env[k] === undefined) {
                process.env[k] = v;
            }
        }
    } catch {
        // Missing or unreadable — fine.
    }
}

function load() {
    loadOne(path.join(process.cwd(), '.env'));
    loadOne(path.join(os.homedir(), GENT_DIR, '.env'));
}

module.exports = { load, parse };
