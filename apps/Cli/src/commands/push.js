/**
 * ============================================================================
 * Push Command - Upload local commits and objects to remote
 * ============================================================================
 *
 * PURPOSE:
 *   Send local commits, blobs, and tree objects to the backend API server.
 *   Like `git push`.
 *
 * USAGE:
 *   gent push                          → Push current branch to origin
 *   gent push <remote> <branch>        → Push specific branch to remote
 *   gent push --force                  → Force push (overwrite remote)
 *
 * ALGORITHM:
 *   1. Read local commits since last known remote HEAD
 *   2. Build proper pack: collect tree objects + blob objects
 *   3. POST packfile to /api/repos/{owner_id}/{repo_name}/push/
 *   4. Remote updates branch pointer via branch_updates
 *
 * DATA FORMAT SENT TO BACKEND (PushPackRequest):
 *   POST /api/repos/{owner_id}/{repo_name}/push/
 *   {
 *     pack: {
 *       commits: [{ sha, message, tree_sha, parent_shas, author_name, author_email, committed_at }],
 *       trees:   [{ sha, entries: [{ type, mode, name, sha }] }],
 *       blobs:   [{ sha, size, content, encoding }]
 *     },
 *     branch_updates: [{ name, commit_sha }],
 *     tags: { "v1.0": { hash, message, ... } }
 *   }
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
const { readBlob, readTree, objectExists, readBlobAsString } = require('../utils/hash-engine');

/**
 * Push commits to remote
 * @param {String} remoteName
 * @param {String} branchName
 * @param {Object} options
 */
