/**
 * Web Command - Open the current repo (or a specific commit/branch) in browser.
 *
 *   gent web                       → open repo page
 *   gent web --branch <name>       → repo page (branch context only — see NOTE)
 *   gent web --commit <hash>       → repo page (commit context only — see NOTE)
 *   gent web --print               → don't launch, just print the URL
 *
 * Builds the URL from the configured web.base_url (NOT api.base_url — the web
 * app is a separate deployment) and the remote's owner_id/repo_name.
 *
 * NOTE: the web app has no branch or commit page today, so --branch/--commit
 * warn and fall back to the repository page. See utils/web-urls.js.
 */

const path = require('path');
const { execFile } = require('child_process');
const chalk = require('chalk');
const { getGentPath, readJSON } = require('../utils/fileSystem');
const { CONFIG_FILE, parseRemoteUrl } = require('../utils/constants');
const { getWebBaseUrl, buildRepoLink, BRANCH_COMMIT_UNSUPPORTED } = require('../utils/web-urls');

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

        const baseUrl = await getWebBaseUrl();
        const { url, unsupported } = buildRepoLink(baseUrl, info, {
            branch: options.branch,
            commit: options.commit,
        });

        if (unsupported) {
            console.error(chalk.yellow(`Note: --${unsupported} is not supported yet.`));
            console.error(chalk.gray(BRANCH_COMMIT_UNSUPPORTED));
        }

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

/**
 * Hand the URL to the platform's browser launcher.
 *
 * Uses execFile, NOT exec: the URL is passed as its own argv entry so no shell
 * ever parses it. Interpolating it into a shell string made a `"` in
 * web.base_url a command-injection sink, and broke any legitimate URL
 * containing & or $.
 */
function openInBrowser(url) {
    const [cmd, args] = process.platform === 'darwin' ? ['open', [url]]
        : process.platform === 'win32' ? ['cmd', ['/c', 'start', '', url]]
        : ['xdg-open', [url]];
    execFile(cmd, args, (err) => {
        if (err) {
            console.error(chalk.yellow('Could not auto-open. URL:'));
            console.log(url);
        }
    });
}

module.exports = web;
