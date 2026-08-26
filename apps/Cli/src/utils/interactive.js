/**
 * Interactive helpers — shared prompt resolvers for commands that need an
 * argument the user didn't pass on the command line.
 *
 * The rule everywhere: if we're in a TTY, ask; otherwise leave the value
 * undefined so the command prints its usual "usage" error (keeps scripts/CI
 * behaving exactly as before).
 */

const path = require('path');
const inquirer = require('inquirer');
const { getGentPath, readJSON } = require('./fileSystem');
const { COMMITS_FILE } = require('./constants');

// Sentinel for the "create a new branch" choice — deliberately not a legal
// branch name, so it can never collide with a real one.
const CREATE_NEW = '__gent_create_new_branch__';

/** True only when both stdin and stdout are a real terminal. */
function isInteractive() {
    return Boolean(process.stdout.isTTY && process.stdin.isTTY);
}

/** Local branches from commits.json. { current, names } — empty if not a repo. */
async function loadBranches() {
    try {
        const gentPath = await getGentPath();
        const repo = await readJSON(path.join(gentPath, COMMITS_FILE));
        return {
            current: repo.currentBranch || 'main',
            names: Object.keys(repo.branches || {}),
        };
    } catch {
        return { current: null, names: [] };
    }
}

/** File paths tracked in the current branch's HEAD commit. [] if not a repo. */
async function listTrackedFiles() {
    try {
        const gentPath = await getGentPath();
        const repo = await readJSON(path.join(gentPath, COMMITS_FILE));
        const head = repo.branches?.[repo.currentBranch];
        const commit = head ? (repo.commits || []).find(c => c.hash === head) : null;
        const tree = commit ? (commit.tree || commit.files || []) : [];
        return tree.map(f => f.name || f.path).filter(Boolean);
    } catch {
        return [];
    }
}

/** gent clone — ask for the URL and (optionally) a target directory. */
async function promptClone() {
    const ans = await inquirer.prompt([
        {
            type: 'input',
            name: 'url',
            message: 'Repository URL to clone (/api/repos/{owner_id}/{repo}):',
            validate: v => v.trim().length > 0 || 'Please enter a URL',
        },
        {
            type: 'input',
            name: 'directory',
            message: 'Target directory (blank = repo name):',
            default: '',
        },
    ]);
    return { url: ans.url.trim(), directory: ans.directory.trim() || undefined };
}

/** gent checkout — pick an existing branch or create a new one. */
async function promptCheckout() {
    const { current, names } = await loadBranches();
    const others = names.filter(n => n !== current);

    const choices = [
        ...others.map(n => ({ name: n, value: n })),
        ...(others.length ? [new inquirer.Separator()] : []),
        { name: '＋ Create a new branch…', value: CREATE_NEW },
    ];

    const { pick } = await inquirer.prompt([{
        type: 'list',
        name: 'pick',
        message: current ? `Switch to which branch? (current: ${current})` : 'Branch:',
        choices,
    }]);

    if (pick === CREATE_NEW) {
        const { name } = await inquirer.prompt([{
            type: 'input',
            name: 'name',
            message: 'New branch name:',
            validate: v => v.trim().length > 0 || 'Please enter a name',
        }]);
        return { branch: name.trim(), create: true };
    }
    return { branch: pick, create: false };
}

/** gent merge — pick a branch (other than the current one) to merge in.
 *  `current` is null when we're not in a repo, so the caller can tell
 *  "no other branches" apart from "not a repo". */
async function promptMerge() {
    const { current, names } = await loadBranches();
    const others = names.filter(n => n !== current);
    if (!others.length) return { branch: null, current };

    const { branch } = await inquirer.prompt([{
        type: 'list',
        name: 'branch',
        message: `Merge which branch into '${current}'?`,
        choices: others,
    }]);
    return { branch, current };
}

/** gent ask — free-text question. */
async function promptAsk() {
    const { question } = await inquirer.prompt([{
        type: 'input',
        name: 'question',
        message: 'What do you want to ask about this repo?',
        validate: v => v.trim().length > 0 || 'Please enter a question',
    }]);
    return question.trim();
}

/** gent rm — checkbox of tracked files, or free-text if none are tracked. */
async function promptRm() {
    const tracked = await listTrackedFiles();
    if (tracked.length) {
        const { files } = await inquirer.prompt([{
            type: 'checkbox',
            name: 'files',
            message: 'Select files to remove:',
            choices: tracked,
            validate: v => v.length > 0 || 'Select at least one file (space to toggle)',
        }]);
        return files;
    }
    const { paths } = await inquirer.prompt([{
        type: 'input',
        name: 'paths',
        message: 'Files to remove (space-separated):',
        validate: v => v.trim().length > 0 || 'Enter at least one path',
    }]);
    return paths.trim().split(/\s+/);
}

module.exports = {
    isInteractive,
    loadBranches,
    listTrackedFiles,
    promptClone,
    promptCheckout,
    promptMerge,
    promptAsk,
    promptRm,
};
