/**
 * Add Command - Add file contents to the staging area
 * Stages files with content snapshots (blobs) and diff stats
 */

const fs = require('fs').promises;
const path = require('path');
const chalk = require('chalk');
const ora = require('ora');
const { getGentPath, readJSON, writeJSON, pathExists, getAllFiles, getIgnorePatterns } = require('../utils/fileSystem');
const { STAGING_FILE, COMMITS_FILE } = require('../utils/constants');
const { storeBlob, hashBlob, isBinaryBuffer, snapshotFile } = require('../utils/hash-engine');
const { diffText, formatUnifiedDiff } = require('../utils/diff-engine');

/**
 * Add files to staging area
 * @param {Array} files - Files to add
 * @param {Object} options - Command options
 */
async function add(files, options) {
    const spinner = ora('Adding files to staging area...').start();

    try {
        const gentPath = await getGentPath();
        const cwd = process.cwd();
        const stagingPath = path.join(gentPath, STAGING_FILE);

        // Read current staging area
        const staging = await readJSON(stagingPath);
        const stagedEntries = staging.entries || [];
        const stagedMap = new Map(stagedEntries.map(e => [e.path, e]));

        // Get last commit tree for diff comparison
        const repository = await readJSON(path.join(gentPath, COMMITS_FILE));
        const lastCommitHash = repository.branches[repository.currentBranch] || null;
        const lastCommit = lastCommitHash
            ? (repository.commits || []).find(c => c.hash === lastCommitHash)
            : null;
        const lastTreeMap = new Map(
            (lastCommit && lastCommit.tree ? lastCommit.tree : (lastCommit ? lastCommit.files : []))
                .map(f => [f.path || f.name, f.hash])
        );

        let filesToAdd = [];

        // Handle --all option
        if (options.all || files.includes('.') || files.includes('*')) {
            spinner.text = 'Scanning for all files...';
            const ignorePatterns = await getIgnorePatterns(cwd);
            const allFiles = await getAllFiles(cwd, ignorePatterns);
            filesToAdd = allFiles.map(f => path.relative(cwd, f));
        } else {
            for (const file of files) {
                const filePath = path.resolve(cwd, file);
                if (!await pathExists(filePath)) {
                    spinner.warn(chalk.yellow(`Warning: File not found: ${file}`));
                    continue;
                }
                filesToAdd.push(path.relative(cwd, filePath));
            }
        }

        // Snapshot each file → store blob, compute diff
        let addedCount = 0;
        let totalInsertions = 0;
        let totalDeletions = 0;
        const diffSummaries = [];

        for (const relPath of filesToAdd) {
            const fullPath = path.join(cwd, relPath);
            const content = await fs.readFile(fullPath);

            // Skip binary files for diff (still store blob)
            const binary = isBinaryBuffer(content);
            const blobHash = await storeBlob(gentPath, content);

            // Check if changed vs last commit
            const prevHash = lastTreeMap.get(relPath);
            if (prevHash === blobHash && stagedMap.has(relPath)) {
                continue; // unchanged, already staged
            }

            // Determine change status
            let status = 'added';
            let stats = { insertions: 0, deletions: 0 };

            if (prevHash && prevHash !== blobHash && !binary) {
                status = 'modified';
                try {
                    const { readBlobAsString } = require('../utils/hash-engine');
                    const oldContent = await readBlobAsString(gentPath, prevHash);
                    const diff = diffText(oldContent, content.toString('utf-8'));
                    stats = { insertions: diff.stats.insertions, deletions: diff.stats.deletions };
                } catch {
                    // Old blob may not exist yet (first time adding objects)
                }
            } else if (!prevHash) {
                status = 'added';
                stats.insertions = content.toString('utf-8').split('\n').length;
            }

            totalInsertions += stats.insertions;
            totalDeletions += stats.deletions;

            // Update staging entry
            stagedMap.set(relPath, {
                path: relPath,
                hash: blobHash,
                status,
                binary,
                stats
            });

            diffSummaries.push({ path: relPath, status, stats, binary });
            addedCount++;
        }

        // Detect deleted files (tracked in last commit but gone from disk)
        for (const [trackedPath, trackedHash] of lastTreeMap) {
            const fullPath = path.join(cwd, trackedPath);
            if (!await pathExists(fullPath) && !stagedMap.has(trackedPath)) {
                stagedMap.set(trackedPath, {
                    path: trackedPath,
                    hash: null,
                    status: 'deleted',
                    binary: false,
                    stats: { insertions: 0, deletions: 0 }
                });
                diffSummaries.push({ path: trackedPath, status: 'deleted', stats: { insertions: 0, deletions: 0 }, binary: false });
                addedCount++;
            }
        }

        // Save staging area (new format with entries)
        staging.entries = Array.from(stagedMap.values());
        staging.files = staging.entries.map(e => e.path); // backward compat
        await writeJSON(stagingPath, staging);

        spinner.succeed(chalk.green(`Added ${addedCount} file(s) to staging area`));

        if (diffSummaries.length > 0) {
            console.log('');
            for (const d of diffSummaries) {
                const statusIcon = d.status === 'added' ? chalk.green('+ new')
                    : d.status === 'deleted' ? chalk.red('- del')
                        : chalk.yellow('~ mod');
                const statsStr = d.binary ? chalk.gray('(binary)')
                    : chalk.green(`+${d.stats.insertions}`) + ' ' + chalk.red(`-${d.stats.deletions}`);
                console.log(`  ${statusIcon}  ${d.path}  ${statsStr}`);
            }
            console.log(chalk.gray(`\n  Total: `) + chalk.green(`+${totalInsertions}`) + ' ' + chalk.red(`-${totalDeletions}`));
            console.log(chalk.cyan('\nUse "gent commit" to record your changes'));
        }

    } catch (error) {
        spinner.fail(chalk.red('Failed to add files'));
        if (error.code === 'ENOENT' && error.message.includes('.gent')) {
            console.error(chalk.red('\nError: Not a gent repository'));
            console.log(chalk.yellow('Run "gent init" to initialize a repository'));
        } else {
            console.error(chalk.red('\nError:'), error.message);
        }
        process.exit(1);
    }
}

module.exports = add;
