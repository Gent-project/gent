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
const { getGentPath, readJSON, writeJSON, pathExists } = require('../utils/fileSystem');
const { STAGING_FILE, COMMITS_FILE } = require('../utils/constants');
const { readBlobAsString } = require('../utils/hash-engine');

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
    const targetHash = args && args.length > 0 ? args[0] : null;
    const repository = await readJSON(path.join(gentPath, COMMITS_FILE));
    const currentBranch = repository.currentBranch;
    const commits = repository.commits || [];

    if (!targetHash) {
        console.error(chalk.red('Provide a commit hash to reset to'));
        return;
    }

    // Find target commit (support short hashes)
    const target = commits.find(c =>
        c.hash === targetHash || c.hash.startsWith(targetHash)
    );

    if (!target) {
        console.error(chalk.red(`Commit '${targetHash}' not found`));
        return;
    }

    const spinner = ora(`Resetting to ${target.hash.substring(0, 7)}...`).start();

    // Move branch pointer
    repository.branches[currentBranch] = target.hash;
    await writeJSON(path.join(gentPath, COMMITS_FILE), repository);

    if (options.hard) {
        // Restore working tree from target commit
        const tree = target.tree || (target.files || []).map(f => ({
            name: f.path || f.name, hash: f.hash
        }));

        for (const entry of tree) {
            try {
                const content = await readBlobAsString(gentPath, entry.hash);
                const fullPath = path.join(cwd, entry.name || entry.path);
                await fs.mkdir(path.dirname(fullPath), { recursive: true });
                await fs.writeFile(fullPath, content, 'utf-8');
            } catch {
                // Blob may not exist for legacy commits
            }
        }

        // Clear staging
        const stagingPath = path.join(gentPath, STAGING_FILE);
        await writeJSON(stagingPath, { entries: [], files: [] });

        spinner.succeed(chalk.green(`HEAD is now at ${target.hash.substring(0, 7)} (hard reset)`));
        console.log(chalk.gray(`  ${target.message}`));
    } else {
        // Soft reset: keep staging
        spinner.succeed(chalk.green(`HEAD is now at ${target.hash.substring(0, 7)} (soft reset)`));
        console.log(chalk.gray(`  Staging area preserved. ${target.message}`));
    }
}

module.exports = reset;
