/**
 * Branch Command - List, create, or delete branches
 * Manages repository branches
 */

const path = require('path');
const chalk = require('chalk');
const { getGentPath, readJSON, writeJSON } = require('../utils/fileSystem');
const { COMMITS_FILE } = require('../utils/constants');

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

    delete branches[name];
    repository.branches = branches;

    await writeJSON(path.join(gentPath, COMMITS_FILE), repository);

    console.log(chalk.green(`✓ Deleted branch '${name}'`));
}

module.exports = branch;
