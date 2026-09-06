/**
 * Repos Command - List and create remote repositories
 */

const chalk = require('chalk');
const ora = require('ora');
const path = require('path');
const inquirer = require('inquirer');
const { API_ENDPOINTS, GENT_DIR, CONFIG_FILE } = require('../utils/constants');
const apiClient = require('../utils/api-client');
const authStorage = require('../utils/auth-storage');
const { pathExists, readJSON, writeJSON } = require('../utils/fileSystem');
const interactive = require('../utils/interactive');
const initCommand = require('./init');
const repository = require('../utils/repository');

/**
 * List or create remote repositories
 * @param {Object} options
 */
async function repos(extraNames, options) {
    try {
        options = options || {};
        extraNames = extraNames || [];
        let local = null;

        if (options.create) {
            const validation = validateRepositoryName(options.create, extraNames);
            if (!validation.valid) {
                console.error(chalk.red(validation.message));
                console.log(chalk.yellow(`Use "gent repos --create ${validation.suggestion}" instead.`));
                console.log(chalk.gray('No repository was created.'));
                process.exitCode = 1;
                return;
            }
            local = await prepareLocalRepository(options);
            if (!local) return;
        } else if (extraNames.length) {
            throw new Error('unexpected repository name; use --create <name>');
        }

        const isAuth = await authStorage.isAuthenticated();
        if (!isAuth) {
            console.error(chalk.red('Not authenticated'));
            console.log(chalk.yellow('Run "gent login" first'));
            process.exitCode = 1;
            return;
        }

        if (options.create) {
            await createRepo(options, local);
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
async function createRepo(options, local) {
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
    if (local.kind === 'canonical') payload.object_format = 'sha256';

    let data;
    try {
        data = await apiClient.post(API_ENDPOINTS.REPOS_CREATE, payload);
    } catch (error) {
        spinner.stop();
        throw error;
    }
    const remoteRepo = data.repository || data;
    const remoteUrl = await linkOrigin(local, remoteRepo);

    spinner.succeed(chalk.green(`Created repository '${remoteRepo.name}'`));
    console.log(chalk.gray(`  URL: /api/repos/${remoteRepo.owner_id}/${remoteRepo.name}`));
    console.log(chalk.green(`  Linked local repository to '${remoteUrl}' as origin`));
}

function validateRepositoryName(name, extraNames = []) {
    const words = [name, ...extraNames].filter(value => typeof value === 'string' && value.trim());
    const combined = words.join(' ').trim();
    const suggestion = combined
        .toLowerCase()
        .replace(/[^a-z0-9._-]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^[-.]+|[-.]+$/g, '') || 'repository-name';
    const valid = words.length === 1 && /^[A-Za-z0-9](?:[A-Za-z0-9._-]*[A-Za-z0-9])?$/.test(name);
    return {
        valid,
        suggestion,
        message: `Invalid repository name '${combined || String(name || '')}'. Repository names cannot contain spaces or unsupported characters.`,
    };
}

async function prepareLocalRepository(options) {
    const gentPath = path.join(process.cwd(), GENT_DIR);
    if (!await pathExists(gentPath)) {
        if (!options.yes) {
            if (!interactive.isInteractive()) {
                console.error(chalk.red('No local Gent repository exists in this folder.'));
                console.log(chalk.yellow('Run "gent init" first, or retry with --yes to initialize and link it automatically.'));
                process.exitCode = 1;
                return null;
            }
            const { initialize } = await inquirer.prompt([{
                type: 'confirm',
                name: 'initialize',
                message: 'No local Gent repository exists in this folder. Create it before creating and linking the remote?',
                default: true,
            }]);
            if (!initialize) {
                console.log(chalk.yellow('Cancelled. No local or remote repository was created.'));
                return null;
            }
        }
        await initCommand({ yes: true });
    }

    const legacyConfig = path.join(gentPath, CONFIG_FILE);
    if (await pathExists(legacyConfig)) {
        const config = await readJSON(legacyConfig);
        if (config.remotes?.origin) throw new Error("remote 'origin' already exists; no repository was created");
        return { kind: 'legacy', config, configPath: legacyConfig };
    }

    const canonical = await repository.open(process.cwd());
    if (canonical.config.get('remote.origin.url')) throw new Error("remote 'origin' already exists; no repository was created");
    return { kind: 'canonical', repo: canonical };
}

async function linkOrigin(local, remoteRepo) {
    if (local.kind === 'legacy') {
        const url = `/api/repos/${remoteRepo.owner_id}/${remoteRepo.name}`;
        local.config.remotes = local.config.remotes || {};
        local.config.remotes.origin = { url };
        await writeJSON(local.configPath, local.config);
        return url;
    }

    const base = (await apiClient.resolveBaseUrl()).replace(/\/$/, '');
    const owner = remoteRepo.owner_username || remoteRepo.owner_id;
    const url = `${base}/${encodeURIComponent(String(owner))}/${encodeURIComponent(remoteRepo.name)}.git`;
    local.repo.localConfig.set('remote.origin.url', url);
    local.repo.localConfig.set('remote.origin.fetch', '+refs/heads/*:refs/remotes/origin/*');
    await local.repo.localConfig.save();
    return url;
}

module.exports = repos;
module.exports.validateRepositoryName = validateRepositoryName;
module.exports.prepareLocalRepository = prepareLocalRepository;
