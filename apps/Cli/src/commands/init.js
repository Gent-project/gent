/**
 * Init Command - Initialize a new gent repository
 * Creates .gent directory and necessary files
 */

const fs = require('fs').promises;
const path = require('path');
const chalk = require('chalk');
const { ensureDir, writeJSON, pathExists } = require('../utils/fileSystem');
const authStorage = require('../utils/auth-storage');
const apiClient = require('../utils/api-client');
const { GENT_DIR, CONFIG_FILE, STAGING_FILE, COMMITS_FILE, API_ENDPOINTS } = require('../utils/constants');

/**
 * Initialize a new gent repository
 * @param {Object} options - Command options
 */
async function init(options) {
    try {
        const cwd = process.cwd();
        const gentPath = path.join(cwd, GENT_DIR);
        let isReinit = false;

        // Check if already initialized
        if (await pathExists(gentPath)) {
            isReinit = true;
        }

        // Get authenticated user profile if available
        let defaultName = '';
        let defaultEmail = '';

        try {
            const user = await authStorage.getUser();
            if (user) {
                if (user.first_name || user.last_name) {
                    defaultName = [user.first_name, user.last_name].filter(Boolean).join(' ');
                }
                if (user.email) {
                    defaultEmail = user.email;
                }
            }
        } catch (error) {
            // Ignore auth errors
        }

        let config = {
            user: {
                name: defaultName,
                email: defaultEmail
            },
            repository: {
                name: path.basename(cwd),
                description: 'A gent repository',
                created: new Date().toISOString()
            }
        };

        // Create directory structure
        await ensureDir(gentPath);
        await ensureDir(path.join(gentPath, 'objects'));
        await ensureDir(path.join(gentPath, 'refs', 'heads'));
        await ensureDir(path.join(gentPath, 'refs', 'tags'));

        // Create/Update configuration
        // Only write config if it doesn't exist OR if we have valid user info to update
        const configPath = path.join(gentPath, CONFIG_FILE);
        if (!(await pathExists(configPath)) || (defaultName && defaultEmail)) {
            // If re-init, we might want to preserve existing config unless we have better info?
            // Git re-init doesn't overwrite config usually.
            // But for now, let's write ensuring we have a config file.
            if (!isReinit || !(await pathExists(configPath))) {
                await writeJSON(configPath, config);
            }
        }

        // Create initial files only if they don't exist
        const stagingPath = path.join(gentPath, STAGING_FILE);
        if (!(await pathExists(stagingPath))) {
            await writeJSON(stagingPath, { files: [] });
        }

        const commitsPath = path.join(gentPath, COMMITS_FILE);
        if (!(await pathExists(commitsPath))) {
            await writeJSON(commitsPath, { commits: [], branches: { main: null }, currentBranch: 'main' });
        }

        // Create HEAD file only if it doesn't exist
        const headPath = path.join(gentPath, 'HEAD');
        if (!(await pathExists(headPath))) {
            await fs.writeFile(headPath, 'ref: refs/heads/main\n');
        }

        // Create .gentignore only if it doesn't exist
        const ignorePath = path.join(cwd, '.gentignore');
        if (!(await pathExists(ignorePath))) {
            const gentignore = `# Gent ignore patterns
node_modules/
.DS_Store
*.log
.env
.gent/
`;
            await fs.writeFile(ignorePath, gentignore);
        }

        if (isReinit) {
            console.log(chalk.gray(`Reinitialized existing Gent repository in ${gentPath}`));
        } else {
            console.log(chalk.gray(`Initialized empty Gent repository in ${gentPath}`));
        }

        // Create remote repository if --remote flag is set
        if (options.remote) {
            await createRemoteRepo(cwd, gentPath, config, options);
        }

    } catch (error) {
        console.error(chalk.red('Failed to initialize repository'));
        console.error(chalk.red('Error:'), error.message);
        process.exit(1);
    }
}

/**
 * Create a remote repository on the backend and link it
 */
async function createRemoteRepo(cwd, gentPath, config, options) {
    try {
        const isAuth = await authStorage.isAuthenticated();
        if (!isAuth) {
            console.log(chalk.yellow('Not authenticated — skipping remote creation'));
            console.log(chalk.yellow('Run "gent login" then "gent repos --create <name>"'));
            return;
        }

        const repoName = typeof options.remote === 'string' ? options.remote : path.basename(cwd);

        console.log(chalk.gray(`Creating remote repository '${repoName}'...`));

        const payload = {
            name: repoName,
            description: config.repository.description || '',
        };

        const data = await apiClient.post(API_ENDPOINTS.REPOS_CREATE, payload);
        const repo = data.repository || data;

        // Update local config with remote
        const configPath = path.join(gentPath, CONFIG_FILE);
        const localConfig = await require('../utils/fileSystem').readJSON(configPath);
        localConfig.remotes = localConfig.remotes || {};
        localConfig.remotes.origin = { url: `/api/repos/${repo.owner_id}/${repo.name}` };
        await writeJSON(configPath, localConfig);

        console.log(chalk.green(`✓ Remote repository created: /api/repos/${repo.owner_id}/${repo.name}`));
        console.log(chalk.gray(`  Remote 'origin' configured automatically`));

    } catch (error) {
        if (error.response?.status === 400) {
            console.log(chalk.yellow('Remote creation failed — repository name may already exist'));
        } else {
            console.log(chalk.yellow(`Remote creation failed: ${error.message}`));
        }
    }
}

module.exports = init;
