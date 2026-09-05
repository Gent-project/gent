/**
 * Share Command - Print a shareable link to current branch/commit.
 *
 *   gent share                    → link to the repository
 *   gent share --branch <name>    → same link, branch reported as context
 *   gent share --commit <hash>    → same link, commit validated and reported
 *
 * Like `gent web --print` — handy for Slack/PR descriptions. stdout carries
 * only the URL so `gent share | pbcopy` gives a clean link; all context goes
 * to stderr.
 *
 * NOTE: the web app has no branch or commit page today, so every link resolves
 * to the repository page; the branch/commit is reported as context only.
 * See utils/web-urls.js.
 */

const path = require('path');
const chalk = require('chalk');
const { getGentPath, readJSON } = require('../utils/fileSystem');
const { CONFIG_FILE, COMMITS_FILE, parseRemoteUrl } = require('../utils/constants');
const { getWebBaseUrl, buildRepoLink, BRANCH_COMMIT_UNSUPPORTED } = require('../utils/web-urls');

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

        const baseUrl = await getWebBaseUrl();
        const { url, unsupported } = buildRepoLink(baseUrl, info, {
            branch: options.branch,
            commit: options.commit,
        });

        // A --commit the repo doesn't know about is a typo, not a link: refuse
        // rather than echo a fabricated reference into a PR description.
        if (options.commit) {
            const known = (repository.commits || [])
                .some((c) => c && typeof c.hash === 'string' && c.hash.startsWith(options.commit));
            if (!known) {
                console.error(chalk.red(`Unknown commit '${options.commit}' in this repository.`));
                process.exit(1);
            }
        }

        // Only warn when the user actually asked for a link we can't build.
        if (unsupported) {
            console.error(chalk.gray(BRANCH_COMMIT_UNSUPPORTED));
        }

        // stdout carries the URL and nothing else, so `gent share | pbcopy`
        // yields a clean link. All human context goes to stderr.
        console.log(url);

        if (options.commit) {
            console.error(chalk.gray(`(commit ${String(options.commit).slice(0, 7)})`));
            return;
        }
        const branch = options.branch || repository.currentBranch;
        const tip = (repository.branches || {})[branch];
        if (tip) {
            console.error(chalk.gray(`(${branch} @ ${tip.slice(0, 7)})`));
        } else {
            console.error(chalk.gray(`(${branch} has no commits yet)`));
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
