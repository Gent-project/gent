/**
 * Init Command - Initialize a new gent repository
 * Creates .gent directory and necessary files
 */

const fs = require('fs').promises;
const path = require('path');
const chalk = require('chalk');
const inquirer = require('inquirer');
const ora = require('ora');
const boxen = require('boxen');
const { ensureDir, writeJSON, pathExists } = require('../utils/fileSystem');
const { GENT_DIR, CONFIG_FILE, STAGING_FILE, COMMITS_FILE } = require('../utils/constants');

/**
 * Initialize a new gent repository
 * @param {Object} options - Command options
 */
async function init(options) {
    const spinner = ora('Initializing gent repository...').start();

    try {
        const cwd = process.cwd();
        const gentPath = path.join(cwd, GENT_DIR);

        // Check if already initialized
        if (await pathExists(gentPath)) {
            spinner.fail(chalk.red('Gent repository already exists!'));
            console.log(chalk.yellow('\nℹ Use gent status to see the current state'));
            return;
        }

        // Get user configuration if not using defaults
        let config = {
            user: {
                name: 'Anonymous',
                email: 'anonymous@example.com'
            },
            repository: {
                name: path.basename(cwd),
                description: 'A gent repository',
                created: new Date().toISOString()
            }
        };

        if (!options.yes) {
            spinner.stop();

            const answers = await inquirer.prompt([
                {
                    type: 'input',
                    name: 'userName',
                    message: 'Enter your name:',
                    default: 'Anonymous'
                },
                {
                    type: 'input',
                    name: 'userEmail',
                    message: 'Enter your email:',
                    default: 'anonymous@example.com',
                    validate: (input) => {
                        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                        return emailRegex.test(input) || 'Please enter a valid email';
                    }
                },
                {
                    type: 'input',
                    name: 'repoName',
                    message: 'Repository name:',
                    default: path.basename(cwd)
                },
                {
                    type: 'input',
                    name: 'repoDescription',
                    message: 'Repository description:',
                    default: 'A gent repository'
                }
            ]);

            config.user.name = answers.userName;
            config.user.email = answers.userEmail;
            config.repository.name = answers.repoName;
            config.repository.description = answers.repoDescription;

            spinner.start('Creating repository structure...');
        }

        // Create directory structure
        await ensureDir(gentPath);
        await ensureDir(path.join(gentPath, 'objects'));
        await ensureDir(path.join(gentPath, 'refs', 'heads'));
        await ensureDir(path.join(gentPath, 'refs', 'tags'));

        // Create initial files
        await writeJSON(path.join(gentPath, CONFIG_FILE), config);
        await writeJSON(path.join(gentPath, STAGING_FILE), { files: [] });
        await writeJSON(path.join(gentPath, COMMITS_FILE), { commits: [], branches: { main: null }, currentBranch: 'main' });

        // Create HEAD file
        await fs.writeFile(path.join(gentPath, 'HEAD'), 'ref: refs/heads/main\n');

        // Create .gentignore
        const gentignore = `# Gent ignore patterns
node_modules/
.DS_Store
*.log
.env
.gent/
`;
        await fs.writeFile(path.join(cwd, '.gentignore'), gentignore);

        spinner.succeed(chalk.green('✓ Gent repository initialized successfully!'));

        // Display success message
        const message = chalk.white(`
${chalk.bold('Repository:')} ${config.repository.name}
${chalk.bold('User:')} ${config.user.name} <${config.user.email}>
${chalk.bold('Branch:')} main

${chalk.cyan('Next steps:')}
  ${chalk.gray('•')} gent add <files>     - Add files to staging
  ${chalk.gray('•')} gent commit          - Commit your changes
  ${chalk.gray('•')} gent status          - View repository status
    `);

        console.log(boxen(message, {
            padding: 1,
            margin: 1,
            borderStyle: 'round',
            borderColor: 'cyan'
        }));

    } catch (error) {
        spinner.fail(chalk.red('Failed to initialize repository'));
        console.error(chalk.red('\nError:'), error.message);
        process.exit(1);
    }
}

module.exports = init;
