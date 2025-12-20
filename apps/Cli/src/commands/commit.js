/**
 * Commit Command - Record changes to the repository
 * Creates a new commit with staged files
 */

const path = require('path');
const chalk = require('chalk');
const inquirer = require('inquirer');
const ora = require('ora');
const { getGentPath, readJSON, writeJSON } = require('../utils/fileSystem');
const authStorage = require('../utils/auth-storage');
const { STAGING_FILE, COMMITS_FILE, CONFIG_FILE } = require('../utils/constants');
const { generateCommitHash, getFileHash } = require('../utils/helpers');

/**
 * Create a new commit
 * @param {Object} options - Command options
 */
async function commit(options) {
    try {
        const gentPath = await getGentPath();
        const cwd = process.cwd();

        // Read staging area
        const staging = await readJSON(path.join(gentPath, STAGING_FILE));
        const stagedFiles = staging.files || [];

        if (stagedFiles.length === 0) {
            console.log(chalk.yellow('No changes added to commit'));
            console.log(chalk.gray('Use "gent add <file>..." to stage files'));
            return;
        }

        // Get commit message
        let message = options.message;

        if (!message) {
            const answer = await inquirer.prompt([
                {
                    type: 'input',
                    name: 'message',
                    message: 'Commit message:',
                    validate: (input) => {
                        return input.length > 0 || 'Commit message cannot be empty';
                    }
                }
            ]);
            message = answer.message;
        }

        const spinner = ora('Creating commit...').start();

        const config = await readJSON(path.join(gentPath, CONFIG_FILE));
        const repository = await readJSON(path.join(gentPath, COMMITS_FILE));

        // Resolve author identity
        let authorName = config.user.name;
        let authorEmail = config.user.email;

        // Fallback to global auth if local config is empty
        if (!authorName || !authorEmail) {
            const globalUser = await authStorage.getUser();
            if (globalUser) {
                if (!authorName) {
                    authorName = [globalUser.first_name, globalUser.last_name].filter(Boolean).join(' ');
                }
                if (!authorEmail) {
                    authorEmail = globalUser.email;
                }
            }
        }

        // Fail if still no identity
        if (!authorName || !authorEmail) {
            spinner.stop();
            console.error(chalk.red('Author identity unknown'));
            console.log(chalk.yellow('Please run "gent login" to set your identity globally'));
            return;
        }

        // Create commit object
        const commit = {
            hash: generateCommitHash(),
            message: message,
            author: {
                name: authorName,
                email: authorEmail
            },
            timestamp: new Date().toISOString(),
            parent: repository.branches[repository.currentBranch] || null,
            files: []
        };

        // Hash staged files
        for (const file of stagedFiles) {
            const filePath = path.join(cwd, file);
            const hash = await getFileHash(filePath);
            commit.files.push({
                path: file,
                hash: hash
            });
        }

        // Add commit to repository
        repository.commits = repository.commits || [];
        repository.commits.push(commit);
        repository.branches[repository.currentBranch] = commit.hash;

        // Save repository and clear staging
        await writeJSON(path.join(gentPath, COMMITS_FILE), repository);
        staging.files = [];
        await writeJSON(path.join(gentPath, STAGING_FILE), staging);

        spinner.succeed(chalk.green('✓ Changes committed successfully!'));

        // Display commit info
        console.log(chalk.cyan(`\n[${repository.currentBranch} ${commit.hash.substring(0, 7)}] ${message}`));
        console.log(chalk.gray(`Author: ${commit.author.name} <${commit.author.email}>`));
        console.log(chalk.gray(`Date: ${new Date(commit.timestamp).toLocaleString()}`));
        console.log(chalk.gray(`\n${commit.files.length} file(s) changed`));

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

module.exports = commit;
