#!/usr/bin/env node

/**
 * Gent CLI - A Git-like version control system
 * Main entry point for the CLI application
 * 
 * @author Your Name
 * @version 1.0.0
 */

const { program } = require('commander');
const chalk = require('chalk');
const packageJson = require('../package.json');

// Import commands
const initCommand = require('./commands/init');
const statusCommand = require('./commands/status');
const addCommand = require('./commands/add');
const commitCommand = require('./commands/commit');
const logCommand = require('./commands/log');
const branchCommand = require('./commands/branch');
const checkoutCommand = require('./commands/checkout');

// Import auth commands
const registerCommand = require('./commands/register');
const loginCommand = require('./commands/login');
const logoutCommand = require('./commands/logout');
const whoamiCommand = require('./commands/whoami');

// Configure CLI
program
    .name('gent')
    .description(chalk.cyan('🚀 Gent - A Git-like version control CLI'))
    .version(packageJson.version, '-v, --version', 'Output the current version');

// Register commands
program
    .command('init')
    .description('Initialize a new gent repository')
    .option('-y, --yes', 'Skip prompts and use defaults')
    .action(initCommand);

program
    .command('status')
    .description('Show the working tree status')
    .option('-s, --short', 'Give the output in short format')
    .action(statusCommand);

program
    .command('add <files...>')
    .description('Add file contents to the staging area')
    .option('-A, --all', 'Add all files')
    .action(addCommand);

program
    .command('commit')
    .description('Record changes to the repository')
    .option('-m, --message <message>', 'Commit message')
    .option('-a, --all', 'Automatically stage all modified files')
    .action(commitCommand);

program
    .command('log')
    .description('Show commit logs')
    .option('-n, --number <count>', 'Limit the number of commits to show', '10')
    .option('--oneline', 'Show each commit on a single line')
    .action(logCommand);

program
    .command('branch')
    .description('List, create, or delete branches')
    .argument('[name]', 'Branch name to create')
    .option('-d, --delete <name>', 'Delete a branch')
    .option('-a, --all', 'List all branches')
    .action(branchCommand);

program
    .command('checkout <branch>')
    .description('Switch branches or restore working tree files')
    .option('-b, --create', 'Create a new branch')
    .action(checkoutCommand);

// Authentication commands
program
    .command('register')
    .description('Create a new user account')
    .action(registerCommand);

program
    .command('login')
    .description('Login to your account')
    .option('-e, --email <email>', 'Email address')
    .option('-p, --password <password>', 'Password')
    .action(loginCommand);

program
    .command('logout')
    .description('Logout from your account')
    .action(logoutCommand);

program
    .command('whoami')
    .description('Display current user information')
    .action(whoamiCommand);

// Help command
program
    .command('help [command]')
    .description('Display help for a specific command')
    .action((command) => {
        if (command) {
            program.commands.find(cmd => cmd.name() === command)?.help();
        } else {
            program.help();
        }
    });

// Error handling
program.exitOverride();

try {
    program.parse(process.argv);

    // Show help if no command provided
    if (!process.argv.slice(2).length) {
        program.outputHelp();
    }
} catch (err) {
    if (err.code !== 'commander.help' && err.code !== 'commander.helpDisplayed') {
        console.error(chalk.red('Error:'), err.message);
        process.exit(1);
    }
}
