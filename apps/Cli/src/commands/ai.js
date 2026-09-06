/**
 * AI Command - Manage and verify AI integration.
 *
 *   gent ai configure         → securely save your own key for this computer
 *   gent ai configure <key>   → same, without the interactive prompt
 *   gent ai status            → show local AI status
 *   gent ai test              → make a tiny live request to confirm it works
 *   gent ai models            → show provider management information
 */

const chalk = require('chalk');
const inquirer = require('inquirer');
const ora = require('ora');
const ai = require('../utils/ai-service');
const localAiConfig = require('../utils/local-ai-config');

async function aiCommand(subcommand, key, options = {}) {
    const sub = (subcommand || 'status').toLowerCase();
    switch (sub) {
        case 'configure': return configure(key, options);
        case 'status': return status();
        case 'test': return test();
        case 'models': return models();
        default:
            console.error(chalk.red(`Unknown subcommand '${sub}'`));
            console.log(chalk.gray('Usage: gent ai <configure|status|test|models>'));
            process.exit(1);
    }
}

async function configure(key, options = {}) {
    // A key passed as an argument keeps `gent ai configure` usable in scripts,
    // over SSH, and anywhere stdin is not a terminal.
    let apiKey = typeof key === 'string' ? key.trim() : '';

    if (!apiKey) {
        if (!process.stdin.isTTY || !process.stdout.isTTY) {
            console.error(chalk.red('No terminal available for the masked prompt.'));
            console.log(chalk.gray('  Pass the key directly: gent ai configure <your-openrouter-key>'));
            process.exitCode = 1;
            return;
        }
        ({ apiKey } = await inquirer.prompt([{
            type: 'password',
            name: 'apiKey',
            message: 'OpenRouter API key:',
            mask: '*',
            validate: value => localAiConfig.validateApiKey(value) || 'Enter a valid OpenRouter key beginning with sk-or-v1-.',
        }]));
    }

    if (!localAiConfig.validateApiKey(apiKey)) {
        console.error(chalk.red('That is not a valid OpenRouter key. Keys begin with sk-or-v1-.'));
        console.log(chalk.gray('  Create one at https://openrouter.ai/keys'));
        process.exitCode = 1;
        return;
    }

    const savedPath = await localAiConfig.saveApiKey(apiKey, { model: options.model });
    console.log(chalk.green('✓ Gent AI configured for this computer with your own key.'));
    console.log(chalk.gray(`  Stored locally in ${savedPath} with owner-only permissions.`));
    console.log(chalk.gray(`  Model: ${await ai.resolveModel()}`));
    console.log(chalk.gray('  Run `gent ai test` to verify it.'));
}

async function status() {
    const { value: available, source } = await ai.resolveKey();

    console.log(chalk.bold.cyan('\nGent AI status\n'));
    if (available) {
        console.log(`  ${chalk.green('●')} Service:   ${chalk.white(source)}`);
    } else {
        console.log(`  ${chalk.gray('○')} Service:   ${chalk.gray('unavailable')}`);
        console.log(chalk.gray('             ↳ ' + ai.disabledHint()));
    }
    console.log(`  ${chalk.green('●')} Model:     ${await ai.resolveModel()}`);
    console.log(chalk.gray('\n  Run `gent ai test` to verify the service.'));
    console.log();
}

async function test() {
    const { value: available } = await ai.resolveKey();
    if (!available) {
        console.error(chalk.red(ai.disabledHint()));
        process.exit(1);
    }

    const spinner = ora('Pinging Gent AI...').start();
    try {
        const reply = await ai.complete({
            prompt: 'Reply with the single word: pong',
            maxTokens: 32,
        });
        spinner.succeed(chalk.green(`✓ Reachable. Reply: "${reply}"`));
    } catch (err) {
        spinner.fail(chalk.red(err.message));
        process.exit(1);
    }
}

async function models() {
    console.log(chalk.bold.cyan('\nGent AI model\n'));
    console.log(chalk.white(`  ${await ai.resolveModel()} (current)`));
    console.log(chalk.gray('  Optimized for low-latency review, merge, and chat.\n'));
}

module.exports = aiCommand;
