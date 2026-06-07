/**
 * Commit Command - Record changes to the repository
 * Creates a new commit with tree object referencing staged blobs
 */

const path = require('path');
const chalk = require('chalk');
const inquirer = require('inquirer');
const ora = require('ora');
const { getGentPath, readJSON, writeJSON } = require('../utils/fileSystem');
const authStorage = require('../utils/auth-storage');
const { STAGING_FILE, COMMITS_FILE, CONFIG_FILE } = require('../utils/constants');
const { generateCommitHash } = require('../utils/helpers');
const { storeTree, snapshotFile, readBlobAsString } = require('../utils/hash-engine');
const { formatUnifiedDiff } = require('../utils/diff-engine');
const journal = require('../utils/journal');
const ai = require('../utils/ai-service');

/**
 * Create a new commit
 * @param {Object} options - Command options
 */
async function commit(options) {
    try {
        const gentPath = await getGentPath();
        const cwd = process.cwd();

        // Read staging area
        const staging = await readJSON(path.join(gentPath, STAGING_FILE));
        const stagedEntries = staging.entries || [];
        const stagedFiles = staging.files || [];

        if (stagedEntries.length === 0 && stagedFiles.length === 0) {
            console.log(chalk.yellow('No changes added to commit'));
            console.log(chalk.gray('Use "gent add <file>..." to stage files'));
            return;
        }

        // Get commit message
        let message = options.message;

        // Optional: AI-suggested commit message (`gent commit --ai`)
        if (!message && options.ai) {
            if (!ai.isEnabled()) {
                console.log(chalk.yellow(ai.disabledHint()));
            } else {
                const suggested = await suggestMessage(gentPath, stagedEntries);
                if (suggested) {
                    const answer = await inquirer.prompt([{
                        type: 'input',
                        name: 'message',
                        message: 'Commit message (AI-suggested, edit as needed):',
                        default: suggested.split('\n')[0],
                        validate: (input) => input.length > 0 || 'Commit message cannot be empty'
                    }]);
                    message = answer.message;
                }
            }
        }

        if (!message) {
            const answer = await inquirer.prompt([
                {
                    type: 'input',
                    name: 'message',
                    message: 'Commit message:',
                    validate: (input) => {
                        return input.length > 0 || 'Commit message cannot be empty';
                    }
                }
            ]);
            message = answer.message;
        }

        const spinner = ora('Creating commit...').start();

        const config = await readJSON(path.join(gentPath, CONFIG_FILE));
        const repository = await readJSON(path.join(gentPath, COMMITS_FILE));

        // Resolve author identity
        let authorName = config.user.name;
        let authorEmail = config.user.email;

        if (!authorName || !authorEmail) {
            const globalUser = await authStorage.getUser();
            if (globalUser) {
                if (!authorName) authorName = [globalUser.first_name, globalUser.last_name].filter(Boolean).join(' ');
                if (!authorEmail) authorEmail = globalUser.email;
            }
        }

        if (!authorName || !authorEmail) {
            spinner.stop();
            console.error(chalk.red('Author identity unknown'));
            console.log(chalk.yellow('Please run "gent login" to set your identity globally'));
            return;
        }

        // Build tree entries from staged data
        let treeEntries = [];

        if (stagedEntries.length > 0) {
            // New format: entries already have blob hashes from gent add
            // Carry forward unchanged files from parent commit
            const parentHash = repository.branches[repository.currentBranch] || null;
            const parentCommit = parentHash
                ? (repository.commits || []).find(c => c.hash === parentHash)
                : null;
            const parentTree = parentCommit && parentCommit.tree
                ? parentCommit.tree
                : (parentCommit ? parentCommit.files.map(f => ({ mode: '100644', name: f.path, hash: f.hash, type: 'blob' })) : []);

            // Start from parent tree, overlay staged changes
            const treeMap = new Map(parentTree.map(e => [e.name, e]));

            for (const entry of stagedEntries) {
                if (entry.status === 'deleted') {
                    treeMap.delete(entry.path);
                } else {
                    treeMap.set(entry.path, {
                        mode: '100644',
                        name: entry.path,
                        hash: entry.hash,
                        type: 'blob'
                    });
                }
            }

            treeEntries = Array.from(treeMap.values());
        } else {
            // Legacy fallback: files array without blob hashes
            for (const file of stagedFiles) {
                const entry = await snapshotFile(gentPath, cwd, file);
                treeEntries.push(entry);
            }
        }

        // Store tree object
        const treeHash = await storeTree(gentPath, treeEntries);

        // Compute diff stats
        let totalInsertions = 0;
        let totalDeletions = 0;
        if (stagedEntries.length > 0) {
            for (const e of stagedEntries) {
                if (e.stats) {
                    totalInsertions += e.stats.insertions || 0;
                    totalDeletions += e.stats.deletions || 0;
                }
            }
        }

        // Create commit object
        const commitObj = {
            hash: generateCommitHash(),
            message,
            author: {
                name: authorName,
                email: authorEmail
            },
            timestamp: new Date().toISOString(),
            parent: repository.branches[repository.currentBranch] || null,
            treeHash,
            tree: treeEntries,
            files: treeEntries.map(e => ({ path: e.name, hash: e.hash })), // backward compat
            stats: {
                filesChanged: stagedEntries.length || stagedFiles.length,
                insertions: totalInsertions,
                deletions: totalDeletions
            }
        };

        // Save commit (journal pre-state first so "gent undo" can reverse it)
        await journal.recordOp(gentPath, 'commit', `${message} [${repository.currentBranch}]`);

        repository.commits = repository.commits || [];
        repository.commits.push(commitObj);
        repository.branches[repository.currentBranch] = commitObj.hash;

        await writeJSON(path.join(gentPath, COMMITS_FILE), repository);

        // Clear staging
        staging.entries = [];
        staging.files = [];
        await writeJSON(path.join(gentPath, STAGING_FILE), staging);

        spinner.succeed(chalk.green('Changes committed successfully!'));

        console.log(chalk.cyan(`\n[${repository.currentBranch} ${commitObj.hash.substring(0, 7)}] ${message}`));
        console.log(chalk.gray(`Author: ${commitObj.author.name} <${commitObj.author.email}>`));
        console.log(chalk.gray(`Date: ${new Date(commitObj.timestamp).toLocaleString()}`));
        console.log(chalk.gray(`Tree: ${treeHash.substring(0, 7)}`));
        console.log(chalk.gray(`\n${commitObj.stats.filesChanged} file(s) changed, `) +
            chalk.green(`+${totalInsertions} insertions`) + ', ' +
            chalk.red(`-${totalDeletions} deletions`));

    } catch (error) {
        if (error.code === 'ENOENT' && error.message.includes('.gent')) {
            console.error(chalk.red('Error: Not a gent repository'));
            console.log(chalk.yellow('\nRun "gent init" to initialize a repository'));
        } else {
            console.error(chalk.red('Error:'), error.message);
        }
        process.exit(1);
    }
}

