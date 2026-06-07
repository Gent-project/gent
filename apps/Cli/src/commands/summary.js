/**
 * ============================================================================
 * Summary Command - Repository health & statistics dashboard
 * ============================================================================
 *
 * PURPOSE:
 *   A one-glance overview of the repository — commits, branches, tags,
 *   contributors, tracked files, object-store size, most-changed files, last
 *   activity, and how far ahead of the remote the current branch is. Something
 *   plain git doesn't offer in a single command.
 *
 * USAGE:
 *   gent summary           → print the dashboard
 *   gent summary --ai      → also include a short AI-written health narrative
 *
 * ============================================================================
 */

const fs = require('fs').promises;
const path = require('path');
const chalk = require('chalk');
const boxen = require('boxen');
const { formatDistanceToNow } = require('date-fns');
const { getGentPath, readJSON, pathExists } = require('../utils/fileSystem');
const { COMMITS_FILE, CONFIG_FILE } = require('../utils/constants');
const { readBlobAsString } = require('../utils/hash-engine');
const { formatBytes } = require('../utils/helpers');
const ai = require('../utils/ai-service');

function treeEntriesOf(commit) {
    if (!commit) return [];
    if (Array.isArray(commit.tree)) return commit.tree;
    return (commit.files || []).map(f => ({ name: f.path || f.name, hash: f.hash }));
}

/** Recursively sum the byte size of the object store. */
async function objectStoreSize(gentPath) {
    const root = path.join(gentPath, 'objects');
    let total = 0;
    async function walk(dir) {
        let entries;
        try { entries = await fs.readdir(dir, { withFileTypes: true }); } catch { return; }
        for (const e of entries) {
            const full = path.join(dir, e.name);
            if (e.isDirectory()) await walk(full);
            else { try { total += (await fs.stat(full)).size; } catch { /* ignore */ } }
        }
    }
    await walk(root);
    return total;
}

/** Count change frequency per file across history (hash-only tree diff). */
function mostChangedFiles(commits, commitMap, limit = 5) {
    const counts = new Map();
    for (const c of commits) {
        const cur = new Map(treeEntriesOf(c).map(e => [e.name, e.hash]));
        const parent = c.parent ? commitMap.get(c.parent) : null;
        const prev = new Map(treeEntriesOf(parent).map(e => [e.name, e.hash]));
        const names = new Set([...cur.keys(), ...prev.keys()]);
        for (const name of names) {
            if (cur.get(name) !== prev.get(name)) counts.set(name, (counts.get(name) || 0) + 1);
        }
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit);
}

/** Count commits reachable from `head` not yet known to the remote ref. */
function aheadCount(commitMap, head, remoteRef) {
    if (!head) return 0;
    let cur = head, n = 0;
    const guard = new Set();
    while (cur && cur !== remoteRef && !guard.has(cur)) {
        guard.add(cur);
        const c = commitMap.get(cur);
        if (!c) break;
        n++;
        cur = c.parent;
    }
    return n;
}

async function summary(options = {}) {
    try {
        const gentPath = await getGentPath();
        const repository = await readJSON(path.join(gentPath, COMMITS_FILE));
        const configPath = path.join(gentPath, CONFIG_FILE);
        const config = (await pathExists(configPath)) ? await readJSON(configPath) : {};

        const commits = repository.commits || [];
        const commitMap = new Map(commits.map(c => [c.hash, c]));
        const branches = repository.branches || {};
        const currentBranch = repository.currentBranch || 'main';
        const tags = repository.tags || {};

        // Contributors
        const authors = new Map();
        for (const c of commits) {
            const key = `${c.author?.name || 'Unknown'} <${c.author?.email || 'unknown'}>`;
            authors.set(key, (authors.get(key) || 0) + 1);
        }
        const topAuthors = [...authors.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

        // Tracked files + lines of code (text blobs only)
        const headHash = branches[currentBranch];
        const headTree = treeEntriesOf(commitMap.get(headHash));
        let loc = 0;
        for (const e of headTree) {
            try { loc += (await readBlobAsString(gentPath, e.hash)).split('\n').length; } catch { /* binary */ }
        }

        const storeSize = await objectStoreSize(gentPath);
        const topChanged = mostChangedFiles(commits, commitMap);

        // Last activity
        const last = commits.reduce((acc, c) =>
            (!acc || new Date(c.timestamp) > new Date(acc.timestamp)) ? c : acc, null);

        // Ahead of remote (if known)
        const remoteRef = (config.remoteRefs || {})[`origin/${currentBranch}`];
        const ahead = remoteRef ? aheadCount(commitMap, headHash, remoteRef) : null;

        // ── Render ──
        const lines = [];
        lines.push(chalk.bold.cyan(config.repository?.name || path.basename(process.cwd())));
        if (config.repository?.description) lines.push(chalk.gray(config.repository.description));
        lines.push('');
        lines.push(`${chalk.bold('Branch:')}      ${chalk.green(currentBranch)}  ${chalk.gray(`(${Object.keys(branches).length} total)`)}`);
        lines.push(`${chalk.bold('Commits:')}     ${commits.length}`);
        lines.push(`${chalk.bold('Tags:')}        ${Object.keys(tags).length}`);
        lines.push(`${chalk.bold('Tracked:')}     ${headTree.length} file(s), ~${loc} lines`);
        lines.push(`${chalk.bold('Objects:')}     ${formatBytes(storeSize)}`);
        if (ahead !== null) lines.push(`${chalk.bold('Remote:')}      ${ahead === 0 ? chalk.green('up to date') : chalk.yellow(`${ahead} commit(s) ahead of origin/${currentBranch}`)}`);
        if (last) lines.push(`${chalk.bold('Last commit:')} ${formatDistanceToNow(new Date(last.timestamp), { addSuffix: true })}`);

        if (topAuthors.length) {
            lines.push('');
            lines.push(chalk.bold('Top contributors:'));
            for (const [name, n] of topAuthors) lines.push(`  ${chalk.green(String(n).padStart(4))}  ${name}`);
        }

        if (topChanged.length) {
            lines.push('');
            lines.push(chalk.bold('Most-changed files:'));
            for (const [name, n] of topChanged) lines.push(`  ${chalk.yellow(String(n).padStart(4))}  ${name}`);
        }

        console.log(boxen(lines.join('\n'), {
            padding: 1, margin: 1, borderStyle: 'round', borderColor: 'cyan', title: 'gent summary', titleAlignment: 'center'
        }));

        if (options.ai) {
            if (!ai.isEnabled()) {
                console.log(chalk.gray(ai.disabledHint()));
            } else {
                try {
                    const facts = lines.join('\n').replace(/\[[0-9;]*m/g, ''); // strip colors
                    const narrative = await ai.explainChanges(`Repository stats:\n${facts}\n\nGive a 2-3 sentence health assessment.`);
                    console.log(chalk.cyan(narrative));
                } catch (err) {
                    console.log(chalk.yellow(`AI summary failed: ${err.message}`));
                }
            }
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

module.exports = summary;
