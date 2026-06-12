/**
 * Share Command - Print a shareable link to current branch/commit.
 *
 *   gent share                    → link to current HEAD on current branch
 *   gent share --branch <name>    → link to a branch's tip
 *   gent share --commit <hash>    → link to a specific commit
 *
 * Like `gent web --print` but always commit-scoped by default — handy for
 * Slack/PR descriptions.
 */

const path = require('path');
const chalk = require('chalk');
const { getGentPath, readJSON } = require('../utils/fileSystem');
const { CONFIG_FILE, COMMITS_FILE, parseRemoteUrl } = require('../utils/constants');
const userConfig = require('../utils/user-config');

async function share(options = {}) {
    try {
        const gentPath = await getGentPath();
        const config = await readJSON(path.join(gentPath, CONFIG_FILE));
        const repository = await readJSON(path.join(gentPath, COMMITS_FILE));

        const remote = (config.remotes || {}).origin;
        if (!remote) {
            console.error(chalk.red('No origin remote configured.'));
            console.log(chalk.yellow('Set one with `gent remote add origin <url>`.'));
            process.exit(1);
        }
        const info = parseRemoteUrl(remote.url);
        if (!info) {
            console.error(chalk.red('Origin URL is not in a recognized gent format.'));
            process.exit(1);
        }

        const { value: baseUrl } = await userConfig.getResolved('api.base_url');
        const webHost = baseUrl.replace(/\/api\/?$/, '').replace(/\/$/, '');
        const repoBase = `${webHost}/${info.owner_id}/${info.repo_name}`;

        if (options.commit) {
            console.log(`${repoBase}/commit/${options.commit}`);
            return;
        }
        const branch = options.branch || repository.currentBranch;
        const tip = repository.branches[branch];
        if (tip) {
            console.log(`${repoBase}/commit/${tip}`);
            console.log(chalk.gray(`(${branch} @ ${tip.slice(0, 7)})`));
        } else {
            console.log(`${repoBase}/tree/${encodeURIComponent(branch)}`);
            console.log(chalk.gray(`(${branch} has no commits yet)`));
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

module.exports = share;
