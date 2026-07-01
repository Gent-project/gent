/**
 * ============================================================================
 * Explain Command - Plain-language summary of a commit or pending changes
 * ============================================================================
 *
 * PURPOSE:
 *   Turn a diff into a human explanation. With an API key set this uses Claude;
 *   without one it still prints the unified diff plus a hint, so the command is
 *   useful either way.
 *
 * USAGE:
 *   gent explain            → explain the latest commit (HEAD)
 *   gent explain <ref>      → explain a specific commit (full or short hash)
 *   gent explain --staged   → explain the currently staged changes
 *
 * ============================================================================
 */

const path = require('path');
const chalk = require('chalk');
const ora = require('ora');
const { getGentPath, readJSON } = require('../utils/fileSystem');
const { COMMITS_FILE, STAGING_FILE } = require('../utils/constants');
const { readBlobAsString, treeToMap } = require('../utils/hash-engine');
const { formatUnifiedDiff } = require('../utils/diff-engine');
const ai = require('../utils/ai-service');

const MAX_DIFF_CHARS = 12000;

function treeEntriesOf(commit) {
    if (!commit) return [];
    if (Array.isArray(commit.tree)) return commit.tree;
    return (commit.files || []).map(f => ({ name: f.path || f.name, hash: f.hash }));
}

/**
 * Build a unified-diff text between two trees (old → new).
 */
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
        try { if (oh) oldText = await readBlobAsString(gentPath, oh); } catch { /* binary/legacy */ }
        try { if (nh) newText = await readBlobAsString(gentPath, nh); } catch { /* binary/legacy */ }
        const d = formatUnifiedDiff(file, oldText, newText);
        if (d) parts.push(d);
    }
    return parts.join('\n\n');
}

async function explain(ref, options = {}) {
    try {
        const gentPath = await getGentPath();
        const repository = await readJSON(path.join(gentPath, COMMITS_FILE));
        const commits = repository.commits || [];
        const commitMap = new Map(commits.map(c => [c.hash, c]));

        let title;
        let diffText;

        if (options.staged) {
            const staging = await readJSON(path.join(gentPath, STAGING_FILE));
            const entries = staging.entries || [];
            if (entries.length === 0) {
                console.log(chalk.yellow('No staged changes to explain'));
                return;
            }
            const headHash = repository.branches[repository.currentBranch];
            const headTree = treeEntriesOf(commitMap.get(headHash));
            const stagedTree = entries
                .filter(e => e.status !== 'deleted')
                .map(e => ({ name: e.path, hash: e.hash }));
            // Overlay staged entries on the HEAD tree
            const overlay = new Map(headTree.map(e => [e.name, e.hash]));
            for (const e of entries) {
                if (e.status === 'deleted') overlay.delete(e.path);
                else overlay.set(e.path, e.hash);
            }
            title = 'Staged changes';
            diffText = await diffTrees(
                gentPath,
                headTree,
                [...overlay].map(([name, hash]) => ({ name, hash }))
            );
            void stagedTree;
        } else {
            const targetHash = ref
                ? (commits.find(c => c.hash === ref || c.hash.startsWith(ref)) || {}).hash
                : repository.branches[repository.currentBranch];
            const commit = targetHash ? commitMap.get(targetHash) : null;
            if (!commit) {
                console.log(chalk.yellow(ref ? `Commit '${ref}' not found` : 'No commits yet'));
                return;
            }
            const parent = commit.parent ? commitMap.get(commit.parent) : null;
            title = `Commit ${commit.hash.substring(0, 7)} — ${commit.message}`;
            diffText = await diffTrees(gentPath, treeEntriesOf(parent), treeEntriesOf(commit));
        }

        if (!diffText) {
            console.log(chalk.gray('No textual changes to explain.'));
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

        const spinner = ora(`Asking ${ai.getModel()} to explain...`).start();
        try {
            const explanation = await ai.explainChanges(trimmed);
            spinner.stop();
            console.log(explanation);
        } catch (err) {
            spinner.fail(chalk.yellow('AI request failed — showing the raw diff instead'));
            console.log(chalk.gray(`(${err.message})\n`));
            console.log(trimmed);
        }
    } catch (error) {
        if (error.code === 'ENOENT' && error.message.includes('.gent')) {
            console.error(chalk.red('Error: Not a gent repository'));
            console.log(chalk.yellow('\nRun "gent init" to initialize a repository'));
        } else {
            console.error(chalk.red('Error:'), error.message);
        }
        process.exit(1);
    }
}

module.exports = explain;
