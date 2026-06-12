#!/usr/bin/env node

/**
 * ============================================================================
 * Gent CLI - A Git-like version control system with cloud backend
 * Main entry point for the CLI application
 * ============================================================================
 *
 * COMMANDS:
 *   Setup:       setup, config, doctor
 *   Repository:  init, clone
 *   Staging:     add, rm, reset, status, diff
 *   History:     commit, log, show, tag, explain
 *   Branching:   branch, checkout, merge, resolve, stash
 *   Safety:      undo, redo
 *   Insight:     summary, ask, review, docs, changelog
 *   Remote:      remote, repos, push, pull, search, web, share
 *   Auth:        register, login, logout, whoami
 *   AI:          ai (status|test|models)
 *   Templates:   template (list|use)
 *
 * @author Abdalrahman Kanawati
 * @version 7.0.0
 */

// Boot: load env files BEFORE anything else reads process.env.
require('./utils/env-loader').load();

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
const undoCommand = require('./commands/undo');
const resolveCommand = require('./commands/resolve');
const summaryCommand = require('./commands/summary');
const explainCommand = require('./commands/explain');

// Import auth commands
const registerCommand = require('./commands/register');
const loginCommand = require('./commands/login');
const logoutCommand = require('./commands/logout');
const whoamiCommand = require('./commands/whoami');

// Import new gent-platform commands
const configCommand = require('./commands/config');
const doctorCommand = require('./commands/doctor');
const setupCommand = require('./commands/setup');
const aiCommand = require('./commands/ai');
const askCommand = require('./commands/ask');
const reviewCommand = require('./commands/review');
const docsCommand = require('./commands/docs');
const changelogCommand = require('./commands/changelog');
const webCommand = require('./commands/web');
const shareCommand = require('./commands/share');
const searchCommand = require('./commands/search');
const templateCommand = require('./commands/template');

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
    .option('--ai', 'Suggest a commit message with AI (needs ANTHROPIC_API_KEY)')
    .action(commitCommand);

program
    .command('log')
    .description('Show commit logs')
    .option('-n, --number <count>', 'Limit the number of commits to show', '10')
    .option('--oneline', 'Show each commit on a single line')
    .option('--graph', 'Show an ASCII commit graph with branches and merges')
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

program
    .command('explain [ref]')
    .description('Explain a commit or staged changes in plain language')
    .option('--staged', 'Explain staged changes instead of a commit')
    .action(explainCommand);

program
    .command('summary')
    .description('Show a repository health & statistics dashboard')
    .option('--ai', 'Add an AI-written health narrative (needs ANTHROPIC_API_KEY)')
    .action(summaryCommand);

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
    .command('resolve')
    .description('Interactively resolve merge conflicts left by "gent merge"')
    .action(resolveCommand);

program
    .command('stash [subcommand]')
    .description('Stash working tree changes (pop|list|drop|apply)')
    .option('-m, --message <message>', 'Stash message')
    .option('-i, --index <index>', 'Stash index for pop/apply/drop')
    .action(stashCommand);

program
    .command('undo')
    .description('Reverse the last history-changing operation (safety net)')
    .option('-l, --list', 'Show the operation history')
    .action(undoCommand);

program
    .command('redo')
    .description('Re-apply the last undone operation')
    .action(undoCommand.redo);

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

// ─── Setup, Config & Diagnostics ────────────────────────

program
    .command('setup')
    .description('Interactive first-run wizard (backend URL, login, AI key, identity)')
    .action(setupCommand);

program
    .command('config [subcommand] [args...]')
    .description('Manage CLI settings (list|get|set|unset|path) — e.g. gent config set ai.api_key <key>')
    .action(configCommand);

program
    .command('doctor')
    .description('Run a health check across node, repo, auth, backend, and AI key')
    .option('--ai', 'Also live-test the AI key with a tiny request')
    .action(doctorCommand);

program
    .command('ai [subcommand]')
    .description('Inspect AI integration (status|test|models)')
    .action(aiCommand);

// ─── Platform-special (AI-powered) ──────────────────────

program
    .command('ask <question>')
    .description('Ask Claude a question about this repo (needs AI key)')
    .action(askCommand);

