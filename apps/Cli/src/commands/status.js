/**
 * Status Command - Show the working tree status
 * Displays staged, modified, and untracked files
 */

const fs = require('fs').promises;
const path = require('path');
const chalk = require('chalk');
const { getGentPath, readJSON, pathExists, getTrackedFiles, getIgnorePatterns } = require('../utils/fileSystem');
const { STAGING_FILE, COMMITS_FILE } = require('../utils/constants');
const { getFileHash, getAllFiles } = require('../utils/helpers');

/**
 * Show repository status
 * @param {Object} options - Command options
 */
async function status(options) {
    try {
        const gentPath = await getGentPath();
        const cwd = process.cwd();

        // Read staging area and commits
        const staging = await readJSON(path.join(gentPath, STAGING_FILE));
        const repository = await readJSON(path.join(gentPath, COMMITS_FILE));

        const stagedFiles = staging.files || [];
        const currentBranch = repository.currentBranch || 'main';
        const lastCommit = repository.branches[currentBranch];

        // Get all files in the working directory
        const ignorePatterns = await getIgnorePatterns(cwd);
        const allFiles = await getAllFiles(cwd, ignorePatterns);

        // Get tracked files from last commit
        const trackedFiles = await getTrackedFiles(gentPath, lastCommit);

        // Categorize files
        const stagedSet = new Set(stagedFiles);
        const trackedSet = new Set(trackedFiles.map(f => f.path));

        const modified = [];
        const untracked = [];
        const deleted = [];

        // Check for modifications and untracked files
        for (const file of allFiles) {
            const relativePath = path.relative(cwd, file);

            if (trackedSet.has(relativePath)) {
                // Check if modified
                const currentHash = await getFileHash(file);
                const trackedFile = trackedFiles.find(f => f.path === relativePath);

                if (trackedFile && currentHash !== trackedFile.hash && !stagedSet.has(relativePath)) {
                    modified.push(relativePath);
                }
            } else if (!stagedSet.has(relativePath)) {
                untracked.push(relativePath);
            }
        }

        // Check for deleted files
        for (const trackedFile of trackedFiles) {
            const fullPath = path.join(cwd, trackedFile.path);
            if (!await pathExists(fullPath) && !stagedSet.has(trackedFile.path)) {
                deleted.push(trackedFile.path);
            }
        }

        // Display status
        if (options.short) {
            displayShortStatus(stagedFiles, modified, untracked, deleted);
        } else {
            displayDetailedStatus(currentBranch, stagedFiles, modified, untracked, deleted, lastCommit);
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
 * Display detailed status output
 */
function displayDetailedStatus(branch, staged, modified, untracked, deleted, lastCommit) {
    console.log(chalk.bold(`On branch ${chalk.cyan(branch)}`));

    if (!lastCommit) {
        console.log(chalk.gray('No commits yet\n'));
    } else {
        console.log(chalk.gray(`Last commit: ${lastCommit.substring(0, 7)}\n`));
    }

    // Staged files
    if (staged.length > 0) {
        console.log(chalk.green.bold('Changes to be committed:'));
        console.log(chalk.gray('  (use "gent reset <file>..." to unstage)\n'));
        staged.forEach(file => {
            console.log(chalk.green(`\t${file}`));
        });
        console.log();
    }

    // Modified files
    if (modified.length > 0) {
        console.log(chalk.red.bold('Changes not staged for commit:'));
        console.log(chalk.gray('  (use "gent add <file>..." to update what will be committed)\n'));
        modified.forEach(file => {
            console.log(chalk.red(`\tmodified:   ${file}`));
        });
        console.log();
    }

    // Deleted files
    if (deleted.length > 0) {
        deleted.forEach(file => {
            console.log(chalk.red(`\tdeleted:    ${file}`));
        });
        console.log();
    }

    // Untracked files
    if (untracked.length > 0) {
        console.log(chalk.red.bold('Untracked files:'));
        console.log(chalk.gray('  (use "gent add <file>..." to include in what will be committed)\n'));
        untracked.forEach(file => {
            console.log(chalk.red(`\t${file}`));
        });
        console.log();
    }

    // Status summary
    if (staged.length === 0 && modified.length === 0 && untracked.length === 0 && deleted.length === 0) {
        console.log(chalk.green('✓ Working tree clean'));
    } else if (staged.length === 0) {
        console.log(chalk.yellow('No changes added to commit (use "gent add" to track files)'));
    }
}

/**
 * Display short status output
 */
function displayShortStatus(staged, modified, untracked, deleted) {
    staged.forEach(file => {
        console.log(chalk.green('A  ') + file);
    });

    modified.forEach(file => {
        console.log(chalk.red(' M ') + file);
    });

    deleted.forEach(file => {
        console.log(chalk.red(' D ') + file);
    });

    untracked.forEach(file => {
        console.log(chalk.red('?? ') + file);
    });
}

module.exports = status;
