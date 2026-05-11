/**
 * ============================================================================
 * Clone Command - Clone a remote repository to local filesystem
 * ============================================================================
 *
 * PURPOSE:
 *   Download an entire repository (commits + objects) from a remote server
 *   and set up a local working copy. Like `git clone`.
 *
 * USAGE:
 *   gent clone <url>                   → Clone into folder named after repo
 *   gent clone <url> <directory>       → Clone into specific directory
 *
 * ALGORITHM (client-side, no /clone/ endpoint):
 *   1. Parse URL to get owner_id + repo_name
 *   2. GET repo details → name, description, default_branch
 *   3. GET branches list → all branch names + SHAs
 *   4. GET commits list → all commits
 *   5. For each commit, fetch tree + blobs
 *   6. Create .gent/ directory structure
 *   7. Store all objects locally
 *   8. Checkout HEAD (restore working tree from latest commit)
 *
 * ============================================================================
 */

const fs = require('fs').promises;
const path = require('path');
const chalk = require('chalk');
const ora = require('ora');
const { ensureDir, writeJSON, pathExists } = require('../utils/fileSystem');
const { GENT_DIR, CONFIG_FILE, STAGING_FILE, COMMITS_FILE, API_ENDPOINTS, buildRepoUrl, parseRemoteUrl } = require('../utils/constants');
const apiClient = require('../utils/api-client');
const authStorage = require('../utils/auth-storage');
const { storeBlob, readBlobAsString, decodeRemoteBlobContent } = require('../utils/hash-engine');

/**
 * Clone remote repository
 * @param {String} url - Remote repository URL (e.g. /api/repos/1/my-repo)
 * @param {String} directory - Optional target directory
 * @param {Object} options
 */