program
    .command('review [ref]')
    .description('AI code review on staged changes (default), HEAD, or a specific commit')
    .option('--staged', 'Force review of staged changes')
    .option('--head', 'Force review of HEAD commit')
    .action(reviewCommand);

program
    .command('docs')
    .description('Generate a README.md draft for this repo using AI')
    .option('--write', 'Write the draft to README.md instead of stdout')
    .option('--section <name>', 'Only generate a single named section')
    .action(docsCommand);

program
    .command('changelog [range]')
    .description('Print a changelog. range = <from>..<to> or <from> (default: since last tag)')
    .option('--plain', 'Skip AI grouping — flat commit list')
    .action(changelogCommand);

program
    .command('web')
    .description('Open the current repo (or a branch/commit) on the gent web app')
    .option('--branch <name>', 'Open a specific branch')
    .option('--commit <hash>', 'Open a specific commit')
    .option('--print', 'Print the URL instead of launching a browser')
    .action(webCommand);

program
    .command('share')
    .description('Print a shareable link to current branch tip (or --branch/--commit)')
    .option('--branch <name>', 'Link to a specific branch')
    .option('--commit <hash>', 'Link to a specific commit')
    .action(shareCommand);

program
    .command('search [query]')
    .description('Search your repositories on the gent backend')
    .option('--mine', 'Only repos you own')
    .option('--json', 'Output as JSON')
    .action(searchCommand);

program
    .command('template [subcommand] [args...]')
    .description('Quick-start from a baked-in template (list|use <name> [directory])')
    .action(templateCommand);

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

// Friendlier global error mapping. Per-command handlers still own their own
// errors; this catches anything that bubbles up (e.g. unknown command).
function explainError(err) {
    if (!err) return '';
    if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
        return `Cannot reach the gent backend. Check the URL with \`gent config get api.base_url\` and try \`gent doctor\`.`;
    }
    if (err.code === 'commander.unknownCommand') {
        return `${err.message}\n\nRun \`gent\` (no args) to see the command list, or \`gent help <command>\` for details.`;
    }
    return err.message;
}

function showQuickstart() {
    console.log();
    console.log(chalk.bold.cyan('Gent CLI ') + chalk.gray(`v${packageJson.version}`));
    console.log(chalk.gray('A Git-like VCS with cloud sync + AI superpowers.\n'));
    console.log(chalk.bold('First time? Try:'));
    console.log(`  ${chalk.cyan('gent setup')}              ${chalk.gray('interactive walkthrough (login + AI key + remote)')}`);
    console.log(`  ${chalk.cyan('gent doctor')}             ${chalk.gray('check everything is wired up')}`);
    console.log(`  ${chalk.cyan('gent template list')}      ${chalk.gray('scaffold a starter project')}`);
    console.log();
    console.log(chalk.bold('Everyday flow:'));
    console.log(`  ${chalk.cyan('gent init && gent add -A && gent commit -m "init"')}`);
    console.log(`  ${chalk.cyan('gent push')} / ${chalk.cyan('gent pull')} / ${chalk.cyan('gent merge <branch>')}`);
    console.log();
    console.log(chalk.bold('AI features (need an Anthropic key):'));
    console.log(`  ${chalk.cyan('gent ask "what does this repo do?"')}`);
    console.log(`  ${chalk.cyan('gent review')}             ${chalk.gray('review staged changes')}`);
    console.log(`  ${chalk.cyan('gent docs --write')}       ${chalk.gray('generate README.md')}`);
    console.log(`  ${chalk.cyan('gent changelog')}          ${chalk.gray('grouped release notes')}`);
    console.log();
    console.log(chalk.gray('Full command list: ') + chalk.cyan('gent --help'));
    console.log();
}

// Error handling
program.exitOverride();

try {
    // Show quickstart if no command provided (instead of raw help).
    if (!process.argv.slice(2).length) {
        showQuickstart();
        process.exit(0);
    }

    program.parse(process.argv);

} catch (err) {
    if (err.code !== 'commander.help' && err.code !== 'commander.helpDisplayed' && err.code !== 'commander.version') {
        console.error(chalk.red('Error:'), explainError(err));
        process.exit(1);
    }
}
