/**
 * ============================================================================
 * Show Command - Show details of a commit, tag, or tree
 * ============================================================================
 *
 * PURPOSE:
 *   Display detailed information about a specific commit including author,
 *   message, tree hash, parent, and full diff. Like `git show`.
 *
 * USAGE:
 *   gent show                  → Show HEAD commit details with diff
 *   gent show <hash>           → Show specific commit
 *   gent show <tag>            → Show commit referenced by tag
 *
 * ALGORITHM:
 *   Retrieves commit from commits.json, reads blob content from object store,
 *   computes diff against parent commit's tree, and displays unified diff.
 *
 * BACKEND: none — fully local. Reads commits.json + the local object store.
 *   (Remote commit_detail returns { sha, tree_sha, parent_shas[], author_name,
 *    author_email, committed_at, message } — tree_sha is a bare string, no embedded tree.)
 *
 * ============================================================================
 */

const path = require('path');
const chalk = require('chalk');
const { getGentPath, readJSON } = require('../utils/fileSystem');
const { COMMITS_FILE } = require('../utils/constants');
const { readBlobAsString } = require('../utils/hash-engine');
const { formatUnifiedDiff } = require('../utils/diff-engine');

/**
 * Show commit details
 * @param {String} ref - Commit hash, tag name, or empty for HEAD
 * @param {Object} options
 */
async function show(ref, options) {
    try {
        const gentPath = await getGentPath();
        const repository = await readJSON(path.join(gentPath, COMMITS_FILE));
        const commits = repository.commits || [];
        const tags = repository.tags || {};

        let targetHash = ref;

        // Default to HEAD
        if (!targetHash) {
            targetHash = repository.branches[repository.currentBranch];
            if (!targetHash) {
                console.log(chalk.yellow('No commits yet'));
                return;
            }
        }

        // Resolve tag name → hash
        if (tags[targetHash]) {
            targetHash = tags[targetHash].hash;
        }

        // Find commit (support short hashes)
        const commit = commits.find(c =>
            c.hash === targetHash || c.hash.startsWith(targetHash)
        );

        if (!commit) {
            console.error(chalk.red(`Commit '${ref || 'HEAD'}' not found`));
            return;
        }

        // Display commit header
        console.log(chalk.yellow(`commit ${commit.hash}`));
        if (commit.mergeParent) {
            console.log(chalk.gray(`Merge: ${commit.parent?.substring(0, 7)} ${commit.mergeParent.substring(0, 7)}`));
        }
        console.log(chalk.white(`Author: ${commit.author.name} <${commit.author.email}>`));
        console.log(chalk.white(`Date:   ${new Date(commit.timestamp).toLocaleString()}`));
        if (commit.treeHash) {
            console.log(chalk.gray(`Tree:   ${commit.treeHash.substring(0, 7)}`));
        }
        console.log('');
        console.log(chalk.white(`    ${commit.message}`));
        console.log('');

        if (commit.stats) {
            console.log(chalk.gray(`    ${commit.stats.filesChanged} file(s), `) +
                chalk.green(`+${commit.stats.insertions}`) + ' ' +
                chalk.red(`-${commit.stats.deletions}`));
            console.log('');
        }

        // Show diff against parent
        if (!options.noPatch) {
            await showCommitDiff(gentPath, commits, commit);
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

/**
 * Display diff between commit and its parent
 */
async function showCommitDiff(gentPath, commits, commit) {
    const parentCommit = commit.parent
        ? commits.find(c => c.hash === commit.parent)
        : null;

    const currentTree = commit.tree || (commit.files || []).map(f => ({
        name: f.path || f.name, hash: f.hash
    }));
    const parentTree = parentCommit
        ? (parentCommit.tree || (parentCommit.files || []).map(f => ({
            name: f.path || f.name, hash: f.hash
        })))
        : [];

    const parentMap = new Map(parentTree.map(f => [f.name || f.path, f.hash]));
    const currentMap = new Map(currentTree.map(f => [f.name || f.path, f.hash]));

    // Files changed
    const allPaths = new Set([...parentMap.keys(), ...currentMap.keys()]);

    for (const filePath of allPaths) {
        const oldHash = parentMap.get(filePath);
        const newHash = currentMap.get(filePath);

        if (oldHash === newHash) continue;

        try {
            const oldContent = oldHash ? await readBlobAsString(gentPath, oldHash) : '';
            const newContent = newHash ? await readBlobAsString(gentPath, newHash) : '';

            const unified = formatUnifiedDiff(filePath, oldContent, newContent);
            if (unified) {
                printColorizedDiff(unified);
            }
        } catch {
            // Blob missing for legacy commits
            if (!oldHash && newHash) {
                console.log(chalk.green(`+ new file: ${filePath}`));
            } else if (oldHash && !newHash) {
                console.log(chalk.red(`- deleted: ${filePath}`));
            } else {
                console.log(chalk.yellow(`~ modified: ${filePath} (blob not available)`));
            }
        }
    }
}

function printColorizedDiff(unifiedDiff) {
    for (const line of unifiedDiff.split('\n')) {
        if (line.startsWith('---') || line.startsWith('+++')) console.log(chalk.bold(line));
        else if (line.startsWith('@@')) console.log(chalk.cyan(line));
        else if (line.startsWith('+')) console.log(chalk.green(line));
        else if (line.startsWith('-')) console.log(chalk.red(line));
        else console.log(line);
    }
    console.log('');
}

module.exports = show;
