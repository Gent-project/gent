/**
 * Review Command - AI code review on staged or HEAD changes.
 *
 *   gent review                → review staged changes (or HEAD if no staging)
 *   gent review --staged       → force staged
 *   gent review --head         → force HEAD commit diff
 *   gent review <ref>          → review diff for that commit
 *
 * Output: prioritized bug/risk list followed by smaller polish suggestions.
 * Without an AI key, prints the raw diff so the command still has value.
 */

const path = require('path');
const chalk = require('chalk');
const ora = require('ora');
const { getGentPath, readJSON } = require('../utils/fileSystem');
const { COMMITS_FILE, STAGING_FILE } = require('../utils/constants');
const { readBlobAsString, treeToMap } = require('../utils/hash-engine');
const { formatUnifiedDiff } = require('../utils/diff-engine');
const ai = require('../utils/ai-service');

const MAX_DIFF_CHARS = 16000;

async function review(refArg, options = {}) {
    try {
        const gentPath = await getGentPath();
        const repository = await readJSON(path.join(gentPath, COMMITS_FILE));
        const commits = repository.commits || [];
        const commitMap = new Map(commits.map(c => [c.hash, c]));

        let title;
        let diffText;

        const explicitStaged = options.staged === true;
        const explicitHead = options.head === true;
        let useStaged = explicitStaged;

        if (!explicitStaged && !explicitHead && !refArg) {
            // Default: staged if anything is staged, else HEAD
            const staging = await readJSON(path.join(gentPath, STAGING_FILE)).catch(() => ({}));
            const entries = staging.entries || [];
            useStaged = entries.length > 0;
        }

        if (useStaged) {
            const result = await stagedDiff(gentPath, repository, commitMap);
            if (!result) {
                console.log(chalk.yellow('Nothing staged to review.'));
                return;
            }
            title = 'Staged changes';
            diffText = result;
        } else {
            const ref = refArg || repository.branches[repository.currentBranch];
            const commit = ref ? (commitMap.get(ref) || commits.find(c => c.hash.startsWith(ref))) : null;
            if (!commit) {
                console.log(chalk.yellow(ref ? `Commit '${ref}' not found` : 'No commits yet'));
                return;
            }
            const parent = commit.parent ? commitMap.get(commit.parent) : null;
            title = `Commit ${commit.hash.slice(0, 7)} — ${commit.message.split('\n')[0]}`;
            diffText = await diffTrees(gentPath, treeEntriesOf(parent), treeEntriesOf(commit));
        }

        if (!diffText) {
            console.log(chalk.gray('No textual changes to review.'));
            return;
        }

        const trimmed = diffText.length > MAX_DIFF_CHARS
            ? diffText.slice(0, MAX_DIFF_CHARS) + '\n... (diff truncated)'
            : diffText;

        console.log(chalk.bold.cyan(`\n${title}\n`));

        if (!ai.isEnabled()) {
            console.log(trimmed);
            console.log(chalk.gray(`\n${ai.disabledHint()}`));
            return;
        }

        const spinner = ora(`Reviewing with ${ai.getModel()}...`).start();
        try {
            const out = await ai.complete({
                system:
                    'You are a senior code reviewer. Given a unified diff, list concrete ' +
                    'issues you would block on, then smaller suggestions. Format:\n' +
                    '🔴 Bugs / risks\n  - file:line — short description\n' +
                    '🟡 Suggestions\n  - file — short description\n' +
                    '🟢 Looks good\n  - one-line positive note\n' +
                    'Be specific. If nothing is wrong, say so plainly.',
                prompt: `Review this diff:\n\n${trimmed}`,
                maxTokens: 1500,
                thinking: true,
            });
            spinner.stop();
            console.log(out + '\n');
        } catch (err) {
            spinner.fail(chalk.yellow('AI review failed — showing the raw diff instead'));
            console.log(chalk.gray(`(${err.message})\n`));
            console.log(trimmed);
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

function treeEntriesOf(commit) {
    if (!commit) return [];
    if (Array.isArray(commit.tree)) return commit.tree;
    return (commit.files || []).map(f => ({ name: f.path || f.name, hash: f.hash }));
}

async function diffTrees(gentPath, oldEntries, newEntries) {
    const oldMap = treeToMap(oldEntries);
    const newMap = treeToMap(newEntries);
    const files = new Set([...oldMap.keys(), ...newMap.keys()]);
    const parts = [];
    for (const file of files) {
        const oh = oldMap.get(file);
        const nh = newMap.get(file);
        if (oh === nh) continue;
        let oldText = '', newText = '';
        try { if (oh) oldText = await readBlobAsString(gentPath, oh); } catch { /* binary */ }
        try { if (nh) newText = await readBlobAsString(gentPath, nh); } catch { /* binary */ }
        const d = formatUnifiedDiff(file, oldText, newText);
        if (d) parts.push(d);
    }
    return parts.join('\n\n');
}

async function stagedDiff(gentPath, repository, commitMap) {
    const staging = await readJSON(path.join(gentPath, STAGING_FILE)).catch(() => ({}));
    const entries = staging.entries || [];
    if (entries.length === 0) return null;

    const headHash = repository.branches[repository.currentBranch];
    const head = headHash ? commitMap.get(headHash) : null;
    const headTree = treeEntriesOf(head);
    const overlay = new Map(headTree.map(e => [e.name, e.hash]));
    for (const e of entries) {
        if (e.status === 'deleted') overlay.delete(e.path);
        else overlay.set(e.path, e.hash);
    }
    return diffTrees(
        gentPath,
        headTree,
        [...overlay].map(([name, hash]) => ({ name, hash }))
    );
}

module.exports = review;
