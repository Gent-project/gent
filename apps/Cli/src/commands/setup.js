/**
 * Setup Command - First-run interactive wizard.
 *
 *   gent setup
 *
 * Walks the user through: backend URL → login/register → AI key → identity.
 * Each step is skippable; nothing is required.
 */

const chalk = require('chalk');
const inquirer = require('inquirer');
const boxen = require('boxen');
const ora = require('ora');
const axios = require('axios');
const userConfig = require('../utils/user-config');
const authStorage = require('../utils/auth-storage');
const authService = require('../services/auth-service');
const ai = require('../utils/ai-service');

async function setup() {
    console.log(boxen(
        chalk.bold.cyan('Welcome to Gent\n') +
        chalk.white('Let\'s get you set up. Every step is optional — press Enter to skip.'),
        { padding: 1, margin: 1, borderStyle: 'round', borderColor: 'cyan' }
    ));

    await stepBackend();
    await stepAuth();
    await stepAiKey();
    await stepIdentity();

    console.log(chalk.green('\n✓ Setup complete!'));
    console.log(chalk.gray('  Run `gent doctor` any time to verify your setup.\n'));
}

async function stepBackend() {
    console.log(chalk.bold('\n1. Backend server'));
    const current = await userConfig.getResolved('api.base_url');
    console.log(chalk.gray(`   Current: ${current.value} [${current.source}]`));

    const { change } = await inquirer.prompt([{
        type: 'confirm',
        name: 'change',
        message: 'Change backend URL?',
        default: false,
    }]);
    if (!change) return;

    const { url } = await inquirer.prompt([{
        type: 'input',
        name: 'url',
        message: 'Backend URL:',
        default: current.value,
        validate: (v) => /^https?:\/\//.test(v) || 'Must start with http:// or https://',
    }]);

    const spinner = ora('Probing backend...').start();
    try {
        await axios.get(url, { timeout: 8000, validateStatus: () => true });
        spinner.succeed(chalk.green('Backend reachable'));
    } catch (err) {
        spinner.warn(chalk.yellow(`Could not reach ${url} (${err.code || err.message}) — saving anyway`));
    }
    await userConfig.set('api.base_url', url);
}

async function stepAuth() {
    console.log(chalk.bold('\n2. Account'));
    const isAuth = await authStorage.isAuthenticated();
    if (isAuth) {
        const user = await authStorage.getUser();
        console.log(chalk.gray(`   Already logged in as ${user?.email || 'unknown'} — skipping.`));
        return;
    }

    const { action } = await inquirer.prompt([{
        type: 'list',
        name: 'action',
        message: 'What would you like to do?',
        choices: [
            { name: 'Log in to an existing account', value: 'login' },
            { name: 'Create a new account', value: 'register' },
            { name: 'Skip for now', value: 'skip' },
        ],
        default: 'login',
    }]);
    if (action === 'skip') return;

    const credentials = await inquirer.prompt([
        {
            type: 'input',
            name: 'email',
            message: 'Email:',
            validate: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) || 'Invalid email',
        },
        {
            type: 'password',
            name: 'password',
            message: 'Password:',
            mask: '*',
        },
    ]);

    const spinner = ora(action === 'login' ? 'Logging in...' : 'Creating account...').start();
    try {
        if (action === 'login') {
            await authService.login(credentials.email, credentials.password);
        } else {
            const more = await inquirer.prompt([
                { type: 'password', name: 'passwordConfirm', message: 'Confirm password:', mask: '*' },
                { type: 'input', name: 'firstName', message: 'First name:', default: '' },
                { type: 'input', name: 'lastName', message: 'Last name:', default: '' },
            ]);
            await authService.register(
                credentials.email,
                credentials.password,
                more.passwordConfirm,
                more.firstName,
                more.lastName
            );
        }
        spinner.succeed(chalk.green('Signed in'));
    } catch (err) {
        spinner.fail(chalk.red(err.message));
    }
}

async function stepAiKey() {
    console.log(chalk.bold('\n3. AI features (optional)'));
    const existing = await ai.resolveKey();
    if (existing.value) {
        console.log(chalk.gray(`   Key already configured [${existing.source}] — skipping.`));
        return;
    }

    console.log(chalk.gray('   Gent uses Anthropic Claude for commit-message suggestions,'));
    console.log(chalk.gray('   diff explanations, AI conflict resolution, code review, and more.'));
    console.log(chalk.gray('   Get a key at: https://console.anthropic.com/settings/keys'));

    const { provide } = await inquirer.prompt([{
        type: 'confirm',
        name: 'provide',
        message: 'Add an Anthropic API key now?',
        default: true,
    }]);
    if (!provide) return;

    const { key } = await inquirer.prompt([{
        type: 'password',
        name: 'key',
        message: 'Anthropic API key:',
        mask: '*',
        validate: (v) => v.length > 0 || 'Cannot be empty',
    }]);

    await userConfig.set('ai.api_key', key);

    const { testNow } = await inquirer.prompt([{
        type: 'confirm',
        name: 'testNow',
        message: 'Test the key now (1 small request)?',
        default: true,
    }]);
    if (testNow) {
        const spinner = ora('Asking Claude to say hi...').start();
        try {
            await ai.complete({ prompt: 'Reply with the single word: ok', maxTokens: 4 });
            spinner.succeed(chalk.green('AI key works'));
        } catch (err) {
            spinner.fail(chalk.red(err.message));
            console.log(chalk.yellow('   You can fix this with `gent config set ai.api_key <key>`.'));
        }
    }
}

async function stepIdentity() {
    console.log(chalk.bold('\n4. Default identity'));
    const currentName = await userConfig.getResolved('user.name');
    const currentEmail = await userConfig.getResolved('user.email');

    if (currentName.value && currentEmail.value) {
        console.log(chalk.gray(`   ${currentName.value} <${currentEmail.value}> — skipping.`));
        return;
    }

    // Prefill from logged-in user if available
    const u = await authStorage.getUser();
    const defaultName = currentName.value ||
        (u ? [u.first_name, u.last_name].filter(Boolean).join(' ') : '');
    const defaultEmail = currentEmail.value || (u ? u.email : '');

    const answers = await inquirer.prompt([
        { type: 'input', name: 'name', message: 'Default name on commits:', default: defaultName },
        { type: 'input', name: 'email', message: 'Default email on commits:', default: defaultEmail },
    ]);

    if (answers.name) await userConfig.set('user.name', answers.name);
    if (answers.email) await userConfig.set('user.email', answers.email);
}

module.exports = setup;
