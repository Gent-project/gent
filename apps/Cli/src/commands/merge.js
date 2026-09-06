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
const { storeTree, readBlob, hashBlob } = require('../utils/hash-engine');
const pet = require('./pet');
const journal = require('../utils/journal');
const ai = require('../utils/ai-service');
const reviewCommand = require('./review');

/**
 * Merge a branch into the current branch
 * @param {String} sourceBranch - Branch to merge from
 * @param {Object} options - Command options
 */
async function merge(sourceBranch, options) {
    const spinner = ora(`Merging '${sourceBranch}'...`).start();

    try {
        if (options.ai) {
            await ai.prime();
            if (!ai.isEnabled()) throw new Error(ai.disabledHint());
        }

        const gentPath = await getGentPath();
        const cwd = path.dirname(gentPath);
        const repository = await readJSON(path.join(gentPath, COMMITS_FILE));
        const commits = repository.commits || [];
        const branches = repository.branches || {};
        const currentBranch = repository.currentBranch;

        // Validate branches
        if (!branches.hasOwnProperty(sourceBranch)) {
            spinner.fail(chalk.red(`Branch '${sourceBranch}' not found`));
            process.exitCode = 1;
            return;
        }

        if (sourceBranch === currentBranch) {
            spinner.succeed(chalk.green('Already up to date'));
            return;
        }

        const oursHash = branches[currentBranch];
        const theirsHash = branches[sourceBranch];

        if (!oursHash) {
            spinner.fail(chalk.red(`Current branch '${currentBranch}' has no commits`));
            process.exitCode = 1;
            return;
        }

        if (!theirsHash) {
            spinner.fail(chalk.red(`Branch '${sourceBranch}' has no commits`));
            process.exitCode = 1;
            return;
        }

        const oursCommit = commits.find(c => c.hash === oursHash);
        const theirsCommit = commits.find(c => c.hash === theirsHash);

        // Fast-forward check: if ours is ancestor of theirs
        if (oursHash === theirsHash) {
            spinner.succeed(chalk.green('Already up to date'));
            return;
        }

        // Find merge base (common ancestor)
        const baseHash = findMergeBase(commits, oursHash, theirsHash);

        // The incoming branch is already contained in the current branch.
        if (baseHash === theirsHash) {
            spinner.succeed(chalk.green('Already up to date'));
            return;
        }

        if (!baseHash) {
            spinner.fail(chalk.red('Refusing to merge unrelated histories'));
            process.exitCode = 1;
            return;
        }

        await assertCleanWorkingTree(gentPath, cwd, oursCommit);

        // Fast-forward: current branch is merge base → just move pointer
        if (baseHash === oursHash) {
            spinner.text = 'Fast-forward merge...';
            await journal.recordOp(gentPath, 'merge', `fast-forward '${sourceBranch}' into ${currentBranch}`, { restoreTree: true });
            await checkoutTree(gentPath, cwd, treeOf(oursCommit), treeOf(theirsCommit));
            repository.branches[currentBranch] = theirsHash;
            await writeJSON(path.join(gentPath, COMMITS_FILE), repository);

            spinner.succeed(chalk.green(`Fast-forward merge: ${currentBranch} → ${theirsHash.substring(0, 7)}`));
            await pet.celebrate('merge');
            if (options.ai) {
                console.log(chalk.bold.cyan('\nAI review of the completed merge'));
                await reviewCommand(theirsHash, { head: true });
            }
            return;
        }

        // 3-way merge
        spinner.text = 'Computing 3-way merge...';

        const baseCommit = baseHash ? commits.find(c => c.hash === baseHash) : null;

        // Extract tree entries from commits
        const baseTree = treeOf(baseCommit);
        const oursTree = treeOf(oursCommit);
        const theirsTree = treeOf(theirsCommit);

        // Perform tree-level merge
        const mergeResult = await mergeTreeEntries(
            gentPath,
            baseTree,
            oursTree,
            theirsTree,
            { ours: 'HEAD', theirs: sourceBranch }
        );

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

            if (!options.ai) {
                console.log(chalk.yellow(`\nConflict markers: <<<<<<< HEAD / ======= / >>>>>>> ${sourceBranch}`));
                console.log(chalk.cyan('Resolve conflicts, then run "gent resolve"'));
            }
        }

        // Store merged tree
        const mergedTreeHash = await storeTree(gentPath, mergeResult.mergedEntries);

        // Write merged files to working directory
        await checkoutTree(gentPath, cwd, oursTree, mergeResult.mergedEntries);

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
            if (!authorName && authorEmail) authorName = authorEmail;

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

            await journal.recordOp(gentPath, 'merge', `merge '${sourceBranch}' into ${currentBranch}`);

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
            await pet.celebrate('merge');
            if (options.ai) {
                console.log(chalk.bold.cyan('\nAI review of the completed merge'));
                await reviewCommand(mergeCommit.hash, { head: true });
            }
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
            if (options.ai) {
                process.exitCode = 0;
                await require('./resolve')({ ai: true });
            } else {
                process.exitCode = 1;
            }
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
function treeOf(commit) {
    if (!commit) return [];
    if (Array.isArray(commit.tree)) return commit.tree;
    return (commit.files || []).map(file => ({
        mode: '100644', name: file.path || file.name, hash: file.hash, type: 'blob'
    }));
}

function safePath(cwd, relativePath) {
    if (!relativePath || path.isAbsolute(relativePath) || relativePath.split(/[\\/]/).includes('..')) {
        throw new Error(`Unsafe repository path '${relativePath}'`);
    }
    const fullPath = path.resolve(cwd, relativePath);
    if (fullPath !== cwd && !fullPath.startsWith(cwd + path.sep)) {
        throw new Error(`Unsafe repository path '${relativePath}'`);
    }
    return fullPath;
}

async function assertCleanWorkingTree(gentPath, cwd, commit) {
    const staging = await readJSON(path.join(gentPath, STAGING_FILE));
    if ((staging.entries || []).length || (staging.files || []).length || staging.mergeState) {
        throw new Error('Commit or stash staged changes before merging');
    }
    for (const entry of treeOf(commit)) {
        const fullPath = safePath(cwd, entry.name || entry.path);
        const stat = await fs.lstat(fullPath).catch(() => null);
        if (!stat || !stat.isFile() || hashBlob(await fs.readFile(fullPath)) !== entry.hash) {
            throw new Error(`Local changes would be overwritten by merge: ${entry.name || entry.path}`);
        }
    }
}

async function checkoutTree(gentPath, cwd, previousEntries, nextEntries) {
    const previous = new Map(previousEntries.map(entry => [entry.name || entry.path, entry]));
    const next = new Map(nextEntries.map(entry => [entry.name || entry.path, entry]));
    const writes = new Map();

    for (const [name, entry] of next) {
        const fullPath = safePath(cwd, name);
        if (!previous.has(name) && await fs.lstat(fullPath).catch(() => null)) {
            throw new Error(`Untracked file would be overwritten by merge: ${name}`);
        }
        writes.set(name, await readBlob(gentPath, entry.hash));
    }
    for (const name of previous.keys()) {
        if (!next.has(name)) await fs.unlink(safePath(cwd, name));
    }
    for (const [name, bytes] of writes) {
        const fullPath = safePath(cwd, name);
        await fs.mkdir(path.dirname(fullPath), { recursive: true });
        await fs.writeFile(fullPath, bytes);
    }
}

module.exports = merge;
