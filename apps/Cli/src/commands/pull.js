/**
 * ============================================================================
 * Pull Command - Fetch and merge remote commits into local branch
 * ============================================================================
 *
 * PURPOSE:
 *   Download new commits from remote and merge into current branch.
 *   Like `git pull` (fetch + merge in one step).
 *
 * USAGE:
 *   gent pull                          → Pull from origin/current-branch
 *   gent pull <remote> <branch>        → Pull specific remote/branch
 *
 * ALGORITHM:
 *   1. GET /api/repos/:id/pull/?branch=<branch>&since=<lastKnownHash>
 *   2. Receive commits + blob objects
 *   3. Store blobs in local object store
 *   4. Append commits to local history
 *   5. If diverged: run 3-way merge (same as gent merge)
 *   6. If fast-forward: just advance pointer
 *
 * BACKEND EXPECTATIONS:
 *   GET /api/repos/:id/pull/?branch=main&since=abc1234
 *   Returns:
 *   {
 *     branch: "main",
 *     commits: [...],
 *     objects: [ { hash, type, data: "<base64>" } ],
 *     head: "<remoteHeadHash>"
 *   }
 *
 * ============================================================================
 */

const fs = require('fs').promises;
const path = require('path');
const chalk = require('chalk');
const ora = require('ora');
const { getGentPath, readJSON, writeJSON } = require('../utils/fileSystem');
const { COMMITS_FILE, CONFIG_FILE } = require('../utils/constants');
const apiClient = require('../utils/api-client');
const authStorage = require('../utils/auth-storage');
const { storeBlob, objectExists } = require('../utils/hash-engine');
const { findMergeBase, mergeTreeEntries } = require('../utils/merge-engine');
const { generateCommitHash } = require('../utils/helpers');

/**
 * Pull remote commits
 * @param {String} remoteName
 * @param {String} branchName
 * @param {Object} options
 */
