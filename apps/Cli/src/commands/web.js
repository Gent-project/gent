/**
 * Web Command - Open the current repo (or a specific commit/branch) in browser.
 *
 *   gent web                       → open repo page
 *   gent web --branch <name>       → open a specific branch
 *   gent web --commit <hash>       → open a specific commit
 *   gent web --print               → don't launch, just print the URL
 *
 * Builds the URL from the configured api.base_url and the remote's owner_id/repo_name.
 */

const path = require('path');
const { exec } = require('child_process');
const chalk = require('chalk');
const { getGentPath, readJSON } = require('../utils/fileSystem');
const { CONFIG_FILE, parseRemoteUrl } = require('../utils/constants');
const userConfig = require('../utils/user-config');

async function web(options = {}) {
    try {
        const gentPath = await getGentPath();
        const config = await readJSON(path.join(gentPath, CONFIG_FILE));
        const remote = (config.remotes || {}).origin;
        if (!remote) {
            console.error(chalk.red('No origin remote configured.'));
            console.log(chalk.yellow('Run `gent remote add origin <url>` or `gent init --remote`.'));
            process.exit(1);
        }
        const info = parseRemoteUrl(remote.url);
        if (!info) {
            console.error(chalk.red(`Origin URL '${remote.url}' isn't a recognized gent URL.`));
            process.exit(1);
        }

        const { value: baseUrl } = await userConfig.getResolved('api.base_url');
        // Strip /api suffix if present so we get the web host
        const webHost = baseUrl.replace(/\/api\/?$/, '').replace(/\/$/, '');

        let url = `${webHost}/${info.owner_id}/${info.repo_name}`;
        if (options.branch) url += `/tree/${encodeURIComponent(options.branch)}`;
        if (options.commit) url += `/commit/${encodeURIComponent(options.commit)}`;

        if (options.print) {
            console.log(url);
            return;
        }

        console.log(chalk.gray(`Opening ${url}`));
        openInBrowser(url);
    } catch (error) {
        if (error.code === 'ENOENT' && error.message.includes('.gent')) {
            console.error(chalk.red('Error: Not a gent repository'));
        } else {
            console.error(chalk.red('Error:'), error.message);
        }
        process.exit(1);
    }
}

function openInBrowser(url) {
    const cmd = process.platform === 'darwin' ? 'open'
        : process.platform === 'win32' ? 'start ""'
        : 'xdg-open';
    exec(`${cmd} "${url}"`, (err) => {
        if (err) {
            console.error(chalk.yellow('Could not auto-open. URL:'));
            console.log(url);
        }
    });
}

module.exports = web;
