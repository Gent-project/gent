/**
 * Search Command - Fuzzy-search your repositories on the gent backend.
 *
 *   gent search <query>
 *   gent search --mine                   → only repos you own
 *   gent search --json                   → machine-readable output
 *
 * The current backend's /api/repos/ endpoint returns the user's repos; we
 * filter client-side. If the backend grows a search endpoint, switch the URL.
 */

const chalk = require('chalk');
const ora = require('ora');
const { API_ENDPOINTS } = require('../utils/constants');
const apiClient = require('../utils/api-client');
const authStorage = require('../utils/auth-storage');

async function search(query, options = {}) {
    try {
        if (!query && !options.mine) {
            console.error(chalk.red('Usage: gent search <query>'));
            process.exit(1);
        }

        const isAuth = await authStorage.isAuthenticated();
        if (!isAuth) {
            console.error(chalk.red('Not authenticated.'));
            console.log(chalk.yellow('Run `gent login` first.'));
            process.exit(1);
        }

        const spinner = ora('Searching...').start();
        const data = await apiClient.get(API_ENDPOINTS.REPOS);
        const repos = Array.isArray(data) ? data : (data.results || []);
        spinner.stop();

        const me = await authStorage.getUser();
        const myId = me?.id;

        const q = (query || '').toLowerCase();
        const filtered = repos.filter(r => {
            if (options.mine && myId && r.owner_id !== myId) return false;
            if (!q) return true;
            const haystack = [r.name, r.description, r.owner_email]
                .filter(Boolean).join(' ').toLowerCase();
            return haystack.includes(q);
        });

        if (options.json) {
            console.log(JSON.stringify(filtered, null, 2));
            return;
        }

        if (filtered.length === 0) {
            console.log(chalk.gray('No matches.'));
            return;
        }

        console.log(chalk.bold.cyan(`\nFound ${filtered.length} repo(s):\n`));
        for (const r of filtered) {
            const visibility = r.is_private ? chalk.red('private') : chalk.green('public');
            const desc = r.description ? chalk.gray(` — ${r.description}`) : '';
            console.log(`  ${chalk.white.bold(r.name)} [${visibility}]${desc}`);
            console.log(`    ${chalk.gray(`/api/repos/${r.owner_id}/${r.name}`)}`);
        }
        console.log();
    } catch (error) {
        if (error.response?.status === 401) {
            console.error(chalk.red('Authentication failed — run `gent login`.'));
        } else {
            console.error(chalk.red('Error:'), error.message);
        }
        process.exit(1);
    }
}

module.exports = search;
