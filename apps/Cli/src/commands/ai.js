/**
 * AI Command - Manage and verify AI integration.
 *
 *   gent ai status            → show the managed service status
 *   gent ai test              → make a tiny live request to confirm it works
 *   gent ai models            → show provider management information
 */

const chalk = require('chalk');
const ora = require('ora');
const ai = require('../utils/ai-service');

async function aiCommand(subcommand) {
    const sub = (subcommand || 'status').toLowerCase();
    switch (sub) {
        case 'status': return status();
        case 'test': return test();
        case 'models': return models();
        default:
            console.error(chalk.red(`Unknown subcommand '${sub}'`));
            console.log(chalk.gray('Usage: gent ai <status|test|models>'));
            process.exit(1);
    }
}

async function status() {
    const { value: available, source } = await ai.resolveKey();

    console.log(chalk.bold.cyan('\nGent AI status\n'));
    if (available) {
        console.log(`  ${chalk.green('●')} Service:   ${chalk.white(`direct OpenAI [${source}]`)}`);
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
            maxTokens: 8,
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
