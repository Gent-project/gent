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
 *   POST   /api/repos/:owner_id/:repo_name/tags/create/ { name, commit_sha, message, annotated, tagger_name, tagger_email }
 *   DELETE /api/repos/:owner_id/:repo_name/tags/:name/
 *   (tag list is local-only — the CLI never GETs /tags/)
 *
 * ============================================================================
 */

const path = require('path');
const chalk = require('chalk');
const { getGentPath, readJSON, writeJSON } = require('../utils/fileSystem');
const { COMMITS_FILE, CONFIG_FILE, API_ENDPOINTS, buildRepoUrl, parseRemoteUrl } = require('../utils/constants');
const apiClient = require('../utils/api-client');
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
    let taggerName = '';
    let taggerEmail = '';
    if (options.message) {
        const config = await readJSON(path.join(gentPath, CONFIG_FILE));
        taggerName = config.user.name;
        taggerEmail = config.user.email;

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

    // Sync to remote
    await syncTagCreate(name, tagObj, taggerName, taggerEmail, gentPath);
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

    // Sync deletion to remote
    await syncTagDelete(name, gentPath);
}

/**
 * Sync tag creation to remote API
 */
async function syncTagCreate(name, tagObj, taggerName, taggerEmail, gentPath) {
    try {
        const isAuth = await authStorage.isAuthenticated();
        if (!isAuth) return;

        const config = await readJSON(path.join(gentPath, CONFIG_FILE));
        const remoteConfig = config.remotes && config.remotes.origin;
        if (!remoteConfig) return;

        const repoInfo = parseRemoteUrl(remoteConfig.url);
        if (!repoInfo) return;

        const payload = {
            name,
            commit_sha: tagObj.hash,
            message: tagObj.message || '',
            annotated: !!tagObj.annotated,
        };

        if (taggerName) payload.tagger_name = taggerName;
        if (taggerEmail) payload.tagger_email = taggerEmail;

        const url = buildRepoUrl(API_ENDPOINTS.REPO_TAGS_CREATE, repoInfo);
        await apiClient.post(url, payload);
        console.log(chalk.gray(`  ↑ Synced to remote`));
    } catch (error) {
        // Duplicates now upsert (200) on the backend, so a 400 is a real failure
        // — most often the tagged commit hasn't been pushed yet.
        if (error.response?.status === 400) {
            const data = error.response.data;
            const msg = (data && data.error) || (typeof data === 'object' ? JSON.stringify(data) : data) || 'Bad request';
            console.log(chalk.yellow(`  ⚠ Remote sync failed: ${msg}`));
            console.log(chalk.gray(`    (has the tagged commit been pushed to the remote?)`));
        } else if (error.response?.status === 403) {
            console.log(chalk.yellow(`  ⚠ Remote sync failed: ${error.response.data?.error || 'no write access to repository'}`));
        }
    }
}

/**
 * Sync tag deletion to remote API
 */
async function syncTagDelete(name, gentPath) {
    try {
        const isAuth = await authStorage.isAuthenticated();
        if (!isAuth) return;

        const config = await readJSON(path.join(gentPath, CONFIG_FILE));
        const remoteConfig = config.remotes && config.remotes.origin;
        if (!remoteConfig) return;

        const repoInfo = parseRemoteUrl(remoteConfig.url);
        if (!repoInfo) return;

        const url = buildRepoUrl(API_ENDPOINTS.REPO_TAG_DETAIL, { ...repoInfo, tag_name: name });
        await apiClient.delete(url);
        console.log(chalk.gray(`  ↑ Deleted from remote`));
    } catch (error) {
        if (error.response?.status === 404) {
            // Tag didn't exist remotely
        } else if (error.response?.status === 403) {
            console.log(chalk.yellow(`  ⚠ Remote delete failed: ${error.response.data?.error || 'no write access to repository'}`));
        }
    }
}

module.exports = tag;
