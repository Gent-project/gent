/**
 * ============================================================================
 * Rm Command - Remove files from working tree and staging
 * ============================================================================
 *
 * PURPOSE:
 *   Remove files from tracking and optionally from disk. Like `git rm`.
 *
 * USAGE:
 *   gent rm <file...>          → Remove file(s) from tracking + disk
 *   gent rm --cached <file...> → Remove from staging only (keep on disk)
 *
 * ALGORITHM:
 *   Adds a "deleted" entry to staging so commit records the removal.
 *   Without --cached, also deletes the file from the filesystem.
 *
 * BACKEND EXPECTATIONS:
 *   Deletion is recorded as absence in the commit tree. Backend removes
 *   file entry from tree when processing the push.
 *
 * ============================================================================
 */

const fs = require('fs').promises;
const path = require('path');
const chalk = require('chalk');
const { getGentPath, readJSON, writeJSON, pathExists } = require('../utils/fileSystem');
const { STAGING_FILE } = require('../utils/constants');

/**
 * Remove files
 * @param {Array} files
 * @param {Object} options
 */
async function rm(files, options) {
    try {
        const gentPath = await getGentPath();
        const cwd = process.cwd();
        const stagingPath = path.join(gentPath, STAGING_FILE);
        const staging = await readJSON(stagingPath);

        const entries = staging.entries || [];
        const entryMap = new Map(entries.map(e => [e.path, e]));
        let removed = 0;

        for (const file of files) {
            const relPath = path.relative(cwd, path.resolve(cwd, file));

            // Stage deletion
            entryMap.set(relPath, {
                path: relPath,
                hash: null,
                status: 'deleted',
                binary: false,
                stats: { insertions: 0, deletions: 0 }
            });

            // Delete from disk unless --cached
            if (!options.cached) {
                const fullPath = path.join(cwd, relPath);
                if (await pathExists(fullPath)) {
                    await fs.unlink(fullPath);
                }
            }

            removed++;
            console.log(chalk.red(`  rm ${relPath}`));
        }

        staging.entries = Array.from(entryMap.values());
        staging.files = staging.entries.filter(e => e.status !== 'deleted').map(e => e.path);
        await writeJSON(stagingPath, staging);

        console.log(chalk.green(`\nRemoved ${removed} file(s)`));
    } catch (error) {
        if (error.code === 'ENOENT' && error.message.includes('.gent')) {
            console.error(chalk.red('Error: Not a gent repository'));
        } else {
            console.error(chalk.red('Error:'), error.message);
        }
        process.exit(1);
    }
}

module.exports = rm;
