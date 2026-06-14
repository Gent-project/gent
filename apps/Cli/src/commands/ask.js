/**
 * Ask Command - Plain-English Q&A about the current repo.
 *
 *   gent ask "what does this project do?"
 *   gent ask "who has touched src/server.js recently?"
 *   gent ask "what's pending on the current branch?"
 *
 * Builds a compact repo summary (README + last N commits + tree listing) and
 * sends it as context. Falls back to a useful text dump if no AI key is set.
 */

const path = require('path');
const chalk = require('chalk');
const ora = require('ora');
const { getGentPath, readJSON, pathExists } = require('../utils/fileSystem');
const fs = require('fs').promises;
const { COMMITS_FILE, CONFIG_FILE } = require('../utils/constants');
const ai = require('../utils/ai-service');

const MAX_CONTEXT_CHARS = 14000;
const MAX_COMMITS = 25;

async function ask(question, options = {}) {
    try {
        if (!question || !question.trim()) {
            console.error(chalk.red('Usage: gent ask "<your question>"'));
            process.exit(1);
        }

        const gentPath = await getGentPath();
        const context = await buildRepoContext(gentPath);

        if (!ai.isEnabled()) {
            console.log(chalk.yellow(ai.disabledHint()));
            console.log(chalk.gray('\nHere is the raw repo context you can pipe into another tool:\n'));
            console.log(context);
            return;
        }

        const spinner = ora(`Asking ${ai.getModel()}...`).start();
        try {
            const answer = await ai.complete({
                system:
                    'You are a senior engineer answering questions about a software repository. ' +
                    'Be concrete and concise. If the answer is not in the context, say so. ' +
                    'Reference filenames and short commit hashes when helpful.',
                prompt: `Repository context:\n\n${context}\n\nQuestion: ${question}`,
                maxTokens: 1024,
            });
            spinner.stop();
            console.log('\n' + answer + '\n');
        } catch (err) {
            spinner.fail(chalk.red(err.message));
            process.exit(1);
        }
    } catch (error) {
        if (error.code === 'ENOENT' && error.message.includes('.gent')) {
            console.error(chalk.red('Error: Not a gent repository'));
            console.log(chalk.yellow('Run "gent init" to initialize a repository'));
        } else {
            console.error(chalk.red('Error:'), error.message);
        }
        process.exit(1);
    }
}

async function buildRepoContext(gentPath) {
    const cwd = process.cwd();
    const parts = [];

    // Project name + description from config
    try {
        const config = await readJSON(path.join(gentPath, CONFIG_FILE));
        const repo = config.repository || {};
        parts.push(`# Project\nname: ${repo.name || '(unnamed)'}\ndescription: ${repo.description || ''}`);
    } catch { /* missing config — fine */ }

    // README if present (any case, common extensions)
    const readme = await findReadme(cwd);
    if (readme) {
        const text = await fs.readFile(readme.path, 'utf-8').catch(() => '');
        if (text) parts.push(`# README (${readme.rel})\n${text.slice(0, 4000)}`);
    }

    // Recent commits
    try {
        const repository = await readJSON(path.join(gentPath, COMMITS_FILE));
        const commits = (repository.commits || []).slice(-MAX_COMMITS).reverse();
        const branch = repository.currentBranch || 'main';
        const lines = commits.map(c =>
            `- ${(c.hash || '').slice(0, 7)} (${(c.author?.name || 'unknown')}): ${(c.message || '').split('\n')[0]}`
        );
        parts.push(`# Recent commits on '${branch}'\n${lines.join('\n')}`);
    } catch { /* no commits yet — fine */ }

    // Top-level layout
    try {
        const entries = await fs.readdir(cwd, { withFileTypes: true });
        const layout = entries
            .filter(e => !e.name.startsWith('.') && e.name !== 'node_modules')
            .map(e => e.isDirectory() ? `${e.name}/` : e.name)
            .slice(0, 60);
        parts.push(`# Top-level layout\n${layout.join('\n')}`);
    } catch { /* unreadable — fine */ }

    const joined = parts.join('\n\n');
    return joined.length > MAX_CONTEXT_CHARS
        ? joined.slice(0, MAX_CONTEXT_CHARS) + '\n... (context truncated)'
        : joined;
}

async function findReadme(cwd) {
    const candidates = ['README.md', 'readme.md', 'README.txt', 'README', 'README.rst'];
    for (const c of candidates) {
        const p = path.join(cwd, c);
        if (await pathExists(p)) return { path: p, rel: c };
    }
    return null;
}

module.exports = ask;
