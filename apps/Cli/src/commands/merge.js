/**
 * Merge Command - Merge a branch into the current branch
 * Uses 3-way smart merge with automatic conflict resolution
 */

const fs = require('fs').promises;
const path = require('path');
const chalk = require('chalk');
const ora = require('ora');
const { getGentPath, readJSON, writeJSON, pathExists } = require('../utils/fileSystem');
const { COMMITS_FILE, STAGING_FILE, CONFIG_FILE } = require('../utils/constants');
const { generateCommitHash } = require('../utils/helpers');
const authStorage = require('../utils/auth-storage');
const { findMergeBase, mergeTreeEntries, autoMerge } = require('../utils/merge-engine');
const { storeTree, readBlobAsString, storeBlob } = require('../utils/hash-engine');

/**
 * Merge a branch into the current branch
 * @param {String} sourceBranch - Branch to merge from
 * @param {Object} options - Command options
 */
async function merge(sourceBranch, options) {
    const spinner = ora(`Merging '${sourceBranch}'...`).start();

    try {
        const gentPath = await getGentPath();
        const cwd = process.cwd();
        const repository = await readJSON(path.join(gentPath, COMMITS_FILE));
        const commits = repository.commits || [];
        const branches = repository.branches || {};
        const currentBranch = repository.currentBranch;

        // Validate branches
        if (!branches.hasOwnProperty(sourceBranch)) {
            spinner.fail(chalk.red(`Branch '${sourceBranch}' not found`));
            return;
        }

        if (sourceBranch === currentBranch) {
            spinner.fail(chalk.red('Cannot merge a branch into itself'));
            return;
        }

        const oursHash = branches[currentBranch];
        const theirsHash = branches[sourceBranch];

        if (!oursHash) {
            spinner.fail(chalk.red(`Current branch '${currentBranch}' has no commits`));
            return;
        }

        if (!theirsHash) {
            spinner.fail(chalk.red(`Branch '${sourceBranch}' has no commits`));
            return;
        }

        // Fast-forward check: if ours is ancestor of theirs
        if (oursHash === theirsHash) {
            spinner.succeed(chalk.green('Already up to date'));
            return;
        }

        // Find merge base (common ancestor)
        const baseHash = findMergeBase(commits, oursHash, theirsHash);

        // Fast-forward: current branch is merge base → just move pointer
        if (baseHash === oursHash) {
            spinner.text = 'Fast-forward merge...';
            repository.branches[currentBranch] = theirsHash;
            await writeJSON(path.join(gentPath, COMMITS_FILE), repository);

            // Restore working tree from theirs commit
            const theirsCommit = commits.find(c => c.hash === theirsHash);
            if (theirsCommit) {
                await restoreWorkingTree(gentPath, cwd, theirsCommit);
            }

            spinner.succeed(chalk.green(`Fast-forward merge: ${currentBranch} → ${theirsHash.substring(0, 7)}`));
            return;
        }

        // 3-way merge
        spinner.text = 'Computing 3-way merge...';

        const oursCommit = commits.find(c => c.hash === oursHash);
        const theirsCommit = commits.find(c => c.hash === theirsHash);
        const baseCommit = baseHash ? commits.find(c => c.hash === baseHash) : null;

        // Extract tree entries from commits
        const getTree = (commit) => {
            if (!commit) return [];
            if (commit.tree && Array.isArray(commit.tree)) return commit.tree;
            if (commit.files) return commit.files.map(f => ({
                mode: '100644', name: f.path || f.name, hash: f.hash, type: 'blob'
            }));
            return [];
        };

        const baseTree = getTree(baseCommit);
        const oursTree = getTree(oursCommit);
        const theirsTree = getTree(theirsCommit);

        // Perform tree-level merge
        const mergeResult = await mergeTreeEntries(gentPath, baseTree, oursTree, theirsTree);

        if (mergeResult.hasConflicts) {
            spinner.warn(chalk.yellow(`Merged with ${mergeResult.conflicts.length} conflict(s)`));
            console.log('');

            for (const conflict of mergeResult.conflicts) {
                if (conflict.type === 'content') {
                    console.log(chalk.red(`  CONFLICT (content): ${conflict.file}`));
                    console.log(chalk.gray(`    ${conflict.details.length} conflicting region(s) — markers inserted`));
                } else if (conflict.type === 'modify-delete') {
                    console.log(chalk.yellow(`  CONFLICT (modify/delete): ${conflict.file}`));
                    console.log(chalk.gray(`    Deleted by ${conflict.deletedBy}, modified by ${conflict.modifiedBy} — kept modified version`));
                } else if (conflict.type === 'add-add') {
                    console.log(chalk.yellow(`  CONFLICT (add/add): ${conflict.file}`));
                    console.log(chalk.gray(`    Both branches added differently — markers inserted`));
                }
            }

            console.log(chalk.yellow('\nConflict markers: <<<<<<< ours / ======= / >>>>>>> theirs'));
            console.log(chalk.cyan('Resolve conflicts, then run "gent add" and "gent commit"'));
        }

        // Store merged tree
        const mergedTreeHash = await storeTree(gentPath, mergeResult.mergedEntries);

        // Write merged files to working directory
        await writeTreeToWorkDir(gentPath, cwd, mergeResult.mergedEntries);

        // If no conflicts, create merge commit automatically
        if (!mergeResult.hasConflicts) {
            // Resolve author
            const config = await readJSON(path.join(gentPath, CONFIG_FILE));
            let authorName = config.user.name;
            let authorEmail = config.user.email;

            if (!authorName || !authorEmail) {
                const globalUser = await authStorage.getUser();
                if (globalUser) {
                    if (!authorName) authorName = [globalUser.first_name, globalUser.last_name].filter(Boolean).join(' ');
                    if (!authorEmail) authorEmail = globalUser.email;
                }
            }

            const mergeCommit = {
                hash: generateCommitHash(),
                message: options.message || `Merge branch '${sourceBranch}' into ${currentBranch}`,
                author: {
                    name: authorName || 'Unknown',
                    email: authorEmail || 'unknown@gent'
                },
                timestamp: new Date().toISOString(),
                parent: oursHash,
                mergeParent: theirsHash,
                treeHash: mergedTreeHash,
                tree: mergeResult.mergedEntries,
                files: mergeResult.mergedEntries.map(e => ({ path: e.name, hash: e.hash })),
                stats: {
                    filesChanged: mergeResult.mergedEntries.length,
                    insertions: 0,
                    deletions: 0
                }
            };

            repository.commits.push(mergeCommit);
            repository.branches[currentBranch] = mergeCommit.hash;
            await writeJSON(path.join(gentPath, COMMITS_FILE), repository);

            // Clear staging
            const staging = await readJSON(path.join(gentPath, STAGING_FILE));
            staging.entries = [];
            staging.files = [];
            await writeJSON(path.join(gentPath, STAGING_FILE), staging);

            spinner.succeed(chalk.green(`Merged '${sourceBranch}' into '${currentBranch}' — ${mergeCommit.hash.substring(0, 7)}`));

            const autoResolved = mergeResult.mergedEntries.length;
            console.log(chalk.gray(`\n  Base: ${baseHash ? baseHash.substring(0, 7) : 'none'}`));
            console.log(chalk.gray(`  Ours: ${oursHash.substring(0, 7)}  Theirs: ${theirsHash.substring(0, 7)}`));
            console.log(chalk.green(`  ${autoResolved} file(s) merged automatically`));
        } else {
            // Stage the merge state for manual resolution
            const staging = await readJSON(path.join(gentPath, STAGING_FILE));
            staging.mergeState = {
                sourceBranch,
                oursHash,
                theirsHash,
                baseHash,
                mergedTreeHash,
                mergedEntries: mergeResult.mergedEntries,
                conflicts: mergeResult.conflicts
            };
            await writeJSON(path.join(gentPath, STAGING_FILE), staging);
        }

    } catch (error) {
        spinner.fail(chalk.red('Merge failed'));
        if (error.code === 'ENOENT' && error.message.includes('.gent')) {
            console.error(chalk.red('\nError: Not a gent repository'));
            console.log(chalk.yellow('Run "gent init" to initialize a repository'));
        } else {
            console.error(chalk.red('\nError:'), error.message);
        }
        process.exit(1);
    }
}

/**
 * Write tree entries to working directory.
 * @param {String} gentPath
 * @param {String} cwd
 * @param {Array} entries
 */
async function writeTreeToWorkDir(gentPath, cwd, entries) {
    for (const entry of entries) {
        const fullPath = path.join(cwd, entry.name);
        await fs.mkdir(path.dirname(fullPath), { recursive: true });

        const content = await readBlobAsString(gentPath, entry.hash);
        await fs.writeFile(fullPath, content, 'utf-8');
    }
}

/**
 * Restore working tree from a commit's tree entries.
 * @param {String} gentPath
 * @param {String} cwd
 * @param {Object} commit
 */
async function restoreWorkingTree(gentPath, cwd, commit) {
    const tree = commit.tree || (commit.files || []).map(f => ({
        mode: '100644', name: f.path || f.name, hash: f.hash, type: 'blob'
    }));

    try {
        await writeTreeToWorkDir(gentPath, cwd, tree);
    } catch {
        // Best-effort restore — blobs may not exist for legacy commits
    }
}

module.exports = merge;