async function pull(remoteName, branchName, options) {
    const spinner = ora('Pulling from remote...').start();

    try {
        const isAuth = await authStorage.isAuthenticated();
        if (!isAuth) {
            spinner.fail(chalk.red('Not authenticated'));
            console.log(chalk.yellow('Run "gent login" first'));
            return;
        }

        const gentPath = await getGentPath();
        const config = await readJSON(path.join(gentPath, CONFIG_FILE));
        config.remotes = config.remotes || {};

        const remote = remoteName || 'origin';
        const remoteConfig = config.remotes[remote];
        if (!remoteConfig) {
            spinner.fail(chalk.red(`Remote '${remote}' not found`));
            return;
        }

        const repository = await readJSON(path.join(gentPath, COMMITS_FILE));
        const branch = branchName || repository.currentBranch;
        const localHead = repository.branches[branch] || null;

        // Fetch from remote
        config.remoteRefs = config.remoteRefs || {};
        const since = config.remoteRefs[`${remote}/${branch}`] || localHead || '';

        spinner.text = `Fetching from ${remote}/${branch}...`;

        const response = await apiClient.get(
            `${remoteConfig.url}/pull/`,
            { params: { branch, since } }
        );

        const remoteCommits = response.commits || [];
        const remoteObjects = response.objects || [];
        const remoteHead = response.head;

        if (remoteCommits.length === 0) {
            spinner.succeed(chalk.green('Already up-to-date'));
            return;
        }

        // Store received blob objects
        spinner.text = `Storing ${remoteObjects.length} object(s)...`;
        for (const obj of remoteObjects) {
            if (obj.type === 'blob' && obj.data) {
                const buf = Buffer.from(obj.data, 'base64');
                await storeBlob(gentPath, buf);
            }
        }

        // Check if fast-forward is possible
        const allCommits = [...(repository.commits || []), ...remoteCommits];
        const commitSet = new Set((repository.commits || []).map(c => c.hash));

        // Add new commits (dedup)
        let newCount = 0;
        for (const commit of remoteCommits) {
            if (!commitSet.has(commit.hash)) {
                repository.commits.push(commit);
                commitSet.add(commit.hash);
                newCount++;
            }
        }

        if (!localHead || isAncestor(repository.commits, localHead, remoteHead)) {
            // Fast-forward
            repository.branches[branch] = remoteHead;
            await writeJSON(path.join(gentPath, COMMITS_FILE), repository);

            config.remoteRefs[`${remote}/${branch}`] = remoteHead;
            await writeJSON(path.join(gentPath, CONFIG_FILE), config);

            spinner.succeed(chalk.green(`Fast-forward: ${newCount} new commit(s)`));
            console.log(chalk.gray(`  ${remote}/${branch} → ${remoteHead.substring(0, 7)}`));
        } else {
            // Diverged — need 3-way merge
            spinner.text = 'Branches diverged, merging...';

            const baseHash = findMergeBase(repository.commits, localHead, remoteHead);
            const getTree = (hash) => {
                const c = repository.commits.find(x => x.hash === hash);
                if (!c) return [];
                return c.tree || (c.files || []).map(f => ({
                    mode: '100644', name: f.path || f.name, hash: f.hash, type: 'blob'
                }));
            };

            const baseTree = baseHash ? getTree(baseHash) : [];
            const oursTree = getTree(localHead);
            const theirsTree = getTree(remoteHead);

            const mergeResult = await mergeTreeEntries(gentPath, baseTree, oursTree, theirsTree);

            // Build merge commit
            const { storeTree } = require('../utils/hash-engine');
            const mergedTreeHash = await storeTree(gentPath, mergeResult.mergedEntries);

            const mergeCommit = {
                hash: generateCommitHash(),
                message: `Merge remote-tracking branch '${remote}/${branch}'`,
                author: (repository.commits.find(c => c.hash === localHead) || {}).author || { name: 'Unknown', email: '' },
                timestamp: new Date().toISOString(),
                parent: localHead,
                mergeParent: remoteHead,
                treeHash: mergedTreeHash,
                tree: mergeResult.mergedEntries,
                files: mergeResult.mergedEntries.map(e => ({ path: e.name, hash: e.hash })),
                stats: { filesChanged: mergeResult.mergedEntries.length, insertions: 0, deletions: 0 }
            };

            repository.commits.push(mergeCommit);
            repository.branches[branch] = mergeCommit.hash;
            await writeJSON(path.join(gentPath, COMMITS_FILE), repository);

            config.remoteRefs[`${remote}/${branch}`] = remoteHead;
            await writeJSON(path.join(gentPath, CONFIG_FILE), config);

            if (mergeResult.hasConflicts) {
                spinner.warn(chalk.yellow(`Pulled with ${mergeResult.conflicts.length} conflict(s)`));
                for (const c of mergeResult.conflicts) {
                    console.log(chalk.red(`  CONFLICT: ${c.file} (${c.type})`));
                }
                console.log(chalk.yellow('\nResolve conflicts, then "gent add" + "gent commit"'));
            } else {
                spinner.succeed(chalk.green(`Merged ${newCount} remote commit(s)`));
                console.log(chalk.gray(`  Merge commit: ${mergeCommit.hash.substring(0, 7)}`));
            }
        }
    } catch (error) {
        spinner.fail(chalk.red('Pull failed'));
        if (error.response?.status === 401) {
            console.error(chalk.red('Authentication failed — run "gent login"'));
        } else if (error.response?.data?.message) {
            console.error(chalk.red(error.response.data.message));
        } else {
            console.error(chalk.red('Error:'), error.message);
        }
        process.exit(1);
    }
}

/**
 * Check if hashA is ancestor of hashB
 */
function isAncestor(commits, hashA, hashB) {
    const commitMap = new Map(commits.map(c => [c.hash, c]));
    let cur = hashB;
    while (cur) {
        if (cur === hashA) return true;
        const c = commitMap.get(cur);
        cur = c ? c.parent : null;
    }
    return false;
}

module.exports = pull;
