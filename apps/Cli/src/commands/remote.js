/**
 * ============================================================================
 * Remote Command - Manage remote repository connections
 * ============================================================================
 *
 * PURPOSE:
 *   Configure remote backend server URLs for push/pull. Like `git remote`.
 *
 * USAGE:
 *   gent remote                        → List remotes
 *   gent remote add <name> <url>       → Add a remote (e.g. origin)
 *   gent remote remove <name>          → Remove a remote
 *   gent remote set-url <name> <url>   → Update remote URL
 *
 * STORAGE:
 *   Stored in .gent/config.json under "remotes" key:
 *   { "origin": { "url": "https://gent-api.onrender.com/api/repos/my-repo/" } }
 *
 * BACKEND EXPECTATIONS:
 *   The URL is the base endpoint for a repository resource:
 *     GET  <url>/              → Repo metadata
 *     POST <url>/push/         → Push commits/objects
 *     GET  <url>/pull/         → Pull commits/objects
 *     GET  <url>/refs/         → List remote branch refs
 *
 * ============================================================================
 */

const path = require('path');
const chalk = require('chalk');
const { getGentPath, readJSON, writeJSON } = require('../utils/fileSystem');
const { CONFIG_FILE } = require('../utils/constants');

/**
 * Manage remotes
 * @param {String} subcommand - add|remove|set-url (null = list)
 * @param {Array} args
 * @param {Object} options
 */
async function remote(subcommand, args, options) {
    try {
        const gentPath = await getGentPath();
        const configPath = path.join(gentPath, CONFIG_FILE);
        const config = await readJSON(configPath);
        config.remotes = config.remotes || {};

        switch (subcommand) {
            case 'add': {
                const [name, url] = args || [];
                if (!name || !url) {
                    console.error(chalk.red('Usage: gent remote add <name> <url>'));
                    return;
                }
                if (config.remotes[name]) {
                    console.error(chalk.red(`Remote '${name}' already exists`));
                    return;
                }
                config.remotes[name] = { url };
                await writeJSON(configPath, config);
                console.log(chalk.green(`Added remote '${name}' → ${url}`));
                break;
            }
            case 'remove': {
                const name = args && args[0];
                if (!name) {
                    console.error(chalk.red('Usage: gent remote remove <name>'));
                    return;
                }
                if (!config.remotes[name]) {
                    console.error(chalk.red(`Remote '${name}' not found`));
                    return;
                }
                delete config.remotes[name];
                await writeJSON(configPath, config);
                console.log(chalk.green(`Removed remote '${name}'`));
                break;
            }
            case 'set-url': {
                const [name, url] = args || [];
                if (!name || !url) {
                    console.error(chalk.red('Usage: gent remote set-url <name> <url>'));
                    return;
                }
                if (!config.remotes[name]) {
                    console.error(chalk.red(`Remote '${name}' not found`));
                    return;
                }
                config.remotes[name].url = url;
                await writeJSON(configPath, config);
                console.log(chalk.green(`Updated '${name}' → ${url}`));
                break;
            }
            default: {
                // List remotes
                const names = Object.keys(config.remotes);
                if (names.length === 0) {
                    console.log(chalk.gray('No remotes configured'));
                    console.log(chalk.yellow('Use "gent remote add origin <url>" to add one'));
                    return;
                }
                for (const name of names) {
                    const verbose = options.verbose ? chalk.gray(` → ${config.remotes[name].url}`) : '';
                    console.log(chalk.cyan(name) + verbose);
                }
            }
        }
    } catch (error) {
        if (error.code === 'ENOENT' && error.message.includes('.gent')) {
            console.error(chalk.red('Error: Not a gent repository'));
        } else {
            console.error(chalk.red('Error:'), error.message);
        }
        process.exit(1);
    }
}

module.exports = remote;
