/** List and create hosted repositories. */
const path = require('path');
const chalk = require('chalk');
const ora = require('ora');
const inquirer = require('inquirer');
const { API_ENDPOINTS, CONFIG_FILE } = require('../utils/constants');
const apiClient = require('../utils/api-client');
const authStorage = require('../utils/auth-storage');
const { pathExists, readJSON, writeJSON } = require('../utils/fileSystem');
const interactive = require('../utils/interactive');
const repository = require('../utils/repository');
const { createCanonicalRemote } = require('./canonical');

async function repos(extraNames = [], options = {}) {
    try {
        if (options.create) {
            const validation = validateRepositoryName(options.create, extraNames);
            if (!validation.valid) {
                console.error(chalk.red(validation.message));
                console.log(chalk.yellow(`Use "gent repos --create ${validation.suggestion}" instead.`));
                console.log(chalk.gray('No repository was created.'));
                process.exitCode = 1;
                return;
            }
        } else if (extraNames.length) {
            throw new Error('unexpected repository name; use --create <name>');
        }

        if (!await authStorage.isAuthenticated()) {
            console.error(chalk.red('Not authenticated'));
            console.log(chalk.yellow('Run "gent login" first'));
            process.exitCode = 1;
            return;
        }

        if (!options.create) {
            await listRepos();
            return;
        }

        const local = await prepareLocalRepository(options);
        if (local) await createRepo(options, local);
    } catch (error) {
        if (error.response?.status === 401) {
            console.error(chalk.red('Authentication failed — run "gent login"'));
        } else if (error.response?.data) {
            console.error(chalk.red(JSON.stringify(error.response.data)));
        } else {
            console.error(chalk.red('Error:'), error.message);
        }
        process.exitCode = 1;
    }
}

async function listRepos() {
    const spinner = ora('Fetching repositories...').start();
    try {
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
            console.log(`  ${chalk.white.bold(repo.name)} [${visibility}]${desc}`);
            console.log(chalk.gray(`    /api/repos/${repo.owner_username || repo.owner_id}/${repo.name}`));
        }
        console.log();
    } catch (error) {
        spinner.stop();
        throw error;
    }
}

async function createRepo(options, local) {
    const spinner = ora(`Creating repository '${options.create}'...`).start();
    try {
        let remoteUrl;
        if (local.kind === 'canonical') {
            remoteUrl = await createCanonicalRemote(local.repo, options.create, options);
        } else {
            const data = await apiClient.post(API_ENDPOINTS.REPOS_CREATE, {
                name: options.create,
                description: options.description || '',
                is_private: Boolean(options.private),
                default_branch: options.defaultBranch || 'main',
                object_format: 'legacy',
            });
            const remoteRepo = data.repository || data;
            remoteUrl = `/api/repos/${remoteRepo.owner_id}/${remoteRepo.name}`;
            local.config.remotes = local.config.remotes || {};
            local.config.remotes.origin = { url: remoteUrl };
            await writeJSON(local.configPath, local.config);
        }
        spinner.succeed(chalk.green(`Created repository '${options.create}'`));
        console.log(chalk.green(`  Linked local repository to '${remoteUrl}' as origin`));
    } catch (error) {
        spinner.stop();
        throw error;
    }
}

function validateRepositoryName(name, extraNames = []) {
    const words = [name, ...extraNames].filter(value => typeof value === 'string' && value.trim());
    const combined = words.join(' ').trim();
    const suggestion = combined
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^[-_]+|[-_]+$/g, '') || 'repository-name';
    return {
        valid: words.length === 1 && /^[A-Za-z0-9](?:[A-Za-z0-9_-]*[A-Za-z0-9])?$/.test(name),
        suggestion,
        message: `Invalid repository name '${combined || String(name || '')}'. Repository names cannot contain spaces or unsupported characters.`,
    };
}

async function prepareLocalRepository(options) {
    let found;
    try {
        found = await repository.findGitdir(process.cwd());
    } catch (error) {
        if (error.code !== 'GENT_NOT_A_REPOSITORY') throw error;
    }

    if (!found) {
        if (!options.yes) {
            if (!interactive.isInteractive()) {
                throw new Error('no local repository; run gent init first or retry with --yes');
            }
            const { initialize } = await inquirer.prompt([{
                type: 'confirm',
                name: 'initialize',
                message: 'No local Gent repository exists here. Initialize and link it?',
                default: true,
            }]);
            if (!initialize) {
                console.log(chalk.yellow('Cancelled. No local or remote repository was created.'));
                return null;
            }
        }
        const result = await repository.init(process.cwd());
        console.log(chalk.gray(`Initialized SHA-256 repository: ${result.gitdir}`));
        return { kind: 'canonical', repo: result.repo };
    }

    if (await repository.isLegacyRepository(found.commondir)) {
        const configPath = path.join(found.commondir, CONFIG_FILE);
        if (!await pathExists(configPath)) throw new Error('legacy repository config is missing');
        const config = await readJSON(configPath);
        if (config.remotes?.origin) throw new Error("remote 'origin' already exists; no repository was created");
        return { kind: 'legacy', config, configPath };
    }

    const localRepo = await repository.open(process.cwd());
    if (localRepo.config.get('remote.origin.url')) {
        throw new Error("remote 'origin' already exists; no repository was created");
    }
    return { kind: 'canonical', repo: localRepo };
}

module.exports = repos;
module.exports.validateRepositoryName = validateRepositoryName;
module.exports.prepareLocalRepository = prepareLocalRepository;
