/**
 * Repos Command - List and create remote repositories
 */

const chalk = require('chalk');
const ora = require('ora');
const path = require('path');
const { API_ENDPOINTS } = require('../utils/constants');
const apiClient = require('../utils/api-client');
const authStorage = require('../utils/auth-storage');

/**
 * List or create remote repositories
 * @param {Object} options
 */
async function repos(options) {
    try {
        const isAuth = await authStorage.isAuthenticated();
        if (!isAuth) {
            console.error(chalk.red('Not authenticated'));
            console.log(chalk.yellow('Run "gent login" first'));
            return;
        }

        if (options.create) {
            await createRepo(options);
            return;
        }

        await listRepos();

    } catch (error) {
        if (error.response?.status === 401) {
            console.error(chalk.red('Authentication failed — run "gent login"'));
        } else if (error.response?.data) {
            console.error(chalk.red(JSON.stringify(error.response.data)));
        } else {
            console.error(chalk.red('Error:'), error.message);
        }
        process.exit(1);
    }
}

/**
 * List all user repositories
 */
async function listRepos() {
    const spinner = ora('Fetching repositories...').start();

    const data = await apiClient.get(API_ENDPOINTS.REPOS);

    spinner.stop();

    if (!data || data.length === 0) {
        console.log(chalk.gray('No repositories found'));
        console.log(chalk.yellow('Use "gent repos --create <name>" to create one'));
        return;
    }

    console.log(chalk.bold.cyan('\nRepositories:\n'));

    for (const repo of data) {
        const visibility = repo.is_private ? chalk.red('private') : chalk.green('public');
        const desc = repo.description ? chalk.gray(` — ${repo.description}`) : '';
        const url = chalk.gray(` /api/repos/${repo.owner_id}/${repo.name}`);
        console.log(`  ${chalk.white.bold(repo.name)} [${visibility}]${desc}`);
        console.log(`    ${url}`);
    }

    console.log();
}

/**
 * Create a new remote repository
 */
async function createRepo(options) {
    const name = options.create;
    if (typeof name !== 'string' || !name) {
        console.error(chalk.red('Usage: gent repos --create <name>'));
        return;
    }

    const spinner = ora(`Creating repository '${name}'...`).start();

    const payload = {
        name,
        description: options.description || '',
        is_private: !!options.private,
    };

    if (options.defaultBranch) {
        payload.default_branch = options.defaultBranch;
    }

    const data = await apiClient.post(API_ENDPOINTS.REPOS_CREATE, payload);

    spinner.succeed(chalk.green(`Created repository '${data.name}'`));
    console.log(chalk.gray(`  URL: /api/repos/${data.owner_id}/${data.name}`));
    console.log(chalk.gray(`  Use "gent remote add origin /api/repos/${data.owner_id}/${data.name}" to link`));
}

module.exports = repos;
