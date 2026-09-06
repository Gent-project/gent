/**
 * Checkout Command - Switch branches
 * Changes the current working branch
 */

const fs = require('fs').promises;
const path = require('path');
const chalk = require('chalk');
const { getGentPath, readJSON, writeJSON } = require('../utils/fileSystem');
const { COMMITS_FILE, STAGING_FILE } = require('../utils/constants');
const { hashBlob, readBlob } = require('../utils/hash-engine');
const journal = require('../utils/journal');

function treeOf(repository, commitHash) {
    if (!commitHash) return [];
    const commit = (repository.commits || []).find(item => item.hash === commitHash);
    if (!commit) throw new Error(`Commit '${commitHash}' not found`);
    return commit.tree || (commit.files || []).map(file => ({
        mode: '100644', name: file.path || file.name, hash: file.hash, type: 'blob'
    }));
}

function safePath(cwd, relativePath) {
    if (!relativePath || path.isAbsolute(relativePath) || relativePath.split(/[\\/]/).includes('..')) {
        throw new Error(`Unsafe repository path '${relativePath}'`);
    }
    const fullPath = path.resolve(cwd, relativePath);
    if (fullPath !== cwd && !fullPath.startsWith(cwd + path.sep)) {
        throw new Error(`Unsafe repository path '${relativePath}'`);
    }
    return fullPath;
}

async function switchWorkingTree(gentPath, cwd, repository, currentHash, targetHash) {
    const staging = await readJSON(path.join(gentPath, STAGING_FILE));
    if ((staging.entries || []).length || (staging.files || []).length || staging.mergeState) {
        throw new Error('Commit or stash staged changes before switching branches');
    }

    const currentTree = new Map(treeOf(repository, currentHash).map(entry => [entry.name || entry.path, entry]));
    const targetTree = new Map(treeOf(repository, targetHash).map(entry => [entry.name || entry.path, entry]));
    const changedPaths = [...new Set([...currentTree.keys(), ...targetTree.keys()])]
        .filter(name => currentTree.get(name)?.hash !== targetTree.get(name)?.hash);
    const writes = new Map();

    // Read and validate every affected path before changing any file.
    for (const name of changedPaths) {
        const fullPath = safePath(cwd, name);
        const current = currentTree.get(name);
        const target = targetTree.get(name);
        const stat = await fs.lstat(fullPath).catch(() => null);

        if (current) {
            if (!stat || !stat.isFile()) throw new Error(`Local changes would be overwritten by checkout: ${name}`);
            const bytes = await fs.readFile(fullPath);
            if (hashBlob(bytes) !== current.hash) {
                throw new Error(`Local changes would be overwritten by checkout: ${name}`);
            }
        } else if (target && stat) {
            throw new Error(`Untracked file would be overwritten by checkout: ${name}`);
        }

        if (target) writes.set(name, await readBlob(gentPath, target.hash));
    }

    for (const name of changedPaths) {
        if (targetTree.has(name)) continue;
        await fs.unlink(safePath(cwd, name));
    }
    for (const [name, bytes] of writes) {
        const fullPath = safePath(cwd, name);
        await fs.mkdir(path.dirname(fullPath), { recursive: true });
        await fs.writeFile(fullPath, bytes);
    }
}

/**
 * Switch to a different branch
 * @param {String} branch - Branch name
 * @param {Object} options - Command options
 */
async function checkout(branch, options) {
    try {
        const gentPath = await getGentPath();
        const repository = await readJSON(path.join(gentPath, COMMITS_FILE));

        const branches = repository.branches || {};

        // Create new branch if -b flag is used
        if (options.create) {
            if (branches.hasOwnProperty(branch)) {
                console.error(chalk.red(`Error: Branch '${branch}' already exists`));
                process.exit(1);
            }

            // Create and switch to new branch
            await journal.recordOp(gentPath, 'checkout', `create branch '${branch}'`);

            const currentCommit = branches[repository.currentBranch] || null;
            branches[branch] = currentCommit;
            repository.branches = branches;
            repository.currentBranch = branch;

            await writeJSON(path.join(gentPath, COMMITS_FILE), repository);

            console.log(chalk.green(`✓ Created and switched to branch '${branch}'`));
            return;
        }

        // Switch to existing branch
        if (!branches.hasOwnProperty(branch)) {
            console.error(chalk.red(`Error: Branch '${branch}' not found`));
            console.log(chalk.yellow(`\nℹ Use "gent branch" to see available branches`));
            console.log(chalk.yellow(`ℹ Use "gent checkout -b ${branch}" to create a new branch`));
            process.exit(1);
        }

        if (branch === repository.currentBranch) {
            console.log(chalk.yellow(`Already on branch '${branch}'`));
            return;
        }

        const cwd = path.dirname(gentPath);
        const currentCommit = branches[repository.currentBranch] || null;
        const targetCommit = branches[branch] || null;
        await switchWorkingTree(gentPath, cwd, repository, currentCommit, targetCommit);
        await journal.recordOp(gentPath, 'checkout', `switch to branch '${branch}'`, { restoreTree: true });

        repository.currentBranch = branch;
        await writeJSON(path.join(gentPath, COMMITS_FILE), repository);

        const commitHash = branches[branch];
        const commitInfo = commitHash ? chalk.gray(` at ${commitHash.substring(0, 7)}`) : '';

        console.log(chalk.green(`✓ Switched to branch '${branch}'${commitInfo}`));

    } catch (error) {
        if (error.code === 'ENOENT' && error.message.includes('.gent')) {
            console.error(chalk.red('Error: Not a gent repository'));
            console.log(chalk.yellow('\nℹ Run "gent init" to initialize a repository'));
        } else {
            console.error(chalk.red('Error:'), error.message);
        }
        process.exit(1);
    }
}

module.exports = checkout;
