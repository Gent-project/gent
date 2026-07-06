/**
 * Auto Command - One-shot interactive flow.
 *
 *   gent auto
 *
 * Walks a fresh user from nothing to a pushed commit:
 *   sign in (or register) → init → link a remote → stage → commit → push.
 * Each step no-ops when it's already done, so `gent auto` is safe to re-run.
 */

const path = require('path');
const chalk = require('chalk');
const ora = require('ora');
const boxen = require('boxen');
const inquirer = require('inquirer');

const { pathExists, readJSON, writeJSON } = require('../utils/fileSystem');
const { GENT_DIR, CONFIG_FILE, API_ENDPOINTS, parseRemoteUrl } = require('../utils/constants');
const authStorage = require('../utils/auth-storage');
const authService = require('../services/auth-service');
const apiClient = require('../utils/api-client');
const { isInteractive } = require('../utils/interactive');

const initCommand = require('./init');
const addCommand = require('./add');
const commitCommand = require('./commit');
const pushCommand = require('./push');

async function auto() {
    if (!isInteractive()) {
        console.error(chalk.red('gent auto needs an interactive terminal.'));
        console.log(chalk.yellow('In scripts/CI, use the individual commands: gent init / add / commit / push.'));
        process.exit(1);
    }

    console.log(boxen(
        chalk.bold.cyan('gent auto') + chalk.gray('  — guided flow\n') +
        chalk.white('Sign in → init → link remote → add → commit → push.'),
        { padding: 1, margin: 1, borderStyle: 'round', borderColor: 'cyan' }
    ));

    try {
        await ensureAuth();
        await ensureRepo();
        const linked = await ensureRemote();
        await stageChanges();
        await commitChanges();

        if (linked) {
            await pushChanges();
        } else {
            console.log(chalk.gray('\nSkipped push — no remote linked. Run `gent push` once you link one.'));
        }

        console.log(chalk.green('\n✓ All done.'));
    } catch (err) {
        // Sub-steps handle their own expected errors; this catches anything
        // unexpected (e.g. a corrupt .gent/config.json) with a clean message.
        console.error(chalk.red('\ngent auto stopped:'), err.message);
        process.exit(1);
    }
}

// ─── 1. Account ─────────────────────────────────────────
async function ensureAuth() {
    console.log(chalk.bold('\n1) Account'));

    if (await authStorage.isAuthenticated()) {
        const user = await authStorage.getUser();
        console.log(chalk.green(`  ✓ Signed in as ${user?.email || 'unknown'}`));
        return;
    }

    const { action } = await inquirer.prompt([{
        type: 'list',
        name: 'action',
        message: 'You are not signed in. What would you like to do?',
        choices: [
            { name: 'Log in to an existing account', value: 'login' },
            { name: 'Create a new account', value: 'register' },
        ],
    }]);

    const creds = await inquirer.prompt([
        {
            type: 'input',
            name: 'email',
            message: 'Email:',
            validate: v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) || 'Please enter a valid email',
        },
        {
            type: 'password',
            name: 'password',
            message: 'Password:',
            mask: '*',
            validate: v => v.length > 0 || 'Password is required',
        },
    ]);

    let extra = {};
    if (action === 'register') {
        extra = await inquirer.prompt([
            {
                type: 'password',
                name: 'passwordConfirm',
                message: 'Confirm password:',
                mask: '*',
                validate: v => v === creds.password || 'Passwords do not match',
            },
            { type: 'input', name: 'firstName', message: 'First name:', default: '' },
            { type: 'input', name: 'lastName', message: 'Last name:', default: '' },
        ]);
    }

    const spinner = ora(action === 'login' ? 'Logging in…' : 'Creating account…').start();
    try {
        if (action === 'login') {
            await authService.login(creds.email, creds.password);
        } else {
            await authService.register(
                creds.email, creds.password, extra.passwordConfirm, extra.firstName, extra.lastName
            );
        }
        spinner.succeed(chalk.green(`Signed in as ${creds.email}`));
    } catch (err) {
        spinner.fail(chalk.red(err.message));
        process.exit(1);
    }
}

// ─── 2. Repository ──────────────────────────────────────
async function ensureRepo() {
    console.log(chalk.bold('\n2) Repository'));
    if (await pathExists(path.join(process.cwd(), GENT_DIR))) {
        console.log(chalk.green('  ✓ Already a gent repository'));
        return;
    }
    await initCommand({}); // prints its own "Initialized …" line
}

