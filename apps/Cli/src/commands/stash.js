/**
 * ============================================================================
 * Stash Command - Temporarily shelve working tree changes
 * ============================================================================
 *
 * PURPOSE:
 *   Save uncommitted changes on a stack so you can switch branches cleanly,
 *   then restore them later. Like `git stash`.
 *
 * USAGE:
 *   gent stash                 → Stash all modified tracked files
 *   gent stash pop             → Restore most recent stash and remove it
 *   gent stash list            → List all stashed entries
 *   gent stash drop [index]    → Drop a specific stash entry
 *   gent stash apply [index]   → Apply stash without removing it
 *
 * ALGORITHM:
 *   Saved as JSON stack in .gent/stash.json. Each entry stores:
 *   - Snapshot of staged entries (staging.entries)
 *   - Blob hashes of modified working tree files
 *   After stashing, staging is cleared and files are restored to HEAD state.
 *
 * BACKEND EXPECTATIONS:
 *   Stash is local only. Backend does not need stash support.
 *
 * ============================================================================
 */

const fs = require('fs').promises;
const path = require('path');
const chalk = require('chalk');
const ora = require('ora');
const { getGentPath, readJSON, writeJSON, pathExists, getAllFiles, getIgnorePatterns } = require('../utils/fileSystem');
const { STAGING_FILE, COMMITS_FILE } = require('../utils/constants');
const { storeBlob, readBlobAsString, hashBlob } = require('../utils/hash-engine');

const STASH_FILE = 'stash.json';

/**
 * Stash management
 * @param {String} subcommand - pop|list|drop|apply (null = stash push)
 * @param {Object} options
 */
async function stash(subcommand, options) {
    try {
        const gentPath = await getGentPath();
        const cwd = process.cwd();

        switch (subcommand) {
            case 'pop':
                await stashPop(gentPath, cwd, options);
                break;
            case 'list':
                await stashList(gentPath);
                break;
            case 'drop':
                await stashDrop(gentPath, options);
                break;
            case 'apply':
                await stashApply(gentPath, cwd, options, false);
                break;
            default:
                await stashPush(gentPath, cwd, options);
                break;
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
 * Push current changes onto stash stack
 */
async function stashPush(gentPath, cwd, options) {
    const spinner = ora('Stashing changes...').start();

    const staging = await readJSON(path.join(gentPath, STAGING_FILE));
    const repository = await readJSON(path.join(gentPath, COMMITS_FILE));
    const headHash = repository.branches[repository.currentBranch] || null;
    const headCommit = headHash ? (repository.commits || []).find(c => c.hash === headHash) : null;

    // Get HEAD tree
    const headTree = new Map();
    if (headCommit) {
        const tree = headCommit.tree || headCommit.files || [];
        for (const f of tree) headTree.set(f.path || f.name, f.hash);
    }

    // Collect modified working tree files
    const ignorePatterns = await getIgnorePatterns(cwd);
    const allFiles = await getAllFiles(cwd, ignorePatterns);
    const workingChanges = [];

    for (const absPath of allFiles) {
        const relPath = path.relative(cwd, absPath);
        const content = await fs.readFile(absPath, 'utf-8');
        const currentHash = hashBlob(content);
        const headBlobHash = headTree.get(relPath);

        if (headBlobHash && currentHash !== headBlobHash) {
            const blobHash = await storeBlob(gentPath, content);
            workingChanges.push({ path: relPath, hash: blobHash });
        }
    }

    const stagedEntries = staging.entries || [];

    if (workingChanges.length === 0 && stagedEntries.length === 0) {
        spinner.info(chalk.yellow('No local changes to stash'));
        return;
    }

    // Save stash entry
    const stashes = await readStashes(gentPath);
    stashes.unshift({
        message: options.message || `WIP on ${repository.currentBranch}`,
        branch: repository.currentBranch,
        timestamp: new Date().toISOString(),
        stagedEntries: stagedEntries,
        workingChanges: workingChanges
    });
    await writeStashes(gentPath, stashes);

    // Clear staging
    staging.entries = [];
    staging.files = [];
    await writeJSON(path.join(gentPath, STAGING_FILE), staging);

    // Restore working tree to HEAD state
    for (const change of workingChanges) {
        const headBlobHash = headTree.get(change.path);
        if (headBlobHash) {
            try {
                const content = await readBlobAsString(gentPath, headBlobHash);
                await fs.writeFile(path.join(cwd, change.path), content, 'utf-8');
            } catch { /* best effort */ }
        }
    }

    spinner.succeed(chalk.green(`Stashed ${stagedEntries.length} staged + ${workingChanges.length} working tree changes`));
}

/**
 * Pop: apply and remove most recent stash
 */
async function stashPop(gentPath, cwd, options) {
    await stashApply(gentPath, cwd, options, true);
}

/**
 * Apply stash entry to working tree
 */
async function stashApply(gentPath, cwd, options, removAfter) {
    const index = options.index ? parseInt(options.index) : 0;
    const stashes = await readStashes(gentPath);

    if (stashes.length === 0) {
        console.log(chalk.yellow('No stash entries'));
        return;
    }

    if (index >= stashes.length) {
        console.error(chalk.red(`stash@{${index}} does not exist`));
        return;
    }

    const entry = stashes[index];

    // Restore working tree changes
    for (const change of (entry.workingChanges || [])) {
        try {
            const content = await readBlobAsString(gentPath, change.hash);
            const fullPath = path.join(cwd, change.path);
            await fs.mkdir(path.dirname(fullPath), { recursive: true });
            await fs.writeFile(fullPath, content, 'utf-8');
        } catch { /* blob missing */ }
    }

    // Restore staged entries
    if (entry.stagedEntries && entry.stagedEntries.length > 0) {
        const staging = await readJSON(path.join(gentPath, STAGING_FILE));
        staging.entries = entry.stagedEntries;
        staging.files = entry.stagedEntries.map(e => e.path);
        await writeJSON(path.join(gentPath, STAGING_FILE), staging);
    }

    if (removAfter) {
        stashes.splice(index, 1);
        await writeStashes(gentPath, stashes);
    }

    console.log(chalk.green(`Applied stash@{${index}}: ${entry.message}`));
}

/**
 * List stash entries
 */
async function stashList(gentPath) {
    const stashes = await readStashes(gentPath);

    if (stashes.length === 0) {
        console.log(chalk.gray('No stash entries'));
        return;
    }

    stashes.forEach((entry, i) => {
        const ts = new Date(entry.timestamp).toLocaleString();
        console.log(
            chalk.yellow(`stash@{${i}}: `) +
            chalk.white(entry.message) +
            chalk.gray(` (${entry.branch}, ${ts})`)
        );
    });
}

/**
 * Drop stash entry
 */
async function stashDrop(gentPath, options) {
    const index = options.index ? parseInt(options.index) : 0;
    const stashes = await readStashes(gentPath);

    if (index >= stashes.length) {
        console.error(chalk.red(`stash@{${index}} does not exist`));
        return;
    }

    const removed = stashes.splice(index, 1);
    await writeStashes(gentPath, stashes);
    console.log(chalk.green(`Dropped stash@{${index}}: ${removed[0].message}`));
}

/**
 * Read stash stack from disk
 */
async function readStashes(gentPath) {
    const stashPath = path.join(gentPath, STASH_FILE);
    if (!await pathExists(stashPath)) return [];
    const data = await readJSON(stashPath);
    return data.stashes || [];
}

/**
 * Write stash stack to disk
 */
async function writeStashes(gentPath, stashes) {
    await writeJSON(path.join(gentPath, STASH_FILE), { stashes });
}

module.exports = stash;
