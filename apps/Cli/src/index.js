#!/usr/bin/env node

/**
 * ============================================================================
 * Gent CLI - A Git-like version control system with cloud backend
 * Main entry point for the CLI application
 * ============================================================================
 *
 * COMMANDS:
 *   Repository:  init, clone
 *   Staging:     add, rm, reset, status, diff
 *   History:     commit, log, show, tag
 *   Branching:   branch, checkout, merge, stash
 *   Remote:      remote, push, pull
 *   Auth:        register, login, logout, whoami
 *
 * @author Abdalrahman Kanawati
 * @version 2.0.0
 */

const { program } = require('commander');
const chalk = require('chalk');
const packageJson = require('../package.json');

// Import core commands
const initCommand = require('./commands/init');
const cloneCommand = require('./commands/clone');
const statusCommand = require('./commands/status');
const addCommand = require('./commands/add');
const rmCommand = require('./commands/rm');
const resetCommand = require('./commands/reset');
const diffCommand = require('./commands/diff');
const commitCommand = require('./commands/commit');
const logCommand = require('./commands/log');
const showCommand = require('./commands/show');
const tagCommand = require('./commands/tag');
const branchCommand = require('./commands/branch');
const checkoutCommand = require('./commands/checkout');
const mergeCommand = require('./commands/merge');
const stashCommand = require('./commands/stash');
const remoteCommand = require('./commands/remote');
const pushCommand = require('./commands/push');
const pullCommand = require('./commands/pull');
const reposCommand = require('./commands/repos');

// Import auth commands
const registerCommand = require('./commands/register');
const loginCommand = require('./commands/login');
const logoutCommand = require('./commands/logout');
const whoamiCommand = require('./commands/whoami');

// Configure CLI
program
    .name('gent')
    .description(chalk.cyan('Gent - A Git-like version control CLI with cloud backend'))
    .version(packageJson.version, '-V, --version', 'Output the current version');

// ─── Repository Setup ───────────────────────────────────

program
    .command('init')
    .description('Initialize a new gent repository')
    .option('-y, --yes', 'Skip prompts and use defaults')
    .option('--remote [name]', 'Create a remote repository on the backend')
    .action(initCommand);

program
    .command('clone <url> [directory]')
    .description('Clone a remote repository')
    .action(cloneCommand);

// ─── Staging & Working Tree ─────────────────────────────

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
    .command('rm <files...>')
    .description('Remove files from working tree and staging')
    .option('--cached', 'Only remove from staging, keep file on disk')
    .action(rmCommand);

program
    .command('reset [files...]')
    .description('Unstage files or reset HEAD to a commit')
    .option('--hard <hash>', 'Reset HEAD and working tree to commit')
    .option('--soft <hash>', 'Reset HEAD but keep staging')
    .action(resetCommand);

program
    .command('diff [files...]')
    .description('Show changes between working tree, staging, and commits')
    .option('--staged', 'Show staged changes vs last commit')
    .option('--stat', 'Show diffstat summary only')
    .action(diffCommand);

// ─── History ────────────────────────────────────────────

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
    .option('--stat', 'Show file change statistics')
    .action(logCommand);

program
    .command('show [ref]')
    .description('Show commit details and diff')
    .option('--no-patch', 'Suppress diff output')
    .action(showCommand);

program
    .command('tag [name]')
    .description('Create, list, or delete tags')
    .option('-m, --message <message>', 'Create annotated tag with message')
    .option('-d, --delete <name>', 'Delete a tag')
    .action(tagCommand);

// ─── Branching & Merging ────────────────────────────────

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

program
    .command('merge <branch>')
    .description('Merge a branch into the current branch (3-way smart merge)')
    .option('-m, --message <message>', 'Merge commit message')
    .action(mergeCommand);

program
    .command('stash [subcommand]')
    .description('Stash working tree changes (pop|list|drop|apply)')
    .option('-m, --message <message>', 'Stash message')
    .option('-i, --index <index>', 'Stash index for pop/apply/drop')
    .action(stashCommand);

// ─── Remote & Sync ──────────────────────────────────────

program
    .command('remote [subcommand] [args...]')
    .description('Manage remote connections (add|remove|set-url)')
    .option('-v, --verbose', 'Show remote URLs')
    .action(remoteCommand);

program
    .command('repos')
    .description('List or create remote repositories')
    .option('--create <name>', 'Create a new remote repository')
    .option('--description <text>', 'Repository description (with --create)')
    .option('--private', 'Make repository private (with --create)')
    .option('--default-branch <name>', 'Default branch name (with --create)')
    .action(reposCommand);

program
    .command('push [remote] [branch]')
    .description('Push local commits to remote')
    .option('-f, --force', 'Force push (overwrite remote)')
    .action(pushCommand);

program
    .command('pull [remote] [branch]')
    .description('Pull and merge remote commits')
    .action(pullCommand);

// ─── Authentication ─────────────────────────────────────

program
    .command('register')
    .description('Create a new user account')
    .option('-e, --email <email>', 'Email address')
    .option('-p, --password <password>', 'Password')
    .option('--password-confirm <password>', 'Password confirmation')
    .option('--first-name <name>', 'First name')
    .option('--last-name <name>', 'Last name')
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
    if (err.code !== 'commander.help' && err.code !== 'commander.helpDisplayed' && err.code !== 'commander.version') {
        console.error(chalk.red('Error:'), err.message);
        process.exit(1);
    }
}
