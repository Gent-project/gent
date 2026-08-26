/**
 * ============================================================================
 * Log Command - Show commit history
 * ============================================================================
 *
 * PURPOSE:
 *   Display commit history with details, stats, and merge info. Like `git log`.
 *
 * USAGE:
 *   gent log                   → Show last 10 commits (detailed)
 *   gent log -n 20             → Show last 20 commits
 *   gent log --oneline         → Condensed one-line-per-commit view
 *   gent log --stat            → Include diffstat per commit
 *
 * ALGORITHM:
 *   Reads commits.json, filters by branch HEAD → parent chain, displays
 *   in reverse chronological order.
 *
 * BACKEND: none — fully local. Reads commits.json; makes no HTTP request.
 *
 * ============================================================================
 */

const path = require('path');
const chalk = require('chalk');
const { formatDistanceToNow } = require('date-fns');
const { getGentPath, readJSON } = require('../utils/fileSystem');
const { COMMITS_FILE } = require('../utils/constants');

/**
 * Show commit history
 * @param {Object} options - Command options
 */
async function log(options) {
    try {
        const gentPath = await getGentPath();
        const repository = await readJSON(path.join(gentPath, COMMITS_FILE));

        const commits = repository.commits || [];
        const currentBranch = repository.currentBranch || 'main';

        if (commits.length === 0) {
            console.log(chalk.yellow('No commits yet'));
            console.log(chalk.gray('Use "gent commit" to create your first commit'));
            return;
        }

        const limit = parseInt(options.number) || 10;

        // Walk branch chain for ordered display
        const headHash = repository.branches[currentBranch];
        const commitMap = new Map(commits.map(c => [c.hash, c]));
        const ordered = [];
        let cur = headHash;
        while (cur && ordered.length < limit) {
            const c = commitMap.get(cur);
            if (!c) break;
            ordered.push(c);
            cur = c.parent;
        }

        if (options.graph) {
            displayGraphLog(commits, headHash, repository.branches || {}, limit);
        } else if (options.oneline) {
            displayOnelineLog(ordered, headHash);
        } else {
            displayDetailedLog(ordered, headHash, currentBranch, options);
        }

    } catch (error) {
        if (error.code === 'ENOENT' && error.message.includes('.gent')) {
            console.error(chalk.red('Error: Not a gent repository'));
            console.log(chalk.yellow('\nℹ Run "gent init" to initialize a repository'));
        } else {
            console.error(chalk.red('Error:'), error.message);
        }
        process.exit(1);
    }
}

/**
 * Display detailed commit log
 */
function displayDetailedLog(commits, currentCommitHash, currentBranch, options) {
    console.log(chalk.bold.cyan(`\nCommit History (${currentBranch}):\n`));

    commits.forEach((commit, index) => {
        const isHead = commit.hash === currentCommitHash;
        const headLabel = isHead ? chalk.yellow.bold(' (HEAD)') : '';

        console.log(chalk.yellow(`commit ${commit.hash}`) + headLabel);
        if (commit.mergeParent) {
            console.log(chalk.gray(`Merge: ${commit.parent?.substring(0, 7)} ${commit.mergeParent.substring(0, 7)}`));
        }
        console.log(chalk.white(`Author: ${commit.author.name} <${commit.author.email}>`));
        console.log(chalk.white(`Date:   ${new Date(commit.timestamp).toLocaleString()}`));
        console.log(chalk.gray(`        (${formatDistanceToNow(new Date(commit.timestamp), { addSuffix: true })})`));
        if (commit.treeHash) {
            console.log(chalk.gray(`Tree:   ${commit.treeHash.substring(0, 7)}`));
        }
        console.log();
        console.log(chalk.white(`    ${commit.message}`));
        console.log();

        // Show stats if --stat flag or if commit has stats
        if (options && options.stat && commit.stats) {
            console.log(chalk.gray(`    ${commit.stats.filesChanged} file(s), `) +
                chalk.green(`+${commit.stats.insertions}`) + ' ' +
                chalk.red(`-${commit.stats.deletions}`));
        } else {
            const fileCount = commit.files ? commit.files.length : (commit.tree ? commit.tree.length : 0);
            console.log(chalk.gray(`    ${fileCount} file(s) in tree`));
        }

        if (index < commits.length - 1) {
            console.log(chalk.gray('    │'));
        }
        console.log();
    });
}

/**
 * Display a commit graph reachable from HEAD (parent + mergeParent edges),
 * ordered newest-first, with branch/HEAD decorations and merge annotations.
 * A simplified single-rail graph: merges are annotated rather than drawn as
 * separate lanes, which keeps the output readable in a terminal.
 */
function displayGraphLog(allCommits, headHash, branches, limit) {
    const map = new Map(allCommits.map(c => [c.hash, c]));

    // Reachable set from HEAD via both edges.
    const reachable = [];
    const seen = new Set();
    const stack = [headHash];
    while (stack.length) {
        const h = stack.pop();
        if (!h || seen.has(h)) continue;
        const c = map.get(h);
        if (!c) continue;
        seen.add(h);
        reachable.push(c);
        if (c.parent) stack.push(c.parent);
        if (c.mergeParent) stack.push(c.mergeParent);
    }
    reachable.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    const limited = reachable.slice(0, limit);

    // Branch labels by commit hash.
    const refs = new Map();
    for (const [name, hash] of Object.entries(branches)) {
        if (!hash) continue;
        if (!refs.has(hash)) refs.set(hash, []);
        refs.get(hash).push(name);
    }

    console.log(chalk.bold.cyan('\nCommit graph:\n'));
    limited.forEach((c, i) => {
        const headLabel = c.hash === headHash ? chalk.yellow.bold(' (HEAD)') : '';
        const refLabel = refs.has(c.hash) ? chalk.green(` (${refs.get(c.hash).join(', ')})`) : '';
        const time = chalk.gray(`(${formatDistanceToNow(new Date(c.timestamp), { addSuffix: true })})`);
        console.log(`${chalk.yellow('*')} ${chalk.yellow(c.hash.substring(0, 7))}${headLabel}${refLabel} ${c.message} ${time}`);
        if (c.mergeParent) {
            console.log(chalk.gray(`|\\  merge: ${(c.parent || '').substring(0, 7)} + ${c.mergeParent.substring(0, 7)}`));
        }
        if (i < limited.length - 1) console.log(chalk.gray('|'));
    });
    console.log();
}

/**
 * Display oneline commit log
 */
function displayOnelineLog(commits, currentCommitHash) {
    commits.forEach(commit => {
        const isHead = commit.hash === currentCommitHash;
        const headLabel = isHead ? chalk.yellow(' (HEAD)') : '';
        const shortHash = chalk.yellow(commit.hash.substring(0, 7));
        const message = chalk.white(commit.message);
        const timeAgo = chalk.gray(`(${formatDistanceToNow(new Date(commit.timestamp), { addSuffix: true })})`);

        console.log(`${shortHash}${headLabel} ${message} ${timeAgo}`);
    });
}

module.exports = log;
