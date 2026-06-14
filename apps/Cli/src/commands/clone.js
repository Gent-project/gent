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
 *   1. GET <url>/clone/ → receives full repo (commits, objects, config)
 *   2. Create .gent/ directory structure
 *   3. Store all blob objects in local object store
 *   4. Write commits.json with full history
 *   5. Checkout HEAD (restore working tree from latest commit)
 *   6. Configure remote "origin" pointing to <url>
 *
 * BACKEND EXPECTATIONS:
 *   GET /api/repos/:id/clone/
 *   Returns:
 *   {
 *     name: "repo-name",
 *     commits: [...],
 *     objects: [ { hash, type, data: "<base64>" } ],
 *     branches: { "main": "<hash>", ... },
 *     currentBranch: "main",
 *     tags: { ... }
 *   }
 *
 * ============================================================================
 */

const fs = require('fs').promises;
const path = require('path');
const chalk = require('chalk');
const ora = require('ora');
const { ensureDir, writeJSON, pathExists } = require('../utils/fileSystem');
const { GENT_DIR, CONFIG_FILE, STAGING_FILE, COMMITS_FILE } = require('../utils/constants');
const apiClient = require('../utils/api-client');
const { storeBlob, readBlobAsString } = require('../utils/hash-engine');

/**
 * Clone remote repository
 * @param {String} url - Remote repository URL
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
        // Fetch full repo from remote
        spinner.text = 'Downloading repository data...';
        const response = await apiClient.get(`${url}/clone/`);

        const repoName = response.name || 'gent-repo';
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

        // Store blob objects
        const objects = response.objects || [];
        spinner.text = `Storing ${objects.length} object(s)...`;

        for (const obj of objects) {
            if (obj.type === 'blob' && obj.data) {
                const buf = Buffer.from(obj.data, 'base64');
                await storeBlob(gentPath, buf);
            }
        }

        // Write commits.json
        const repoData = {
            commits: response.commits || [],
            branches: response.branches || { main: null },
            currentBranch: response.currentBranch || 'main',
            tags: response.tags || {}
        };
        await writeJSON(path.join(gentPath, COMMITS_FILE), repoData);

        // Write config with remote
        const config = {
            user: { name: '', email: '' },
            repository: {
                name: repoName,
                description: response.description || '',
                created: new Date().toISOString()
            },
            remotes: {
                origin: { url }
            },
            remoteRefs: {}
        };

        // Set remote ref to head
        const headHash = repoData.branches[repoData.currentBranch];
        if (headHash) {
            config.remoteRefs[`origin/${repoData.currentBranch}`] = headHash;
        }

        await writeJSON(path.join(gentPath, CONFIG_FILE), config);

        // Write staging.json
        await writeJSON(path.join(gentPath, STAGING_FILE), { entries: [], files: [] });

        // Write HEAD file
        await fs.writeFile(
            path.join(gentPath, 'HEAD'),
            `ref: refs/heads/${repoData.currentBranch}\n`
        );

        // Create .gentignore
        const ignorePath = path.join(targetPath, '.gentignore');
        await fs.writeFile(ignorePath, `# Gent ignore\nnode_modules/\n.DS_Store\n*.log\n.env\n.gent/\n`);

        // Checkout working tree from HEAD commit
        if (headHash) {
            const headCommit = repoData.commits.find(c => c.hash === headHash);
            if (headCommit) {
                const tree = headCommit.tree || (headCommit.files || []).map(f => ({
                    name: f.path || f.name, hash: f.hash
                }));

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
                console.log(chalk.gray(`  ${repoData.commits.length} commit(s), ${objects.length} object(s), ${fileCount} file(s)`));
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
        } else if (error.response?.data?.message) {
            console.error(chalk.red(error.response.data.message));
        } else {
            console.error(chalk.red('Error:'), error.message);
        }
        process.exit(1);
    }
}

module.exports = clone;
