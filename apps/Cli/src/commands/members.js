/**
 * Members Command - Manage repository collaborators (owner-only for add/remove).
 *
 * USAGE:
 *   gent members                     → list owner + members with roles
 *   gent members add <email>         → add a collaborator (default role: write)
 *   gent members add <email> --role read
 *   gent members remove <email>      → remove a collaborator
 *
 * BACKEND:
 *   GET    /api/repos/:owner_id/:repo_name/members/                → [{ user_id, email, role, created_at }]
 *   POST   /api/repos/:owner_id/:repo_name/members/  { email, role: 'write'|'read' }
 *   DELETE /api/repos/:owner_id/:repo_name/members/:user_id/
 */

const chalk = require('chalk');
const ora = require('ora');
const path = require('path');
const { readJSON, getGentPath } = require('../utils/fileSystem');
const { CONFIG_FILE, API_ENDPOINTS, buildRepoUrl, parseRemoteUrl } = require('../utils/constants');
const apiClient = require('../utils/api-client');
const authStorage = require('../utils/auth-storage');

const VALID_ROLES = ['write', 'read'];

/**
 * Resolve the origin remote's { owner_id, repo_name } for the current repo.
 */
async function resolveRepoInfo() {
    const gentPath = await getGentPath();
    const config = await readJSON(path.join(gentPath, CONFIG_FILE));
    const remoteConfig = config.remotes && config.remotes.origin;
    if (!remoteConfig) {
        throw new Error("No 'origin' remote. Use \"gent remote add origin <url>\" first.");
    }
    const repoInfo = parseRemoteUrl(remoteConfig.url);
    if (!repoInfo) {
        throw new Error('Invalid origin remote URL. Expected /api/repos/{owner_id}/{repo_name}');
    }
    return repoInfo;
}

async function members(action, target, options = {}) {
    try {
        if (!(await authStorage.isAuthenticated())) {
            console.error(chalk.red('Not authenticated'));
            console.log(chalk.yellow('Run "gent login" first'));
            return;
        }

        const repoInfo = await resolveRepoInfo();

        if (!action || action === 'list') {
            await listMembers(repoInfo);
        } else if (action === 'add') {
            await addMember(repoInfo, target, options);
        } else if (action === 'remove' || action === 'rm') {
            await removeMember(repoInfo, target);
        } else {
            console.error(chalk.red(`Unknown action '${action}'`));
            console.log(chalk.yellow('Usage: gent members [list | add <email> | remove <email>]'));
        }
    } catch (error) {
        handleError(error);
    }
}

async function listMembers(repoInfo) {
    const spinner = ora('Fetching members...').start();
    const data = await apiClient.get(buildRepoUrl(API_ENDPOINTS.REPO_MEMBERS, repoInfo));
    spinner.stop();

    console.log(chalk.bold.cyan('\nRepository members:\n'));
    for (const m of data || []) {
        const role = m.role === 'owner'
            ? chalk.magenta('owner')
            : m.role === 'write' ? chalk.green('write') : chalk.gray('read');
        console.log(`  ${chalk.white.bold(m.email)}  [${role}]  ${chalk.gray(`#${m.user_id}`)}`);
    }
    console.log();
}

async function addMember(repoInfo, email, options) {
    if (!email) {
        console.error(chalk.red('Usage: gent members add <email> [--role write|read]'));
        return;
    }
    const role = (options.role || 'write').toLowerCase();
    if (!VALID_ROLES.includes(role)) {
        console.error(chalk.red(`Invalid role '${role}'. Use one of: ${VALID_ROLES.join(', ')}`));
        return;
    }

    const spinner = ora(`Adding ${email} as ${role}...`).start();
    await apiClient.post(buildRepoUrl(API_ENDPOINTS.REPO_MEMBERS, repoInfo), { email, role });
    spinner.succeed(chalk.green(`Added ${email} (${role})`));
}

async function removeMember(repoInfo, email) {
    if (!email) {
        console.error(chalk.red('Usage: gent members remove <email>'));
        return;
    }

    const spinner = ora(`Removing ${email}...`).start();
    // The remove endpoint keys on user_id, so resolve it from the member list.
    const list = await apiClient.get(buildRepoUrl(API_ENDPOINTS.REPO_MEMBERS, repoInfo));
    const member = (list || []).find(m => m.email === email && m.role !== 'owner');
    if (!member) {
        spinner.fail(chalk.red(`${email} is not a member of this repository`));
        return;
    }

    await apiClient.delete(
        buildRepoUrl(API_ENDPOINTS.REPO_MEMBER_DETAIL, { ...repoInfo, user_id: member.user_id })
    );
    spinner.succeed(chalk.green(`Removed ${email}`));
}

function handleError(error) {
    if (error.response?.status === 401) {
        console.error(chalk.red('Authentication failed — run "gent login"'));
    } else if (error.response?.status === 403) {
        console.error(chalk.red(error.response.data?.error || 'Only the repository owner can manage members'));
    } else if (error.response?.data) {
        const d = error.response.data;
        console.error(chalk.red(d.error || (typeof d === 'object' ? JSON.stringify(d) : d)));
    } else {
        console.error(chalk.red('Error:'), error.message);
    }
    process.exit(1);
}

module.exports = members;