/**
 * Build a compact staged-diff summary and ask the AI for a commit message.
 * Returns null on any failure (caller falls back to a manual prompt).
 * @param {String} gentPath
 * @param {Array} stagedEntries
 * @returns {Promise<String|null>}
 */
async function suggestMessage(gentPath, stagedEntries) {
    try {
        const repository = await readJSON(path.join(gentPath, COMMITS_FILE));
        const headHash = repository.branches[repository.currentBranch];
        const headCommit = headHash ? (repository.commits || []).find(c => c.hash === headHash) : null;
        const headMap = new Map(
            ((headCommit && headCommit.tree) ? headCommit.tree : (headCommit ? headCommit.files : []) || [])
                .map(f => [f.path || f.name, f.hash])
        );

        const parts = [];
        for (const e of stagedEntries) {
            if (e.status === 'deleted') { parts.push(`deleted: ${e.path}`); continue; }
            let oldText = '';
            const prev = headMap.get(e.path);
            try { if (prev) oldText = await readBlobAsString(gentPath, prev); } catch { /* binary */ }
            let newText = '';
            try { newText = await readBlobAsString(gentPath, e.hash); } catch { /* binary */ }
            const d = formatUnifiedDiff(e.path, oldText, newText);
            parts.push(d || `${e.status}: ${e.path}`);
        }

        const summary = parts.join('\n\n').slice(0, 12000);
        const spinner = ora(`Asking ${ai.getModel()} for a commit message...`).start();
        const msg = await ai.suggestCommitMessage(summary);
        spinner.stop();
        return msg || null;
    } catch {
        return null;
    }
}

module.exports = commit;
