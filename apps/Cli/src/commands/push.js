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
 *   2. Collect all blob objects referenced by those commits
 *   3. POST packfile (commits + blobs + trees) to remote /push/ endpoint
 *   4. Remote updates branch pointer
 *
 * DATA FORMAT SENT TO BACKEND:
 *   POST /api/repos/:id/push/
 *   {
 *     branch: "main",
 *     force: false,
 *     commits: [ { hash, message, author, timestamp, parent, treeHash, tree, files, stats } ],
 *     objects: [ { hash, type: "blob", data: "<base64>" } ],
 *     tags: { "v1.0": { hash, message, ... } }
 *   }
 *
 * BACKEND EXPECTATIONS:
 *   - Validate auth (JWT Bearer token)
 *   - Verify fast-forward (reject non-ff unless force=true)
 *   - Store blob objects in backend object store
 *   - Append commits to branch history
 *   - Update branch refs
 *   - Return { success, ref, hash }
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
const { readBlob, objectExists } = require('../utils/hash-engine');

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

        // Collect all blob hashes from commits to push
        const blobHashes = new Set();
        for (const commit of commitsToPush) {
            const tree = commit.tree || commit.files || [];
            for (const entry of tree) {
                const h = entry.hash;
                if (h) blobHashes.add(h);
            }
        }

        // Read blob data for transfer
        const objects = [];
        for (const hash of blobHashes) {
            try {
                if (await objectExists(gentPath, hash)) {
                    const data = await readBlob(gentPath, hash);
                    objects.push({
                        hash,
                        type: 'blob',
                        data: data.toString('base64')
                    });
                }
            } catch {
                // Skip missing blobs
            }
        }

        // Build push payload
        const payload = {
            branch,
            force: !!options.force,
            commits: commitsToPush.map(c => ({
                hash: c.hash,
                message: c.message,
                author: c.author,
                timestamp: c.timestamp,
                parent: c.parent,
                mergeParent: c.mergeParent || null,
                treeHash: c.treeHash || null,
                tree: c.tree || null,
                files: c.files || [],
                stats: c.stats || {}
            })),
            objects,
            tags: repository.tags || {}
        };

        // Send to backend
        const response = await apiClient.post(
            `${remoteConfig.url}/push/`,
            payload
        );

        // Update remote ref
        config.remoteRefs[`${remote}/${branch}`] = localHead;
        await writeJSON(configPath, config);

        spinner.succeed(chalk.green(`Pushed ${commitsToPush.length} commit(s) to ${remote}/${branch}`));
        console.log(chalk.gray(`  ${localHead.substring(0, 7)} → ${remote}/${branch}`));
        console.log(chalk.gray(`  ${objects.length} object(s) transferred`));

    } catch (error) {
        spinner.fail(chalk.red('Push failed'));

        if (error.response?.status === 409) {
            console.error(chalk.red('Remote has changes you don\'t have locally'));
            console.log(chalk.yellow('Run "gent pull" first, or use "gent push --force"'));
        } else if (error.response?.status === 401) {
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
