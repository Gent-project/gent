/**
 * ============================================================================
 * Tag Command - Create, list, and delete named references to commits
 * ============================================================================
 *
 * PURPOSE:
 *   Mark specific commits with version labels (e.g. v1.0.0). Like `git tag`.
 *
 * USAGE:
 *   gent tag                   → List all tags
 *   gent tag <name>            → Create lightweight tag on HEAD
 *   gent tag <name> -m <msg>   → Create annotated tag with message
 *   gent tag -d <name>         → Delete a tag
 *
 * ALGORITHM:
 *   Tags stored in commits.json under "tags" map: { name → { hash, message, ... } }
 *   Lightweight tag = just a name pointing to commit hash.
 *   Annotated tag = includes tagger info, message, timestamp.
 *
 * BACKEND EXPECTATIONS:
 *   POST /api/repos/:id/tags/ { name, hash, message, annotated }
 *   GET  /api/repos/:id/tags/
 *   DELETE /api/repos/:id/tags/:name/
 *
 * ============================================================================
 */

const path = require('path');
const chalk = require('chalk');
const { getGentPath, readJSON, writeJSON } = require('../utils/fileSystem');
const { COMMITS_FILE, CONFIG_FILE } = require('../utils/constants');
const authStorage = require('../utils/auth-storage');

/**
 * Manage tags
 * @param {String} name - Tag name (optional)
 * @param {Object} options
 */
async function tag(name, options) {
    try {
        const gentPath = await getGentPath();
        const repository = await readJSON(path.join(gentPath, COMMITS_FILE));
        repository.tags = repository.tags || {};

        if (options.delete) {
            await deleteTag(options.delete, repository, gentPath);
            return;
        }

        if (name) {
            await createTag(name, repository, gentPath, options);
            return;
        }

        // List tags
        listTags(repository);

    } catch (error) {
        if (error.code === 'ENOENT' && error.message.includes('.gent')) {
            console.error(chalk.red('Error: Not a gent repository'));
        } else {
            console.error(chalk.red('Error:'), error.message);
        }
        process.exit(1);
    }
}

/**
 * List all tags
 */
function listTags(repository) {
    const tags = Object.keys(repository.tags).sort();

    if (tags.length === 0) {
        console.log(chalk.gray('No tags'));
        return;
    }

    for (const tagName of tags) {
        const t = repository.tags[tagName];
        const short = t.hash ? t.hash.substring(0, 7) : '???????';
        const msg = t.message ? chalk.gray(` — ${t.message}`) : '';
        console.log(chalk.yellow(tagName) + chalk.gray(` → ${short}`) + msg);
    }
}

/**
 * Create a tag
 */
async function createTag(name, repository, gentPath, options) {
    if (repository.tags[name]) {
        console.error(chalk.red(`Tag '${name}' already exists`));
        process.exit(1);
    }

    const currentBranch = repository.currentBranch;
    const commitHash = repository.branches[currentBranch];

    if (!commitHash) {
        console.error(chalk.red('No commits to tag'));
        return;
    }

    const tagObj = { hash: commitHash };

    // Annotated tag
    if (options.message) {
        const config = await readJSON(path.join(gentPath, CONFIG_FILE));
        let taggerName = config.user.name;
        let taggerEmail = config.user.email;

        if (!taggerName || !taggerEmail) {
            const user = await authStorage.getUser();
            if (user) {
                taggerName = taggerName || [user.first_name, user.last_name].filter(Boolean).join(' ');
                taggerEmail = taggerEmail || user.email;
            }
        }

        tagObj.message = options.message;
        tagObj.annotated = true;
        tagObj.tagger = { name: taggerName || 'Unknown', email: taggerEmail || '' };
        tagObj.timestamp = new Date().toISOString();
    }

    repository.tags[name] = tagObj;
    await writeJSON(path.join(gentPath, COMMITS_FILE), repository);

    console.log(chalk.green(`Created tag '${name}' → ${commitHash.substring(0, 7)}`));
}

/**
 * Delete a tag
 */
async function deleteTag(name, repository, gentPath) {
    if (!repository.tags[name]) {
        console.error(chalk.red(`Tag '${name}' not found`));
        process.exit(1);
    }

    delete repository.tags[name];
    await writeJSON(path.join(gentPath, COMMITS_FILE), repository);
    console.log(chalk.green(`Deleted tag '${name}'`));
}

module.exports = tag;
