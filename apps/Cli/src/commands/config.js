/**
 * Config Command - Manage CLI-wide settings (~/.gent/cli-config.json)
 *
 *   gent config list                      → show all settings + source
 *   gent config get <key>                 → print one setting
 *   gent config set <key> <value>         → save a setting
 *   gent config unset <key>               → remove a setting
 *   gent config path                      → print config file location
 *
 *   gent config set ai.api_key <key>      ← stored obfuscated
 *   gent config set api.base_url http://localhost:8000
 */

const chalk = require('chalk');
const inquirer = require('inquirer');
const userConfig = require('../utils/user-config');

async function config(subcommand, args, options) {
    try {
        const sub = (subcommand || 'list').toLowerCase();
        const positional = args || [];

        switch (sub) {
            case 'list':
            case 'ls':
                return list();
            case 'get':
                return get(positional[0]);
            case 'set':
                return set(positional[0], positional[1], options);
            case 'unset':
            case 'remove':
            case 'rm':
                return unset(positional[0]);
            case 'path':
                console.log(userConfig.getConfigPath());
                return;
            default:
                console.error(chalk.red(`Unknown subcommand '${sub}'`));
                console.log(chalk.gray('Usage: gent config <list|get|set|unset|path> [args]'));
                process.exit(1);
        }
    } catch (error) {
        console.error(chalk.red('Error:'), error.message);
        process.exit(1);
    }
}

async function list() {
    const rows = await userConfig.listAll();
    console.log(chalk.bold.cyan('\nGent CLI configuration\n'));

    const sourceColor = {
        env: chalk.magenta,
        config: chalk.green,
        default: chalk.gray,
        unset: chalk.gray,
    };

    for (const row of rows) {
        const value = row.value === undefined
            ? chalk.gray('(not set)')
            : chalk.white(row.value);
        const sourceLabel = row.source === 'env'
            ? `env: ${row.envName}`
            : row.source;
        console.log(
            `  ${chalk.cyan(row.key.padEnd(16))} ${value}  ` +
            sourceColor[row.source](`[${sourceLabel}]`)
        );
    }
    console.log(chalk.gray(`\nFile: ${userConfig.getConfigPath()}`));
    console.log(chalk.gray('Set a value: gent config set <key> <value>\n'));
}

async function get(key) {
    if (!key) {
        console.error(chalk.red('Usage: gent config get <key>'));
        process.exit(1);
    }
    if (!userConfig.isAllowedKey(key)) {
        console.error(chalk.red(`Unknown key '${key}'`));
        console.log(chalk.gray(`Allowed: ${userConfig.listAllowedKeys().join(', ')}`));
        process.exit(1);
    }
    const resolved = await userConfig.getResolved(key);
    if (resolved.value === undefined) {
        console.log(chalk.gray('(not set)'));
        return;
    }
    console.log(resolved.value);
}

async function set(key, value, options) {
    if (!key) {
        console.error(chalk.red('Usage: gent config set <key> <value>'));
        process.exit(1);
    }
    if (!userConfig.isAllowedKey(key)) {
        console.error(chalk.red(`Unknown key '${key}'`));
        console.log(chalk.gray(`Allowed: ${userConfig.listAllowedKeys().join(', ')}`));
        process.exit(1);
    }

    // Secret prompt: if no value given for ai.api_key, prompt with masking.
    if ((value === undefined || value === '') && key === 'ai.api_key') {
        const answers = await inquirer.prompt([{
            type: 'password',
            name: 'value',
            message: 'Anthropic API key:',
            mask: '*',
            validate: (input) => input.length > 0 || 'Key cannot be empty',
        }]);
        value = answers.value;
    }

    if (value === undefined) {
        console.error(chalk.red('Usage: gent config set <key> <value>'));
        process.exit(1);
    }

    await userConfig.set(key, value);
    const display = key === 'ai.api_key' ? userConfig.maskSecret(value) : value;
    console.log(chalk.green(`✓ ${key} = ${display}`));

    const envName = userConfig.ENV_OVERRIDES[key];
    if (envName && process.env[envName]) {
        console.log(chalk.yellow(
            `Note: ${envName} is currently set in your environment and will override this value.`
        ));
    }
}

async function unset(key) {
    if (!key) {
        console.error(chalk.red('Usage: gent config unset <key>'));
        process.exit(1);
    }
    if (!userConfig.isAllowedKey(key)) {
        console.error(chalk.red(`Unknown key '${key}'`));
        process.exit(1);
    }
    await userConfig.unset(key);
    console.log(chalk.green(`✓ Removed ${key}`));
}

module.exports = config;
