/**
 * Checkout Command - Switch branches
 * Changes the current working branch
 */

const path = require('path');
const chalk = require('chalk');
const { getGentPath, readJSON, writeJSON } = require('../utils/fileSystem');
const { COMMITS_FILE } = require('../utils/constants');

/**
 * Switch to a different branch
 * @param {String} branch - Branch name
 * @param {Object} options - Command options
 */
async function checkout(branch, options) {
    try {
        const gentPath = await getGentPath();
        const repository = await readJSON(path.join(gentPath, COMMITS_FILE));

        const branches = repository.branches || {};

        // Create new branch if -b flag is used
        if (options.create) {
            if (branches.hasOwnProperty(branch)) {
                console.error(chalk.red(`Error: Branch '${branch}' already exists`));
                process.exit(1);
            }

            // Create and switch to new branch
            const currentCommit = branches[repository.currentBranch] || null;
            branches[branch] = currentCommit;
            repository.branches = branches;
            repository.currentBranch = branch;

            await writeJSON(path.join(gentPath, COMMITS_FILE), repository);

            console.log(chalk.green(`✓ Created and switched to branch '${branch}'`));
            return;
        }

        // Switch to existing branch
        if (!branches.hasOwnProperty(branch)) {
            console.error(chalk.red(`Error: Branch '${branch}' not found`));
            console.log(chalk.yellow(`\nℹ Use "gent branch" to see available branches`));
            console.log(chalk.yellow(`ℹ Use "gent checkout -b ${branch}" to create a new branch`));
            process.exit(1);
        }

        if (branch === repository.currentBranch) {
            console.log(chalk.yellow(`Already on branch '${branch}'`));
            return;
        }

        repository.currentBranch = branch;
        await writeJSON(path.join(gentPath, COMMITS_FILE), repository);

        const commitHash = branches[branch];
        const commitInfo = commitHash ? chalk.gray(` at ${commitHash.substring(0, 7)}`) : '';

        console.log(chalk.green(`✓ Switched to branch '${branch}'${commitInfo}`));

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

module.exports = checkout;
