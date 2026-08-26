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
 * ALGORITHM:
 *   1. Parse URL to get owner_id + repo_name
 *   2. GET /clone/ → full snapshot (commits, base64 objects, branches, tags)
 *   3. Create .gent/ structure + store objects locally
 *   4. Write commits.json / config / HEAD / staging
 *   5. Checkout the default branch's tree
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
const { storeBlob, readBlob } = require('../utils/hash-engine');

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

        // Fetch the full repository snapshot in one call.
        spinner.text = 'Fetching repository...';
        const payload = await apiClient.get(
            buildRepoUrl(API_ENDPOINTS.REPO_CLONE, repoInfo)
        );

        const repoName = payload.name || repoInfo.repo_name;
        const defaultBranch = payload.currentBranch || 'main';
        const targetDir = directory || repoName;
        const targetPath = path.resolve(process.cwd(), targetDir);

        if (await pathExists(targetPath)) {
            const items = await fs.readdir(targetPath);
            if (items.length > 0) {
                spinner.fail(chalk.red(`Directory '${targetDir}' is not empty`));
                return;
            }
        }

        // Create directory structure
        spinner.text = 'Setting up repository...';
        const gentPath = path.join(targetPath, GENT_DIR);
        await ensureDir(gentPath);
        await ensureDir(path.join(gentPath, 'objects'));
        await ensureDir(path.join(gentPath, 'refs', 'heads'));
        await ensureDir(path.join(gentPath, 'refs', 'tags'));

        // Store blob objects (base64) into the local object store.
        spinner.text = 'Storing objects...';
        let objectCount = 0;
        for (const obj of payload.objects || []) {
            if (obj.type !== 'blob' || typeof obj.data !== 'string') continue;
            await storeBlob(gentPath, Buffer.from(obj.data, 'base64'));
            objectCount++;
        }

        const localCommits = payload.commits || [];
        const branches = payload.branches || {};
        if (!(defaultBranch in branches)) branches[defaultBranch] = null;

        // Write commits.json
        await writeJSON(path.join(gentPath, COMMITS_FILE), {
            commits: localCommits,
            branches,
            currentBranch: defaultBranch,
            tags: payload.tags || {}
        });

        // Write config with remote
        const config = {
            user: { name: '', email: '' },
            repository: {
                name: repoName,
                description: payload.description || '',
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
                    if (entry.type && entry.type !== 'blob') continue;
                    const relPath = entry.name || entry.path;
                    if (!relPath || !entry.hash) continue;
                    try {
                        // Write the raw Buffer — not a UTF-8 string. Decoding a
                        // binary blob (PNG, PDF, etc.) as UTF-8 would replace
                        // non-utf-8 bytes with U+FFFD, silently corrupting it.
                        const buf = await readBlob(gentPath, entry.hash);
                        const fullPath = path.join(targetPath, relPath);
                        await fs.mkdir(path.dirname(fullPath), { recursive: true });
                        await fs.writeFile(fullPath, buf);
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
        } else if (error.response?.status === 403) {
            console.error(chalk.red('Access denied — you do not have permission to clone this repository'));
        } else if (error.response?.data) {
            console.error(chalk.red(JSON.stringify(error.response.data)));
        } else {
            console.error(chalk.red('Error:'), error.message);
        }
        process.exit(1);
    }
}

module.exports = clone;
