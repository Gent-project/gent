/**
 * Log Command - Show commit logs
 * Displays commit history with details
 */

const path = require('path');
const chalk = require('chalk');
const { formatDistanceToNow } = require('date-fns');
const { getGentPath, readJSON } = require('../utils/fileSystem');
const { COMMITS_FILE } = require('../utils/constants');

/**
 * Show commit history
 * @param {Object} options - Command options
 */
async function log(options) {
    try {
        const gentPath = await getGentPath();
        const repository = await readJSON(path.join(gentPath, COMMITS_FILE));

        const commits = repository.commits || [];
        const currentBranch = repository.currentBranch || 'main';

        if (commits.length === 0) {
            console.log(chalk.yellow('No commits yet'));
            console.log(chalk.gray('Use "gent commit" to create your first commit'));
            return;
        }

        // Limit number of commits to show
        const limit = parseInt(options.number) || 10;
        const commitsToShow = commits.slice(-limit).reverse();

        if (options.oneline) {
            displayOnelineLog(commitsToShow, repository.branches[currentBranch]);
        } else {
            displayDetailedLog(commitsToShow, repository.branches[currentBranch], currentBranch);
        }

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
 * Display detailed commit log
 */
function displayDetailedLog(commits, currentCommitHash, currentBranch) {
    console.log(chalk.bold.cyan(`\nCommit History (${currentBranch} branch):\n`));

    commits.forEach((commit, index) => {
        const isHead = commit.hash === currentCommitHash;
        const headLabel = isHead ? chalk.yellow.bold(' (HEAD)') : '';

        console.log(chalk.yellow(`commit ${commit.hash}`) + headLabel);
        console.log(chalk.white(`Author: ${commit.author.name} <${commit.author.email}>`));
        console.log(chalk.white(`Date:   ${new Date(commit.timestamp).toLocaleString()}`));
        console.log(chalk.gray(`        (${formatDistanceToNow(new Date(commit.timestamp), { addSuffix: true })})`));
        console.log();
        console.log(chalk.white(`    ${commit.message}`));
        console.log();
        console.log(chalk.gray(`    ${commit.files.length} file(s) changed`));

        if (index < commits.length - 1) {
            console.log(chalk.gray('    │'));
        }
        console.log();
    });
}

/**
 * Display oneline commit log
 */
function displayOnelineLog(commits, currentCommitHash) {
    commits.forEach(commit => {
        const isHead = commit.hash === currentCommitHash;
        const headLabel = isHead ? chalk.yellow(' (HEAD)') : '';
        const shortHash = chalk.yellow(commit.hash.substring(0, 7));
        const message = chalk.white(commit.message);
        const timeAgo = chalk.gray(`(${formatDistanceToNow(new Date(commit.timestamp), { addSuffix: true })})`);

        console.log(`${shortHash}${headLabel} ${message} ${timeAgo}`);
    });
}

module.exports = log;
