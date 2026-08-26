/**
 * Branch Command - List, create, or delete branches
 * Manages repository branches locally and syncs to remote API
 */

const path = require('path');
const chalk = require('chalk');
const ora = require('ora');
const { getGentPath, readJSON, writeJSON } = require('../utils/fileSystem');
const { COMMITS_FILE, CONFIG_FILE, API_ENDPOINTS, buildRepoUrl, parseRemoteUrl } = require('../utils/constants');
const apiClient = require('../utils/api-client');
const authStorage = require('../utils/auth-storage');
const journal = require('../utils/journal');

/**
 * Manage branches
 * @param {String} name - Branch name (optional)
 * @param {Object} options - Command options
 */
async function branch(name, options) {
    try {
        const gentPath = await getGentPath();
        const repository = await readJSON(path.join(gentPath, COMMITS_FILE));

        // Delete branch
        if (options.delete) {
            await deleteBranch(options.delete, repository, gentPath);
            return;
        }

        // Create new branch
        if (name) {
            await createBranch(name, repository, gentPath);
            return;
        }

        // List branches
        listBranches(repository, options.all);

    } catch (error) {
        if (error.code === 'ENOENT' && error.message.includes('.gent')) {
            console.error(chalk.red('Error: Not a gent repository'));
            console.log(chalk.yellow('\nℹ Run "gent init" to initialize a repository'));
        } else {
            console.error(chalk.red('Error:'), error.message);
        }
        process.exit(1);
    }
}

/**
 * List all branches
 */
function listBranches(repository, showAll) {
    const branches = repository.branches || {};
    const currentBranch = repository.currentBranch || 'main';

    console.log(chalk.bold.cyan('\nBranches:\n'));

    for (const [branch, commitHash] of Object.entries(branches)) {
        const isCurrent = branch === currentBranch;
        const prefix = isCurrent ? chalk.green('* ') : '  ';
        const branchName = isCurrent ? chalk.green.bold(branch) : chalk.white(branch);
        const commitInfo = commitHash ? chalk.gray(` (${commitHash.substring(0, 7)})`) : chalk.gray(' (no commits)');

        console.log(`${prefix}${branchName}${commitInfo}`);
    }

    console.log();
}

/**
 * Create a new branch
 */
async function createBranch(name, repository, gentPath) {
    const branches = repository.branches || {};

    if (branches.hasOwnProperty(name)) {
        console.error(chalk.red(`Error: Branch '${name}' already exists`));
        process.exit(1);
    }

    // Create branch from current HEAD
    const currentCommit = branches[repository.currentBranch] || null;
    branches[name] = currentCommit;
    repository.branches = branches;

    await writeJSON(path.join(gentPath, COMMITS_FILE), repository);

    console.log(chalk.green(`✓ Created branch '${name}'`));
    console.log(chalk.gray(`Based on: ${repository.currentBranch}`));

    // Sync to remote if authenticated and remote configured
    await syncBranchCreate(name, currentCommit, gentPath);
}

/**
 * Delete a branch
 */
async function deleteBranch(name, repository, gentPath) {
    const branches = repository.branches || {};

    if (!branches.hasOwnProperty(name)) {
        console.error(chalk.red(`Error: Branch '${name}' not found`));
        process.exit(1);
    }

    if (name === repository.currentBranch) {
        console.error(chalk.red(`Error: Cannot delete current branch '${name}'`));
        console.log(chalk.yellow('Switch to another branch first using "gent checkout <branch>"'));
        process.exit(1);
    }

    await journal.recordOp(gentPath, 'branch-delete', `delete branch '${name}'`);

    delete branches[name];
    repository.branches = branches;

    await writeJSON(path.join(gentPath, COMMITS_FILE), repository);

    console.log(chalk.green(`✓ Deleted branch '${name}'`));

    // Sync deletion to remote
    await syncBranchDelete(name, gentPath);
}

/**
 * Sync branch creation to remote API
 */
async function syncBranchCreate(name, commitSha, gentPath) {
    try {
        const isAuth = await authStorage.isAuthenticated();
        if (!isAuth) return;

        const config = await readJSON(path.join(gentPath, CONFIG_FILE));
        const remoteConfig = config.remotes && config.remotes.origin;
        if (!remoteConfig) return;

        const repoInfo = parseRemoteUrl(remoteConfig.url);
        if (!repoInfo) return;

        if (!commitSha) return; // No commit to point to

        const url = buildRepoUrl(API_ENDPOINTS.REPO_BRANCHES_CREATE, repoInfo);
        await apiClient.post(url, { name, commit_sha: commitSha });
        console.log(chalk.gray(`  ↑ Synced to remote`));
    } catch (error) {
        // Non-fatal: branch created locally even if remote sync fails
        if (error.response?.status === 400) {
            console.log(chalk.gray(`  ⚠ Remote sync skipped (branch may already exist remotely)`));
        } else if (error.response?.status === 403) {
            console.log(chalk.yellow(`  ⚠ Remote sync skipped — no write access to this repository`));
        }
    }
}

/**
 * Sync branch deletion to remote API
 */
async function syncBranchDelete(name, gentPath) {
    try {
        const isAuth = await authStorage.isAuthenticated();
        if (!isAuth) return;

        const config = await readJSON(path.join(gentPath, CONFIG_FILE));
        const remoteConfig = config.remotes && config.remotes.origin;
        if (!remoteConfig) return;

        const repoInfo = parseRemoteUrl(remoteConfig.url);
        if (!repoInfo) return;

        const url = buildRepoUrl(API_ENDPOINTS.REPO_BRANCH_DETAIL, { ...repoInfo, branch_name: name });
        await apiClient.delete(url);
        console.log(chalk.gray(`  ↑ Deleted from remote`));
    } catch (error) {
        if (error.response?.status === 400) {
            console.log(chalk.gray(`  ⚠ Cannot delete default branch on remote`));
        } else if (error.response?.status === 403) {
            console.log(chalk.yellow(`  ⚠ Remote delete skipped — no write access to this repository`));
        } else if (error.response?.status === 404) {
            // Branch didn't exist remotely, that's fine
        }
    }
}

module.exports = branch;
