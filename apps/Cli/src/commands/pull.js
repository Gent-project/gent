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
 *   1. GET .../pull/?branch=&since= → { commits, objects (base64), head } in one call
 *   2. Store objects locally, add new commits to the local store
 *   3. If diverged: run 3-way merge. If fast-forward: advance the pointer
 *
 * ============================================================================
 */

const fs = require('fs').promises;
const path = require('path');
const chalk = require('chalk');
const ora = require('ora');
const { getGentPath, readJSON, writeJSON } = require('../utils/fileSystem');
const { COMMITS_FILE, CONFIG_FILE, STAGING_FILE, API_ENDPOINTS, buildRepoUrl, parseRemoteUrl } = require('../utils/constants');
const apiClient = require('../utils/api-client');
const authStorage = require('../utils/auth-storage');
const { storeBlob, readBlob, hashBlob } = require('../utils/hash-engine');
const { findMergeBase, mergeTreeEntries } = require('../utils/merge-engine');
const pet = require('./pet');
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
        const currentBranch = repository.currentBranch;
        const branch = branchName || currentBranch;
        const localHead = repository.branches[currentBranch] || null;
        const cwd = path.dirname(gentPath);

        await assertCleanWorkingTree(gentPath, cwd, getCommitTree(repository.commits || [], localHead));

        // 1. Fetch commits + objects for this branch in a single call. `since`
        //    lets the server send only what we don't have on a fast-forward.
        // Genti walks a crate home from the cloud while we fetch.
        spinner.stop();
        let pullData;
        try {
            const pullUrl = buildRepoUrl(API_ENDPOINTS.REPO_PULL, repoInfo);
            const query = localHead
                ? `?branch=${encodeURIComponent(branch)}&since=${encodeURIComponent(localHead)}`
                : `?branch=${encodeURIComponent(branch)}`;
            pullData = await pet.during('pull', () => apiClient.get(pullUrl + query));
        } catch (error) {
            if (error.response?.status === 404) {
                spinner.succeed(chalk.green('Remote branch not found — nothing to pull'));
                return;
            }
            if (error.response?.status === 403) {
                spinner.fail(chalk.red('Access denied — you are not a member of this private repository'));
                return;
            }
            throw error;
        }

        const remoteHead = pullData.head;
        config.remoteRefs = config.remoteRefs || {};

        if (!remoteHead || remoteHead === localHead) {
            if (remoteHead) config.remoteRefs[`${remote}/${branch}`] = remoteHead;
            await writeJSON(path.join(gentPath, CONFIG_FILE), config);
            spinner.succeed(chalk.green('Already up-to-date'));
            return;
        }

        // 2. Store blob objects (base64) into the local object store.
        spinner.text = 'Storing objects...';
        for (const obj of pullData.objects || []) {
            if (obj.type !== 'blob' || typeof obj.data !== 'string') continue;
            await storeBlob(gentPath, Buffer.from(obj.data, 'base64'));
        }

        // 3. Add new remote commits to the local store (dedup by hash). The
        //    server returns them in the CLI's native commit shape already.
        const fetchedCommits = pullData.commits || [];
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

        // 4. Merge strategy
        if (!localHead || isAncestor(repository.commits, localHead, remoteHead)) {
            // Fast-forward
            const previousTree = localHead ? getCommitTree(repository.commits, localHead) : [];
            const nextTree = getCommitTree(repository.commits, remoteHead);
            await checkoutTree(gentPath, cwd, previousTree, nextTree);
            repository.branches[currentBranch] = remoteHead;
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

            const mergeResult = await mergeTreeEntries(
                gentPath,
                baseTree,
                oursTree,
                theirsTree,
                { ours: 'HEAD', theirs: `${remote}/${branch}` }
            );

            // Build merge commit
            const { storeTree } = require('../utils/hash-engine');
            const mergedTreeHash = await storeTree(gentPath, mergeResult.mergedEntries);

            if (mergeResult.hasConflicts) {
                await checkoutTree(gentPath, cwd, oursTree, mergeResult.mergedEntries);
                const staging = await readJSON(path.join(gentPath, STAGING_FILE));
                staging.mergeState = {
                    sourceBranch: `${remote}/${branch}`,
                    oursHash: localHead,
                    theirsHash: remoteHead,
                    baseHash,
                    mergedTreeHash,
                    mergedEntries: mergeResult.mergedEntries,
                    conflicts: mergeResult.conflicts
                };
                await writeJSON(path.join(gentPath, STAGING_FILE), staging);
                await writeJSON(path.join(gentPath, COMMITS_FILE), repository);

                config.remoteRefs[`${remote}/${branch}`] = remoteHead;
                await writeJSON(path.join(gentPath, CONFIG_FILE), config);

                spinner.warn(chalk.yellow(`Pulled with ${mergeResult.conflicts.length} conflict(s)`));
                for (const c of mergeResult.conflicts) {
                    console.log(chalk.red(`  CONFLICT: ${c.file} (${c.type})`));
                }
                console.log(chalk.yellow('\nResolve conflicts, then "gent add" + "gent commit"'));
                process.exitCode = 1;
                return;
            }

            const mergeCommit = {
                hash: generateCommitHash(),
                message: `Merge remote-tracking branch '${remote}/${branch}'`,
                author: (repository.commits.find(c => c.hash === localHead) || {}).author || { name: 'Unknown', email: (await authStorage.getUser())?.email || '' },
                timestamp: new Date().toISOString(),
                parent: localHead,
                mergeParent: remoteHead,
                treeHash: mergedTreeHash,
                tree: mergeResult.mergedEntries,
                files: mergeResult.mergedEntries.map(e => ({ path: e.name, hash: e.hash })),
                stats: { filesChanged: mergeResult.mergedEntries.length, insertions: 0, deletions: 0 }
            };

            repository.commits.push(mergeCommit);
            repository.branches[currentBranch] = mergeCommit.hash;
            await writeJSON(path.join(gentPath, COMMITS_FILE), repository);
            await checkoutTree(gentPath, cwd, oursTree, mergeResult.mergedEntries);

            config.remoteRefs[`${remote}/${branch}`] = remoteHead;
            await writeJSON(path.join(gentPath, CONFIG_FILE), config);

            spinner.succeed(chalk.green(`Merged ${newCount} remote commit(s)`));
            console.log(chalk.gray(`  Merge commit: ${mergeCommit.hash.substring(0, 7)}`));
        }
    } catch (error) {
        spinner.fail(chalk.red('Pull failed'));
        if (error.response?.status === 401) {
            console.error(chalk.red('Authentication failed — run "gent login"'));
        } else if (error.response?.status === 403) {
            console.error(chalk.red('Access denied — you are not a member of this private repository'));
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
    const pending = [hashB];
    const seen = new Set();
    while (pending.length) {
        const cur = pending.pop();
        if (!cur || seen.has(cur)) continue;
        if (cur === hashA) return true;
        seen.add(cur);
        const c = commitMap.get(cur);
        if (c?.parent) pending.push(c.parent);
        if (c?.mergeParent) pending.push(c.mergeParent);
    }
    return false;
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

async function assertCleanWorkingTree(gentPath, cwd, tree) {
    const staging = await readJSON(path.join(gentPath, STAGING_FILE));
    if ((staging.entries || []).length || (staging.files || []).length || staging.mergeState) {
        throw new Error('Commit or stash staged changes before pulling');
    }
    for (const entry of tree) {
        const relPath = entry.name || entry.path;
        const fullPath = safePath(cwd, relPath);
        const stat = await fs.lstat(fullPath).catch(() => null);
        if (!stat || !stat.isFile() || hashBlob(await fs.readFile(fullPath)) !== entry.hash) {
            throw new Error(`Local changes would be overwritten by pull: ${relPath}`);
        }
    }
}

function getCommitTree(commits, hash) {
    const commit = commits.find(c => c.hash === hash);
    if (!commit) return [];
    return commit.tree || (commit.files || []).map(f => ({
        mode: '100644',
        name: f.path || f.name,
        hash: f.hash,
        type: 'blob'
    }));
}

async function checkoutTree(gentPath, cwd, previousTree, nextTree) {
    const previousPaths = new Set(previousTree.map(e => e.name || e.path));
    const nextPaths = new Set(nextTree.map(e => e.name || e.path));
    const writes = new Map();

    // Validate collisions and read every required blob before mutating files.
    for (const entry of nextTree) {
        if (entry.type && entry.type !== 'blob') continue;
        const relPath = entry.name || entry.path;
        if (!relPath || !entry.hash) continue;
        const fullPath = safePath(cwd, relPath);
        if (!previousPaths.has(relPath) && await fs.lstat(fullPath).catch(() => null)) {
            throw new Error(`Untracked file would be overwritten by pull: ${relPath}`);
        }
        writes.set(relPath, await readBlob(gentPath, entry.hash));
    }

    for (const entry of previousTree) {
        const relPath = entry.name || entry.path;
        if (!relPath || nextPaths.has(relPath)) continue;
        try {
            await fs.unlink(safePath(cwd, relPath));
        } catch {
            // File already absent.
        }
    }

    for (const [relPath, buf] of writes) {
        // Write the raw Buffer so binary blobs round-trip byte-exact.
        const fullPath = safePath(cwd, relPath);
        await fs.mkdir(path.dirname(fullPath), { recursive: true });
        await fs.writeFile(fullPath, buf);
    }
}

module.exports = pull;
