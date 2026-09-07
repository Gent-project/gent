/**
 * ============================================================================
 * Reset Command - Unstage files or reset HEAD to a previous commit
 * ============================================================================
 *
 * PURPOSE:
 *   Undo staging (soft) or move branch pointer back (hard). Like `git reset`.
 *
 * USAGE:
 *   gent reset <file...>       → Unstage specific file(s) (keep working tree)
 *   gent reset                 → Unstage all files
 *   gent reset --hard <hash>   → Move HEAD to commit, discard changes
 *   gent reset --soft <hash>   → Move HEAD to commit, keep staging
 *
 * ALGORITHM:
 *   Soft: removes entries from staging.entries matching given paths.
 *   Hard: resets commits.json branch pointer + restores working tree blobs.
 *
 * BACKEND EXPECTATIONS:
 *   POST /api/repos/:id/reset/ { mode, targetHash }
 *   Backend should update remote HEAD and prune unreachable commits.
 *
 * ============================================================================
 */

const fs = require('fs').promises;
const path = require('path');
const chalk = require('chalk');
const ora = require('ora');
const { getGentPath, readJSON, writeJSON } = require('../utils/fileSystem');
const { STAGING_FILE, COMMITS_FILE } = require('../utils/constants');
const { readBlob } = require('../utils/hash-engine');
const journal = require('../utils/journal');

function safePath(cwd, relativePath) {
    if (!relativePath || path.isAbsolute(relativePath) || relativePath.split(/[\\/]/).includes('..')) {
        throw new Error(`Unsafe repository path '${relativePath}'`);
    }
    const fullPath = path.resolve(cwd, relativePath);
    if (!fullPath.startsWith(cwd + path.sep)) throw new Error(`Unsafe repository path '${relativePath}'`);
    return fullPath;
}

/**
 * Reset staging or HEAD
 * @param {Array} files - Files to unstage (empty = all)
 * @param {Object} options
 */
async function reset(files, options) {
    try {
        const gentPath = await getGentPath();
        const cwd = process.cwd();

        if (options.hard || options.soft) {
            await resetHead(gentPath, cwd, files, options);
        } else {
            await unstageFiles(gentPath, files);
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
 * Unstage files from staging area
 */
async function unstageFiles(gentPath, files) {
    const stagingPath = path.join(gentPath, STAGING_FILE);
    const staging = await readJSON(stagingPath);

    if (!staging.entries || staging.entries.length === 0) {
        console.log(chalk.yellow('Nothing to unstage'));
        return;
    }

    let removed = 0;

    if (!files || files.length === 0) {
        removed = staging.entries.length;
        staging.entries = [];
        staging.files = [];
    } else {
        const removeSet = new Set(files);
        const before = staging.entries.length;
        staging.entries = staging.entries.filter(e => !removeSet.has(e.path));
        staging.files = staging.entries.map(e => e.path);
        removed = before - staging.entries.length;
    }

    await writeJSON(stagingPath, staging);
    console.log(chalk.green(`Unstaged ${removed} file(s)`));
}

/**
 * Reset HEAD to specific commit
 */
async function resetHead(gentPath, cwd, args, options) {
    const selected = options.hard || options.soft;
    const targetHash = typeof selected === 'string'
        ? selected
        : (args && args.length > 0 ? args[0] : null);
    const repository = await readJSON(path.join(gentPath, COMMITS_FILE));
    const currentBranch = repository.currentBranch;
    const currentHash = repository.branches[currentBranch] || null;
    const commits = repository.commits || [];

    if (!targetHash) {
        throw new Error('Provide a commit hash to reset to');
    }

    // Find target commit (support short hashes)
    const target = commits.find(c =>
        c.hash === targetHash || c.hash.startsWith(targetHash)
    );

    if (!target) {
        throw new Error(`Commit '${targetHash}' not found`);
    }

    const spinner = ora(`Resetting to ${target.hash.substring(0, 7)}...`).start();

    const previous = commits.find(c => c.hash === currentHash);
    const previousTree = previous
        ? (previous.tree || (previous.files || []).map(f => ({ name: f.path || f.name, hash: f.hash })))
        : [];
    const targetTree = target.tree || (target.files || []).map(f => ({
        name: f.path || f.name, hash: f.hash
    }));
    const targetByPath = new Map(targetTree.map(entry => [entry.name || entry.path, entry]));
    const blobs = new Map();
    if (options.hard) {
        for (const entry of targetTree) {
            const file = entry.name || entry.path;
            safePath(cwd, file);
            blobs.set(file, await readBlob(gentPath, entry.hash));
        }
        for (const entry of previousTree) safePath(cwd, entry.name || entry.path);
    }

    // Journal pre-state. A hard reset discards working-tree content, so flag it
    // for working-tree restore on undo.
    await journal.recordOp(
        gentPath,
        'reset',
        `${options.hard ? 'hard' : 'soft'} reset to ${target.hash.substring(0, 7)}`,
        { restoreTree: !!options.hard }
    );

    if (options.hard) {
        const previousPaths = new Set(previousTree.map(entry => entry.name || entry.path));

        // Remove files tracked by the old commit but absent from the target.
        for (const file of previousPaths) {
            if (!targetByPath.has(file)) await fs.rm(safePath(cwd, file), { force: true });
        }
        for (const [file, content] of blobs) {
            const fullPath = safePath(cwd, file);
            await fs.mkdir(path.dirname(fullPath), { recursive: true });
            await fs.writeFile(fullPath, content);
        }

        // Clear staging
        const stagingPath = path.join(gentPath, STAGING_FILE);
        await writeJSON(stagingPath, { entries: [], files: [] });

    }

    // Publish the branch move only after a hard reset has restored its files.
    repository.branches[currentBranch] = target.hash;
    await writeJSON(path.join(gentPath, COMMITS_FILE), repository);

    spinner.succeed(chalk.green(`HEAD is now at ${target.hash.substring(0, 7)} (${options.hard ? 'hard' : 'soft'} reset)`));
    console.log(chalk.gray(`  ${options.hard ? '' : 'Staging area preserved. '}${target.message}`));
}

module.exports = reset;
