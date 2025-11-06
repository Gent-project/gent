/**
 * Add Command - Add file contents to the staging area
 * Stages files for the next commit
 */

const path = require('path');
const chalk = require('chalk');
const ora = require('ora');
const { getGentPath, readJSON, writeJSON, pathExists, getAllFiles, getIgnorePatterns } = require('../utils/fileSystem');
const { STAGING_FILE } = require('../utils/constants');

/**
 * Add files to staging area
 * @param {Array} files - Files to add
 * @param {Object} options - Command options
 */
async function add(files, options) {
    const spinner = ora('Adding files to staging area...').start();

    try {
        const gentPath = await getGentPath();
        const cwd = process.cwd();
        const stagingPath = path.join(gentPath, STAGING_FILE);

        // Read current staging area
        const staging = await readJSON(stagingPath);
        const stagedFiles = new Set(staging.files || []);

        let filesToAdd = [];

        // Handle --all option
        if (options.all || files.includes('.') || files.includes('*')) {
            spinner.text = 'Scanning for all files...';
            const ignorePatterns = await getIgnorePatterns(cwd);
            const allFiles = await getAllFiles(cwd, ignorePatterns);
            filesToAdd = allFiles.map(f => path.relative(cwd, f));
        } else {
            // Add specified files
            for (const file of files) {
                const filePath = path.resolve(cwd, file);

                if (!await pathExists(filePath)) {
                    spinner.warn(chalk.yellow(`Warning: File not found: ${file}`));
                    continue;
                }

                const relativePath = path.relative(cwd, filePath);
                filesToAdd.push(relativePath);
            }
        }

        // Add files to staging
        let addedCount = 0;
        for (const file of filesToAdd) {
            if (!stagedFiles.has(file)) {
                stagedFiles.add(file);
                addedCount++;
            }
        }

        // Save staging area
        staging.files = Array.from(stagedFiles);
        await writeJSON(stagingPath, staging);

        spinner.succeed(chalk.green(`✓ Added ${addedCount} file(s) to staging area`));

        if (addedCount > 0) {
            console.log(chalk.gray('\nStaged files:'));
            staging.files.forEach(file => {
                console.log(chalk.green(`  ${file}`));
            });
            console.log(chalk.cyan('\nℹ Use "gent commit" to record your changes'));
        }

    } catch (error) {
        spinner.fail(chalk.red('Failed to add files'));

        if (error.code === 'ENOENT' && error.message.includes('.gent')) {
            console.error(chalk.red('\nError: Not a gent repository'));
            console.log(chalk.yellow('ℹ Run "gent init" to initialize a repository'));
        } else {
            console.error(chalk.red('\nError:'), error.message);
        }
        process.exit(1);
    }
}

module.exports = add;
