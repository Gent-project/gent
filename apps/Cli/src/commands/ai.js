/**
 * AI Command - Manage and verify AI integration.
 *
 *   gent ai status            → show key source, model, where it came from
 *   gent ai test              → make a tiny live request to confirm it works
 *   gent ai models            → list the model ids gent suggests
 */

const chalk = require('chalk');
const ora = require('ora');
const ai = require('../utils/ai-service');
const userConfig = require('../utils/user-config');

const SUGGESTED_MODELS = [
    { id: 'claude-opus-4-7', tag: 'flagship', note: 'Highest quality' },
    { id: 'claude-sonnet-4-6', tag: 'balanced', note: 'Strong, faster, cheaper' },
    { id: 'claude-haiku-4-5', tag: 'fastest', note: 'Fastest & cheapest' },
];

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
    const { value: key, source: keySource } = await ai.resolveKey();
    const model = await ai.resolveModel();
    const { source: modelSource } = await userConfig.getResolved('ai.model');

    console.log(chalk.bold.cyan('\nGent AI status\n'));
    if (key) {
        console.log(`  ${chalk.green('●')} API key:   ${userConfig.maskSecret(key)}  ${chalk.gray(`[${keySource}]`)}`);
    } else {
        console.log(`  ${chalk.gray('○')} API key:   ${chalk.gray('not set')}`);
        console.log(chalk.gray('             ↳ ' + ai.disabledHint()));
    }
    console.log(`  ${chalk.green('●')} Model:     ${model}  ${chalk.gray(`[${modelSource}]`)}`);
    console.log(chalk.gray('\n  Run `gent ai test` to verify the key actually works.'));
    console.log();
}

async function test() {
    const { value: key } = await ai.resolveKey();
    if (!key) {
        console.error(chalk.red('No AI key configured.'));
        console.log(chalk.yellow('Set one with `gent config set ai.api_key <key>`.'));
        process.exit(1);
    }

    const model = await ai.resolveModel();
    const spinner = ora(`Pinging Anthropic (${model})...`).start();
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
    const current = await ai.resolveModel();
    console.log(chalk.bold.cyan('\nSuggested Claude models\n'));
    for (const m of SUGGESTED_MODELS) {
        const active = m.id === current ? chalk.green(' (current)') : '';
        console.log(`  ${chalk.cyan(m.id.padEnd(22))} ${chalk.gray(m.tag.padEnd(10))} ${m.note}${active}`);
    }
    console.log(chalk.gray('\n  Switch with: gent config set ai.model <id>\n'));
}

module.exports = aiCommand;