async function clone(url, directory, options) {
    if (!url) {
        console.error(chalk.red('Usage: gent clone <url> [directory]'));
        return;
    }

    const spinner = ora(`Cloning from ${url}...`).start();

    try {
        // Check auth
        const isAuth = await authStorage.isAuthenticated();
        if (!isAuth) {
            spinner.fail(chalk.red('Not authenticated'));
            console.log(chalk.yellow('Run "gent login" first'));
            return;
        }

        // Parse URL
        const repoInfo = parseRemoteUrl(url);
        if (!repoInfo) {
            spinner.fail(chalk.red('Invalid repository URL'));
            console.log(chalk.yellow('Expected format: /api/repos/{owner_id}/{repo_name}'));
            return;
        }

        // 1. Get repo details
        spinner.text = 'Fetching repository info...';
        const repoDetail = await apiClient.get(
            buildRepoUrl(API_ENDPOINTS.REPO_DETAIL, repoInfo)
        );

        const repoName = repoDetail.name || repoInfo.repo_name;
        const defaultBranch = repoDetail.default_branch || 'main';
        const targetDir = directory || repoName;
        const targetPath = path.resolve(process.cwd(), targetDir);

        if (await pathExists(targetPath)) {
            const items = await fs.readdir(targetPath);
            if (items.length > 0) {
                spinner.fail(chalk.red(`Directory '${targetDir}' is not empty`));
                return;
            }
        }

        // 2. Get branches
        spinner.text = 'Fetching branches...';
        let remoteBranches = [];
        try {
            remoteBranches = await apiClient.get(
                buildRepoUrl(API_ENDPOINTS.REPO_BRANCHES, repoInfo)
            );
        } catch {
            // No branches yet
        }

        // 3. Get all commits
        spinner.text = 'Fetching commits...';
        let remoteCommits = [];
        try {
            remoteCommits = await apiClient.get(
                buildRepoUrl(API_ENDPOINTS.REPO_COMMITS, repoInfo)
            );
        } catch {
            // No commits yet
        }

        // 4. Get tags
        spinner.text = 'Fetching tags...';
        let remoteTags = [];
        try {
            remoteTags = await apiClient.get(
                buildRepoUrl(API_ENDPOINTS.REPO_TAGS, repoInfo)
            );
        } catch {
            // No tags
        }

        // Create directory structure
        spinner.text = 'Setting up repository...';
        const gentPath = path.join(targetPath, GENT_DIR);
        await ensureDir(gentPath);
        await ensureDir(path.join(gentPath, 'objects'));
        await ensureDir(path.join(gentPath, 'refs', 'heads'));
        await ensureDir(path.join(gentPath, 'refs', 'tags'));

        // 5. For each commit, fetch tree and blobs
        const localCommits = [];
        let objectCount = 0;

        for (let i = 0; i < remoteCommits.length; i++) {
            const commit = remoteCommits[i];
            spinner.text = `Fetching objects (${i + 1}/${remoteCommits.length})...`;

            let treeEntries = [];
            if (commit.tree_sha) {
                try {
                    const tree = await apiClient.get(
                        buildRepoUrl(API_ENDPOINTS.REPO_TREE_DETAIL, { ...repoInfo, sha: commit.tree_sha })
                    );
                    treeEntries = tree.entries || [];
                } catch {
                    // Tree not available
                }
            }

            // Fetch and store blobs
            for (const entry of treeEntries) {
                if (entry.type === 'blob' && entry.sha) {
                    try {
                        const blob = await apiClient.get(
                            buildRepoUrl(API_ENDPOINTS.REPO_BLOB_DETAIL, { ...repoInfo, sha: entry.sha })
                        );
                        if (blob.content) {
                            const buf = decodeRemoteBlobContent(blob.content, entry.sha);
                            await storeBlob(gentPath, buf);
                            objectCount++;
                        }
                    } catch {
                        // Blob fetch failed
                    }
                }
            }

            // Convert to local commit format
            localCommits.push({
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

        // Build branches map
        const branches = {};
        for (const b of remoteBranches) {
            branches[b.name] = b.commit_sha;
        }
        if (!branches[defaultBranch]) {
            branches[defaultBranch] = null;
        }

        // Build tags map
        const tagsMap = {};
        for (const t of remoteTags) {
            tagsMap[t.name] = {
                hash: t.commit_sha,
                message: t.message || '',
                annotated: t.annotated || false,
                tagger: { name: t.tagger_name || '', email: t.tagger_email || '' },
                timestamp: t.created_at
            };
        }

        // Write commits.json
        const repoData = {
            commits: localCommits,
            branches,
            currentBranch: defaultBranch,
            tags: tagsMap
        };
        await writeJSON(path.join(gentPath, COMMITS_FILE), repoData);

        // Write config with remote
        const config = {
            user: { name: '', email: '' },
            repository: {
                name: repoName,
                description: repoDetail.description || '',
                created: new Date().toISOString()
            },
            remotes: {
                origin: { url }
            },
            remoteRefs: {}
        };

        const headHash = branches[defaultBranch];
        if (headHash) {
            config.remoteRefs[`origin/${defaultBranch}`] = headHash;
        }

        await writeJSON(path.join(gentPath, CONFIG_FILE), config);

        // Write staging.json
        await writeJSON(path.join(gentPath, STAGING_FILE), { entries: [], files: [] });

        // Write HEAD file
        await fs.writeFile(
            path.join(gentPath, 'HEAD'),
            `ref: refs/heads/${defaultBranch}\n`
        );

        // Create .gentignore
        const ignorePath = path.join(targetPath, '.gentignore');
        await fs.writeFile(ignorePath, `# Gent ignore\nnode_modules/\n.DS_Store\n*.log\n.env\n.gent/\n`);

        // Checkout working tree from HEAD commit
        if (headHash) {
            const headCommit = localCommits.find(c => c.hash === headHash);
            if (headCommit) {
                const tree = headCommit.tree || [];

                spinner.text = 'Checking out files...';
                let fileCount = 0;
                for (const entry of tree) {
                    try {
                        const content = await readBlobAsString(gentPath, entry.hash);
                        const fullPath = path.join(targetPath, entry.name || entry.path);
                        await fs.mkdir(path.dirname(fullPath), { recursive: true });
                        await fs.writeFile(fullPath, content, 'utf-8');
                        fileCount++;
                    } catch {
                        // Blob missing
                    }
                }

                spinner.succeed(chalk.green(`Cloned into '${targetDir}'`));
                console.log(chalk.gray(`  ${localCommits.length} commit(s), ${objectCount} object(s), ${fileCount} file(s)`));
            } else {
                spinner.succeed(chalk.green(`Cloned into '${targetDir}' (empty)`));
            }
        } else {
            spinner.succeed(chalk.green(`Cloned into '${targetDir}' (no commits)`));
        }

    } catch (error) {
        spinner.fail(chalk.red('Clone failed'));
        if (error.response?.status === 404) {
            console.error(chalk.red('Repository not found'));
        } else if (error.response?.status === 401) {
            console.error(chalk.red('Authentication failed — run "gent login"'));
        } else if (error.response?.data) {
            console.error(chalk.red(JSON.stringify(error.response.data)));
        } else {
            console.error(chalk.red('Error:'), error.message);
        }
        process.exit(1);
    }
}

module.exports = clone;
