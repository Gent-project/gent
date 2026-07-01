/**
 * Doctor Command - Health check for the gent CLI.
 *
 *   gent doctor              → run all checks
 *   gent doctor --ai         → also ping Anthropic with a 1-token request
 *
 * Each row prints PASS / WARN / FAIL plus a hint on how to fix the issue.
 */

const path = require('path');
const fs = require('fs').promises;
const chalk = require('chalk');
const axios = require('axios');
const packageJson = require('../../package.json');
const { GENT_DIR } = require('../utils/constants');
const userConfig = require('../utils/user-config');
const apiClient = require('../utils/api-client');
const authStorage = require('../utils/auth-storage');
const ai = require('../utils/ai-service');

const MIN_NODE_MAJOR = 18;

async function doctor(options = {}) {
    console.log(chalk.bold.cyan('\nGent CLI health check\n'));

    const checks = [];

    checks.push(await checkNodeVersion());
    checks.push(await checkCliVersion());
    checks.push(await checkRepo());
    checks.push(await checkAuth());
    checks.push(await checkApi());
    checks.push(await checkAiKey(!!options.ai));

    for (const c of checks) {
        printCheck(c);
    }

    const failed = checks.filter(c => c.status === 'fail').length;
    const warned = checks.filter(c => c.status === 'warn').length;
    const passed = checks.filter(c => c.status === 'pass').length;

    console.log();
    console.log(
        chalk.green(`  ${passed} pass`) + '  ' +
        chalk.yellow(`${warned} warn`) + '  ' +
        chalk.red(`${failed} fail`)
    );

    if (failed > 0) process.exit(1);
}

function printCheck(c) {
    const badge = c.status === 'pass' ? chalk.green('✓ PASS')
        : c.status === 'warn' ? chalk.yellow('! WARN')
        : chalk.red('✗ FAIL');
    console.log(`  ${badge}  ${chalk.bold(c.name)} ${chalk.gray(`— ${c.detail}`)}`);
    if (c.hint) console.log(chalk.gray(`           hint: ${c.hint}`));
}

async function checkNodeVersion() {
    const v = process.versions.node;
    const major = parseInt(v.split('.')[0], 10);
    if (major >= MIN_NODE_MAJOR) {
        return { name: 'Node version', status: 'pass', detail: `v${v}` };
    }
    return {
        name: 'Node version',
        status: 'fail',
        detail: `v${v} (need ≥${MIN_NODE_MAJOR})`,
        hint: `Install Node ${MIN_NODE_MAJOR}+ — e.g. via nvm.`,
    };
}

async function checkCliVersion() {
    return {
        name: 'Gent CLI',
        status: 'pass',
        detail: `v${packageJson.version}`,
    };
}

async function checkRepo() {
    const gentPath = path.join(process.cwd(), GENT_DIR);
    try {
        const stat = await fs.stat(gentPath);
        if (!stat.isDirectory()) throw new Error('not a directory');
        return { name: 'Repository (.gent)', status: 'pass', detail: gentPath };
    } catch {
        return {
            name: 'Repository (.gent)',
            status: 'warn',
            detail: 'not a gent repo (this directory)',
            hint: 'Run `gent init` to start a repo here, or cd into one.',
        };
    }
}

async function checkAuth() {
    const isAuth = await authStorage.isAuthenticated();
    if (!isAuth) {
        return {
            name: 'Authentication',
            status: 'warn',
            detail: 'not logged in',
            hint: 'Run `gent login` or `gent register`.',
        };
    }
    const user = await authStorage.getUser();
    const who = user ? `${user.email}` : 'unknown user';
    return { name: 'Authentication', status: 'pass', detail: who };
}

async function checkApi() {
    const { value: baseUrl, source } = await userConfig.getResolved('api.base_url');
    try {
        await axios.get(baseUrl, { timeout: 8000, validateStatus: () => true });
        return {
            name: 'Backend reachable',
            status: 'pass',
            detail: `${baseUrl}  [${source}]`,
        };
    } catch (err) {
        return {
            name: 'Backend reachable',
            status: 'fail',
            detail: `${baseUrl} → ${err.code || err.message}`,
            hint: 'If running a local server: `gent config set api.base_url http://localhost:8000`.',
        };
    }
}

async function checkAiKey(probe) {
    const { value: key, source } = await ai.resolveKey();
    if (!key) {
        return {
            name: 'AI key',
            status: 'warn',
            detail: 'not configured (AI features will be skipped, not failed)',
            hint: 'Run `gent config set ai.api_key <key>` or set ANTHROPIC_API_KEY.',
        };
    }

    if (!probe) {
        return {
            name: 'AI key',
            status: 'pass',
            detail: `present [${source}], model: ${await ai.resolveModel()} (use --ai to live-test)`,
        };
    }

    try {
        await ai.complete({ prompt: 'ping', maxTokens: 4 });
        return {
            name: 'AI key',
            status: 'pass',
            detail: `verified — model ${await ai.resolveModel()} responded`,
        };
    } catch (err) {
        return {
            name: 'AI key',
            status: 'fail',
            detail: err.message,
            hint: 'Re-check the key (`gent config set ai.api_key`) or model (`gent config set ai.model`).',
        };
    }
}

module.exports = doctor;