async function push(remoteName, branchName, options) {
    const spinner = ora('Preparing push...').start();

    try {
        // Auth check
        const isAuth = await authStorage.isAuthenticated();
        if (!isAuth) {
            spinner.fail(chalk.red('Not authenticated'));
            console.log(chalk.yellow('Run "gent login" first'));
            return;
        }

        const gentPath = await getGentPath();
        const configPath = path.join(gentPath, CONFIG_FILE);
        const config = await readJSON(configPath);
        config.remotes = config.remotes || {};

        // Resolve remote
        const remote = remoteName || 'origin';
        const remoteConfig = config.remotes[remote];
        if (!remoteConfig) {
            spinner.fail(chalk.red(`Remote '${remote}' not found`));
            console.log(chalk.yellow('Use "gent remote add origin <url>" to configure'));
            return;
        }

        // Parse remote URL to get owner_id and repo_name
        const repoInfo = parseRemoteUrl(remoteConfig.url);
        if (!repoInfo) {
            spinner.fail(chalk.red('Invalid remote URL format'));
            console.log(chalk.yellow('Expected: /api/repos/{owner_id}/{repo_name}'));
            console.log(chalk.yellow('Use "gent remote set-url origin <url>" to fix'));
            return;
        }

        const repository = await readJSON(path.join(gentPath, COMMITS_FILE));
        const branch = branchName || repository.currentBranch;
        const localHead = repository.branches[branch];

        if (!localHead) {
            spinner.fail(chalk.red(`Branch '${branch}' has no commits`));
            return;
        }

        // Determine which commits to push (since last pushed ref)
        config.remoteRefs = config.remoteRefs || {};
        const lastPushed = config.remoteRefs[`${remote}/${branch}`] || null;
        const commits = repository.commits || [];
        const commitsToPush = getCommitsSince(commits, localHead, lastPushed);

        if (commitsToPush.length === 0) {
            spinner.succeed(chalk.green('Everything up-to-date'));
            return;
        }

        spinner.text = `Pushing ${commitsToPush.length} commit(s) to ${remote}/${branch}...`;

        // Collect all tree and blob objects from commits
        const treeShas = new Set();
        const blobShas = new Set();

        for (const commit of commitsToPush) {
            // Collect tree SHA
            if (commit.treeHash) {
                treeShas.add(commit.treeHash);
            }
            // Collect blob hashes from tree entries
            const tree = commit.tree || commit.files || [];
            for (const entry of tree) {
                if (entry.hash) blobShas.add(entry.hash);
            }
        }

        // Build tree objects for the pack
        const packTrees = [];
        for (const treeSha of treeShas) {
            try {
                if (await objectExists(gentPath, treeSha)) {
                    const entries = await readTree(gentPath, treeSha);
                    packTrees.push({
                        sha: treeSha,
                        entries: entries.map(e => ({
                            type: e.type || 'blob',
                            mode: e.mode || '100644',
                            name: e.name,
                            sha: e.hash
                        }))
                    });
                }
            } catch {
                // If tree can't be read from object store, build from commit data
            }
        }

        // If no tree objects from object store, build from commit tree data
        if (packTrees.length === 0) {
            for (const commit of commitsToPush) {
                if (commit.treeHash && commit.tree) {
                    packTrees.push({
                        sha: commit.treeHash,
                        entries: commit.tree.map(e => ({
                            type: e.type || 'blob',
                            mode: e.mode || '100644',
                            name: e.name || e.path,
                            sha: e.hash
                        }))
                    });
                }
            }
        }

        // Build blob objects for the pack
        const packBlobs = [];
        for (const hash of blobShas) {
            try {
                if (await objectExists(gentPath, hash)) {
                    const data = await readBlob(gentPath, hash);
                    packBlobs.push({
                        sha: hash,
                        size: data.length,
                        content: data.toString('base64'),
                        encoding: 'base64'
                    });
                }
            } catch {
                // Skip missing blobs
            }
        }

        // Build commits for the pack
        const packCommits = commitsToPush.map(c => ({
            sha: c.hash,
            message: c.message,
            tree_sha: c.treeHash || '',
            parent_shas: [c.parent, c.mergeParent].filter(Boolean),
            author_name: typeof c.author === 'object' ? (c.author.name || 'Unknown') : (c.author || 'Unknown'),
            author_email: typeof c.author === 'object' ? (c.author.email || '') : '',
            committed_at: c.timestamp || new Date().toISOString()
        }));

        // Build push payload matching PushPackRequest schema
        const payload = {
            pack: {
                commits: packCommits,
                trees: packTrees,
                blobs: packBlobs
            },
            branch_updates: [{
                name: branch,
                commit_sha: localHead
            }],
            tags: repository.tags || {}
        };

        // Send to backend
        const pushUrl = buildRepoUrl(API_ENDPOINTS.REPO_PUSH, repoInfo);
        const response = await apiClient.post(pushUrl, payload);

        // Update remote ref
        config.remoteRefs[`${remote}/${branch}`] = localHead;
        await writeJSON(configPath, config);

        spinner.succeed(chalk.green(`Pushed ${commitsToPush.length} commit(s) to ${remote}/${branch}`));
        console.log(chalk.gray(`  ${localHead.substring(0, 7)} → ${remote}/${branch}`));
        console.log(chalk.gray(`  ${packBlobs.length} blob(s), ${packTrees.length} tree(s) transferred`));

    } catch (error) {
        spinner.fail(chalk.red('Push failed'));

        if (error.response?.status === 409) {
            console.error(chalk.red('Remote has changes you don\'t have locally'));
            console.log(chalk.yellow('Run "gent pull" first, or use "gent push --force"'));
        } else if (error.response?.status === 401) {
            console.error(chalk.red('Authentication failed — run "gent login"'));
        } else if (error.response?.status === 403) {
            console.error(chalk.red('Permission denied — only repo owner can push'));
        } else if (error.response?.data) {
            console.error(chalk.red(JSON.stringify(error.response.data, null, 2)));
        } else {
            console.error(chalk.red('Error:'), error.message);
        }
        process.exit(1);
    }
}

/**
 * Get commits from tip back to (but excluding) stopHash.
 * @param {Array} allCommits
 * @param {String} tipHash
 * @param {String|null} stopHash
 * @returns {Array}
 */
function getCommitsSince(allCommits, tipHash, stopHash) {
    const commitMap = new Map(allCommits.map(c => [c.hash, c]));
    const result = [];
    let current = tipHash;

    while (current && current !== stopHash) {
        const commit = commitMap.get(current);
        if (!commit) break;
        result.push(commit);
        current = commit.parent;
    }

    return result.reverse(); // oldest first
}

module.exports = push;
