/**
 * Changelog Command - AI-grouped changelog between two refs.
 *
 *   gent changelog                 → since the most recent tag (or last 50 commits)
 *   gent changelog <from>..<to>    → commits between two refs
 *   gent changelog <from>          → from <from> to HEAD
 *   gent changelog --plain         → flat list, no AI grouping
 */

const path = require('path');
const chalk = require('chalk');
const ora = require('ora');
const { getGentPath, readJSON } = require('../utils/fileSystem');
const { COMMITS_FILE } = require('../utils/constants');
const ai = require('../utils/ai-service');

const MAX_COMMITS = 200;

async function changelog(range, options = {}) {
    try {
        const gentPath = await getGentPath();
        const repository = await readJSON(path.join(gentPath, COMMITS_FILE));
        const commits = repository.commits || [];
        if (commits.length === 0) {
            console.log(chalk.yellow('No commits yet.'));
            return;
        }

        const { from, to } = resolveRange(range, repository);
        const selected = commitsBetween(commits, from, to);

        if (selected.length === 0) {
            console.log(chalk.yellow('No commits in the requested range.'));
            return;
        }

        const header = `${chalk.bold.cyan('Changelog')}  ${chalk.gray(
            `${(from || 'root').slice(0, 7)}..${(to || 'HEAD').slice(0, 7)}  ` +
            `(${selected.length} commits)`
        )}`;
        console.log('\n' + header + '\n');

        if (options.plain || !ai.isEnabled()) {
            for (const c of selected) {
                const short = (c.hash || '').slice(0, 7);
                const subject = (c.message || '').split('\n')[0];
                console.log(`  ${chalk.gray(short)} ${subject}`);
            }
            if (!ai.isEnabled()) {
                console.log(chalk.gray(`\n${ai.disabledHint()}`));
            }
            return;
        }

        const summary = selected.map(c =>
            `- ${(c.hash || '').slice(0, 7)}: ${(c.message || '').split('\n')[0]}`
        ).join('\n');

        const spinner = ora(`Grouping with ${ai.getModel()}...`).start();
        try {
            const out = await ai.complete({
                system:
                    'You write release-note-style changelogs. Group commits into ' +
                    'Features / Fixes / Improvements / Other. Keep each bullet to one line ' +
                    'and start with a verb. Drop merge commits and noise. Reply with Markdown.',
                prompt: `Commits (newest first):\n\n${summary}`,
                maxTokens: 1500,
            });
            spinner.stop();
            console.log(out + '\n');
        } catch (err) {
            spinner.fail(chalk.yellow('AI grouping failed — falling back to plain list'));
            console.log(chalk.gray(`(${err.message})\n`));
            for (const c of selected) {
                console.log(`  ${chalk.gray((c.hash || '').slice(0, 7))} ${(c.message || '').split('\n')[0]}`);
            }
        }
    } catch (error) {
        if (error.code === 'ENOENT' && error.message.includes('.gent')) {
            console.error(chalk.red('Error: Not a gent repository'));
        } else {
            console.error(chalk.red('Error:'), error.message);
        }
        process.exit(1);
    }
}

function resolveRange(range, repository) {
    const head = repository.branches[repository.currentBranch] || null;
    if (!range) {
        // Use most recent tag if any, else null (means "all up to MAX_COMMITS")
        const tags = repository.tags || {};
        const tagHashes = Object.values(tags).map(t => t.hash || t.commit_sha).filter(Boolean);
        return { from: tagHashes[tagHashes.length - 1] || null, to: head };
    }
    if (range.includes('..')) {
        const [from, to] = range.split('..');
        return { from: from || null, to: to || head };
    }
    return { from: range, to: head };
}

function commitsBetween(commits, from, to) {
    const byHash = new Map(commits.map(c => [c.hash, c]));
    const startHash = to || (commits[commits.length - 1] || {}).hash;
    if (!startHash) return [];

    const result = [];
    let cur = startHash;
    const seen = new Set();
    while (cur && cur !== from && !seen.has(cur) && result.length < MAX_COMMITS) {
        const c = byHash.get(cur);
        if (!c) break;
        seen.add(cur);
        result.push(c);
        cur = c.parent;
    }
    return result; // newest first
}

module.exports = changelog;