// ─── 3. Remote ──────────────────────────────────────────
// Returns true when origin is linked (so we know whether to push at the end).
async function ensureRemote() {
    console.log(chalk.bold('\n3) Remote'));

    const configPath = path.join(process.cwd(), GENT_DIR, CONFIG_FILE);
    const config = await readJSON(configPath);
    config.remotes = config.remotes || {};

    if (config.remotes.origin) {
        console.log(chalk.green(`  ✓ Linked: origin → ${config.remotes.origin.url}`));
        return true;
    }

    const { how } = await inquirer.prompt([{
        type: 'list',
        name: 'how',
        message: 'No remote linked yet. Link one?',
        choices: [
            { name: 'Create a new repository on gent', value: 'create' },
            { name: 'Link an existing remote URL', value: 'existing' },
            { name: 'Skip for now', value: 'skip' },
        ],
    }]);

    if (how === 'skip') {
        console.log(chalk.gray('  Skipped.'));
        return false;
    }

    if (how === 'existing') {
        const { url } = await inquirer.prompt([{
            type: 'input',
            name: 'url',
            message: 'Remote URL (/api/repos/{owner_id}/{repo}):',
            validate: v => !!parseRemoteUrl(v) || 'Expected /api/repos/{owner_id}/{repo_name}',
        }]);
        config.remotes.origin = { url };
        await writeJSON(configPath, config);
        console.log(chalk.green(`  ✓ Linked origin → ${url}`));
        return true;
    }

    // create
    if (!(await authStorage.isAuthenticated())) {
        console.log(chalk.yellow('  Sign in first to create a remote — skipping.'));
        return false;
    }

    const { name, isPrivate } = await inquirer.prompt([
        {
            type: 'input',
            name: 'name',
            message: 'Repository name:',
            default: path.basename(process.cwd()),
            validate: v => v.trim().length > 0 || 'Please enter a name',
        },
        { type: 'confirm', name: 'isPrivate', message: 'Private repository?', default: false },
    ]);

    const spinner = ora(`Creating '${name}' on gent…`).start();
    try {
        const data = await apiClient.post(API_ENDPOINTS.REPOS_CREATE, {
            name: name.trim(),
            description: '',
            is_private: isPrivate,
        });
        const repo = data.repository || data;
        const url = `/api/repos/${repo.owner_id}/${repo.name}`;
        config.remotes.origin = { url };
        await writeJSON(configPath, config);
        spinner.succeed(chalk.green(`Linked origin → ${url}`));
        return true;
    } catch (err) {
        if (err.response?.status === 400) {
            spinner.warn(chalk.yellow('Could not create — the name may already be taken.'));
            console.log(chalk.gray('  Tip: `gent repos` to list, then `gent remote add origin <url>`.'));
        } else {
            spinner.fail(chalk.red(err.message));
        }
        return false;
    }
}

// ─── 4. Stage ───────────────────────────────────────────
async function stageChanges() {
    console.log(chalk.bold('\n4) Stage changes'));

    const { how } = await inquirer.prompt([{
        type: 'list',
        name: 'how',
        message: 'What should we stage?',
        choices: [
            { name: 'All changes', value: 'all' },
            { name: 'Specific paths', value: 'pick' },
            { name: 'Nothing (skip)', value: 'skip' },
        ],
        default: 'all',
    }]);

    if (how === 'skip') return;

    if (how === 'all') {
        await addCommand([], { all: true });
        return;
    }

    const { paths } = await inquirer.prompt([{
        type: 'input',
        name: 'paths',
        message: 'Paths to add (space-separated):',
        validate: v => v.trim().length > 0 || 'Enter at least one path',
    }]);
    await addCommand(paths.trim().split(/\s+/), {});
}

// ─── 5. Commit ──────────────────────────────────────────
async function commitChanges() {
    console.log(chalk.bold('\n5) Commit'));
    // commit() prompts for the message itself and no-ops if nothing is staged.
    await commitCommand({});
}

// ─── 6. Push ────────────────────────────────────────────
async function pushChanges() {
    console.log(chalk.bold('\n6) Push'));
    await pushCommand('origin', undefined, {});
}

module.exports = auto;
