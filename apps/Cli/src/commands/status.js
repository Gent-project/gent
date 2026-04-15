/**
 * ============================================================================
 * Status Command - Show working tree status
 * ============================================================================
 *
 * PURPOSE:
 *   Display staged, modified, untracked, and deleted files. Like `git status`.
 *
 * USAGE:
 *   gent status                → Detailed status
 *   gent status -s             → Short format
 *
 * ALGORITHM:
 *   Computes SHA-256 blob hash for each working file, compares against:
 *   - Staging entries (from gent add)
 *   - Last commit tree (from commits.json)
 *   Classifies files as staged/modified/untracked/deleted.
 *
 * BACKEND EXPECTATIONS:
 *   None (local only).
 *
 * ============================================================================
 */

const fs = require('fs').promises;
const path = require('path');
const chalk = require('chalk');
const { getGentPath, readJSON, pathExists, getIgnorePatterns, getAllFiles } = require('../utils/fileSystem');
const { STAGING_FILE, COMMITS_FILE } = require('../utils/constants');
const { hashBlob } = require('../utils/hash-engine');

/**
 * Show repository status
 * @param {Object} options - Command options
 */
async function status(options) {
    try {
        const gentPath = await getGentPath();
        const cwd = process.cwd();

        const staging = await readJSON(path.join(gentPath, STAGING_FILE));
        const repository = await readJSON(path.join(gentPath, COMMITS_FILE));

        const stagedEntries = staging.entries || [];
        const stagedFiles = stagedEntries.map(e => e.path);
        const currentBranch = repository.currentBranch || 'main';
        const lastCommitHash = repository.branches[currentBranch];

        // Build HEAD tree map: path → blobHash
        const lastCommit = lastCommitHash
            ? (repository.commits || []).find(c => c.hash === lastCommitHash)
            : null;
        const trackedMap = new Map();
        if (lastCommit) {
            const tree = lastCommit.tree || lastCommit.files || [];
            for (const f of tree) trackedMap.set(f.path || f.name, f.hash);
        }

        // Get all working directory files
        const ignorePatterns = await getIgnorePatterns(cwd);
        const allFiles = await getAllFiles(cwd, ignorePatterns);

        const stagedSet = new Set(stagedFiles);
        const modified = [];
        const untracked = [];
        const deleted = [];

        // Check working tree against HEAD
        for (const absFile of allFiles) {
            const relPath = path.relative(cwd, absFile);
            const headHash = trackedMap.get(relPath);

            if (headHash) {
                // Tracked file — check modification via blob hash
                const content = await fs.readFile(absFile);
                const currentHash = hashBlob(content);
                if (currentHash !== headHash && !stagedSet.has(relPath)) {
                    modified.push(relPath);
                }
            } else if (!stagedSet.has(relPath)) {
                untracked.push(relPath);
            }
        }

        // Check for deleted files
        for (const [trackedPath] of trackedMap) {
            const fullPath = path.join(cwd, trackedPath);
            if (!await pathExists(fullPath) && !stagedSet.has(trackedPath)) {
                deleted.push(trackedPath);
            }
        }

        // Check for merge in progress
        const mergeState = staging.mergeState || null;

        // Display
        if (options.short) {
            displayShortStatus(stagedEntries, modified, untracked, deleted);
        } else {
            displayDetailedStatus(currentBranch, stagedEntries, modified, untracked, deleted, lastCommitHash, mergeState);
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
 * Display detailed status output
 */
function displayDetailedStatus(branch, stagedEntries, modified, untracked, deleted, lastCommit, mergeState) {
    console.log(chalk.bold(`On branch ${chalk.cyan(branch)}`));

    if (mergeState) {
        console.log(chalk.yellow(`Merging branch '${mergeState.sourceBranch}'`));
    }

    if (!lastCommit) {
        console.log(chalk.gray('No commits yet\n'));
    } else {
        console.log(chalk.gray(`Last commit: ${lastCommit.substring(0, 7)}\n`));
    }

    // Staged files
    if (stagedEntries.length > 0) {
        console.log(chalk.green.bold('Changes to be committed:'));
        console.log(chalk.gray('  (use "gent reset <file>..." to unstage)\n'));
        for (const entry of stagedEntries) {
            const icon = entry.status === 'added' ? 'new file:  '
                : entry.status === 'deleted' ? 'deleted:   '
                    : 'modified:  ';
            console.log(chalk.green(`\t${icon}${entry.path}`));
        }
        console.log();
    }

    // Modified files
    if (modified.length > 0) {
        console.log(chalk.red.bold('Changes not staged for commit:'));
        console.log(chalk.gray('  (use "gent add <file>..." to update what will be committed)\n'));
        modified.forEach(file => {
            console.log(chalk.red(`\tmodified:   ${file}`));
        });
        console.log();
    }

    // Deleted files
    if (deleted.length > 0) {
        deleted.forEach(file => {
            console.log(chalk.red(`\tdeleted:    ${file}`));
        });
        console.log();
    }

    // Untracked files
    if (untracked.length > 0) {
        console.log(chalk.red.bold('Untracked files:'));
        console.log(chalk.gray('  (use "gent add <file>..." to include in what will be committed)\n'));
        untracked.forEach(file => {
            console.log(chalk.red(`\t${file}`));
        });
        console.log();
    }

    // Status summary
    if (stagedEntries.length === 0 && modified.length === 0 && untracked.length === 0 && deleted.length === 0) {
        console.log(chalk.green('Working tree clean'));
    } else if (stagedEntries.length === 0) {
        console.log(chalk.yellow('No changes added to commit (use "gent add" to track files)'));
    }
}

/**
 * Display short status output
 */
function displayShortStatus(stagedEntries, modified, untracked, deleted) {
    for (const entry of stagedEntries) {
        const code = entry.status === 'added' ? 'A ' : entry.status === 'deleted' ? 'D ' : 'M ';
        console.log(chalk.green(code) + entry.path);
    }

    modified.forEach(file => {
        console.log(chalk.red(' M ') + file);
    });

    deleted.forEach(file => {
        console.log(chalk.red(' D ') + file);
    });

    untracked.forEach(file => {
        console.log(chalk.red('?? ') + file);
    });
}

module.exports = status;
