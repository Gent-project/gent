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
 * ALGORITHM (client-side, no /pull/ endpoint):
 *   1. GET .../branches/{branch}/ → get remote branch head SHA
 *   2. GET .../commits/ → list all remote commits
 *   3. Diff local vs remote commits, find new ones
 *   4. For each new commit, fetch tree + blobs via individual endpoints
 *   5. Store objects locally
 *   6. If diverged: run 3-way merge. If fast-forward: advance pointer
 *
 * ============================================================================
 */

const fs = require('fs').promises;
const path = require('path');
const chalk = require('chalk');
const ora = require('ora');
const { getGentPath, readJSON, writeJSON } = require('../utils/fileSystem');
const { COMMITS_FILE, CONFIG_FILE, API_ENDPOINTS, buildRepoUrl, parseRemoteUrl } = require('../utils/constants');
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

        const repoInfo = parseRemoteUrl(remoteConfig.url);
        if (!repoInfo) {
            spinner.fail(chalk.red('Invalid remote URL format'));
            console.log(chalk.yellow('Expected: /api/repos/{owner_id}/{repo_name}'));
            return;
        }

        const repository = await readJSON(path.join(gentPath, COMMITS_FILE));
        const branch = branchName || repository.currentBranch;
        const localHead = repository.branches[branch] || null;

        // 1. Get remote branch info to find remote HEAD
        spinner.text = `Fetching branch info for ${branch}...`;
        let remoteHead;
        try {
            const branchInfo = await apiClient.get(
                buildRepoUrl(API_ENDPOINTS.REPO_BRANCH_DETAIL, { ...repoInfo, branch_name: branch })
            );
            remoteHead = branchInfo.commit_sha;
        } catch (error) {
            if (error.response?.status === 404) {
                spinner.succeed(chalk.green('Remote branch not found — nothing to pull'));
                return;
            }
            throw error;
        }

        if (!remoteHead || remoteHead === localHead) {
            spinner.succeed(chalk.green('Already up-to-date'));
            return;
        }

        // 2. Fetch all remote commits
        spinner.text = `Fetching commits...`;
        const remoteCommits = await apiClient.get(
            buildRepoUrl(API_ENDPOINTS.REPO_COMMITS, repoInfo)
        );

        // 3. Find commits we don't have locally
        const localCommitSet = new Set((repository.commits || []).map(c => c.hash || c.sha));
        const newRemoteCommits = remoteCommits.filter(c => !localCommitSet.has(c.sha));

        if (newRemoteCommits.length === 0) {
            // We have all commits but pointer is different — update ref
            config.remoteRefs = config.remoteRefs || {};
            config.remoteRefs[`${remote}/${branch}`] = remoteHead;
            await writeJSON(path.join(gentPath, CONFIG_FILE), config);
            spinner.succeed(chalk.green('Already up-to-date'));
            return;
        }

        // 4. For each new commit, fetch tree and blobs
        spinner.text = `Fetching ${newRemoteCommits.length} new commit(s) + objects...`;

        const fetchedCommits = [];
        for (const commit of newRemoteCommits) {
            // Fetch tree for this commit
            let treeEntries = [];
            if (commit.tree_sha) {
                try {
                    const tree = await apiClient.get(
                        buildRepoUrl(API_ENDPOINTS.REPO_TREE_DETAIL, { ...repoInfo, sha: commit.tree_sha })
                    );
                    treeEntries = tree.entries || [];
                } catch {
                    // Tree may not be available
                }
            }

            // Fetch and store blobs
            for (const entry of treeEntries) {
                if (entry.type === 'blob' && entry.sha) {
                    if (!(await objectExists(gentPath, entry.sha))) {
                        try {
                            const blob = await apiClient.get(
                                buildRepoUrl(API_ENDPOINTS.REPO_BLOB_DETAIL, { ...repoInfo, sha: entry.sha })
                            );
                            if (blob.content) {
                                const buf = Buffer.from(blob.content, 'base64');
                                await storeBlob(gentPath, buf);
                            }
                        } catch {
                            // Blob fetch failed, continue
                        }
                    }
                }
            }

            // Convert remote commit format to local format
            fetchedCommits.push({
                hash: commit.sha,
                message: commit.message,
                author: { name: commit.author_name, email: commit.author_email },
                timestamp: commit.committed_at,
                parent: commit.parent_shas && commit.parent_shas[0] || null,
                mergeParent: commit.parent_shas && commit.parent_shas[1] || null,
                treeHash: commit.tree_sha,
                tree: treeEntries.map(e => ({
                    mode: e.mode || '100644',
                    name: e.name,
                    hash: e.sha,
                    type: e.type || 'blob'
                })),
                files: treeEntries.map(e => ({ path: e.name, hash: e.sha })),
                stats: {}
            });
        }

        // 5. Add new commits to local store (dedup)
        let newCount = 0;
        const commitSet = new Set((repository.commits || []).map(c => c.hash));
        for (const commit of fetchedCommits) {
            if (!commitSet.has(commit.hash)) {
                repository.commits = repository.commits || [];
                repository.commits.push(commit);
                commitSet.add(commit.hash);
                newCount++;
            }
        }

        // 6. Merge strategy
        config.remoteRefs = config.remoteRefs || {};

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
        } else if (error.response?.data) {
            console.error(chalk.red(JSON.stringify(error.response.data)));
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
