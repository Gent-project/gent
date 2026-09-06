/** Canonical command adapters. Legacy repositories retain their v12 handlers
 * until migration ships; no canonical command falls back to a legacy writer.
 */
const fs = require('fs').promises;
const path = require('path');
const repository = require('../utils/repository');
const ops = require('../utils/gent-ops');
const merge = require('../utils/merge-ops');
const stash = require('../utils/stash-ops');
const journal = require('../utils/canonical-journal');
const worktree = require('../utils/worktree');
const { GitIndex } = require('../utils/git-index');
const { assertRefName } = require('../utils/refs');
const { Lock } = require('../utils/lockfile');
const { AttributesMatcher, looksBinary } = require('../utils/attributes');
const { formatUnifiedDiff } = require('../utils/diff-engine');
const ai = require('../utils/ai-service');
const apiClient = require('../utils/api-client');
const authStorage = require('../utils/auth-storage');
const { API_ENDPOINTS } = require('../utils/constants');
const { isInteractive } = require('../utils/interactive');
const inquirer = require('inquirer');

async function locatedCanonical() {
    let found;
    try { found = await repository.findGitdir(); } catch (error) {
        if (error.code === 'GENT_NOT_A_REPOSITORY') return null;
        throw error;
    }
    if (await repository.isLegacyRepository(found.commondir)) return null;
    return repository.open();
}

function route(name, legacy) {
    const handler = async (...args) => {
        try {
            for (let dir = process.cwd(); ; dir = path.dirname(dir)) {
                if (await fs.access(path.join(dir, '.gent-migration.json')).then(() => true, () => false)) throw new Error('interrupted migration; use gent migrate --continue or --abort');
                if (path.dirname(dir) === dir) break;
            }
            if (name === 'init') {
                const options = args[0] || {};
                let found = null;
                try { found = await repository.findGitdir(); } catch (error) {
                    if (error.code !== 'GENT_NOT_A_REPOSITORY') throw error;
                }
                if (found) {
                    if (await repository.isLegacyRepository(found.commondir)) return legacy(...args);
                    const existing = await repository.open();
                    console.log(`Repository already initialized: ${existing.gitdir}`);
                    if (options.remote) await createCanonicalRemote(existing, options.remote);
                    return;
                }
                if (options.objectFormat === 'legacy') return legacy(...args);
                if (options.objectFormat && options.objectFormat !== 'sha256') throw new Error('object format must be sha256 or legacy');
                const result = await repository.init(process.cwd());
                console.log(`Initialized SHA-256 repository: ${result.gitdir}`);
                if (options.remote) await createCanonicalRemote(result.repo, options.remote);
                return;
            }
            if (name === 'auto' || (name === 'remote' && args[0] === 'add')) {
                let found = null;
                try { found = await repository.findGitdir(); } catch (error) {
                    if (error.code !== 'GENT_NOT_A_REPOSITORY') throw error;
                }
                if (!found) {
                    if (name === 'auto' && !isInteractive()) throw new Error('gent auto needs an interactive terminal');
                    const result = await repository.init(process.cwd());
                    console.log(`Initialized SHA-256 repository: ${result.gitdir}`);
                }
            }
            // CLI-global settings remain available inside canonical repositories.
            if (name === 'config' && args[1]?.[0] && !/^(user\.|core\.|remote\.|branch\.)/i.test(args[1][0])) {
                return legacy(...args);
            }
            const repo = await locatedCanonical();
            if (!repo) return legacy(...args);
            if (!handlers[name]) throw new Error(`gent ${name} is not implemented for canonical repositories yet`);
            const readOnly = ['status', 'log', 'show', 'diff', 'summary'].includes(name);
            let lock;
            try {
                if (!readOnly) {
                    lock = await Lock.acquire(path.join(repo.gentWorktreeMetaDir, 'operation'));
                    await repo.assertNoExternalOperation(`gent ${name}`);
                    if (!(name === 'checkout' && args[1]?.abort)) await worktree.assertNoPendingCheckout(repo, `gent ${name}`);
                }
                const checkpointed = ['commit', 'checkout', 'reset', 'merge'].includes(name) && !args[1]?.abort && !args[0]?.abort;
                const checkpoint = checkpointed ? await journal.begin(repo, name) : null;
                const result = await handlers[name](repo, ...args);
                if (checkpoint) await journal.finish(repo, checkpoint);
                return result;
            } finally { if (lock) await lock.release(); }
        } catch (error) {
            console.error(`Error: ${error.message}`);
            process.exitCode = 1;
        }
    };
    if (legacy.redo) handler.redo = route('redo', legacy.redo);
    return handler;
}

async function createCanonicalRemote(repo, requestedName, options = {}) {
    if (!await authStorage.isAuthenticated()) throw new Error('run gent login before creating a remote repository');
    if (repo.config.get('remote.origin.url')) throw new Error("remote 'origin' already exists");
    const name = typeof requestedName === 'string' ? requestedName : path.basename(repo.worktree);
    if (!/^[A-Za-z0-9_-]+$/.test(name)) throw new Error('repository name must use letters, digits, _ or -');
    let head = await repo.refs.head();
    const defaultBranch = options.defaultBranch || head.branch || 'main';
    assertRefName(`refs/heads/${defaultBranch}`);
    if (options.defaultBranch && head.oid && head.branch !== options.defaultBranch) {
        throw new Error(`default branch must match the checked-out branch '${head.branch}'`);
    }
    if (head.detached) throw new Error('check out a branch before creating a remote repository');
    const data = await apiClient.post(API_ENDPOINTS.REPOS_CREATE, {
        name,
        description: options.description || 'A gent repository',
        is_private: Boolean(options.private),
        default_branch: defaultBranch,
        object_format: 'sha256',
    });
    const remoteRepo = data.repository || data;
    const base = (await apiClient.resolveBaseUrl()).replace(/\/api\/?$/, '').replace(/\/$/, '');
    const owner = remoteRepo.owner_username || remoteRepo.owner_id;
    const url = `${base}/${encodeURIComponent(String(owner))}/${encodeURIComponent(remoteRepo.name)}.git`;
    if (head.unborn && head.branch !== defaultBranch) {
        await repo.refs.setHeadSymbolic(
            `refs/heads/${defaultBranch}`,
            `branch: set default to ${defaultBranch}`,
            head,
        );
        head = await repo.refs.head();
    }
    repo.localConfig.set('remote.origin.url', url);
    repo.localConfig.set('remote.origin.fetch', '+refs/heads/*:refs/remotes/origin/*');
    if (head.branch) {
        repo.localConfig.set(`branch.${head.branch}.remote`, 'origin');
        repo.localConfig.set(`branch.${head.branch}.merge`, `refs/heads/${head.branch}`);
    }
    await repo.localConfig.save();
    console.log(`Created remote repository: ${url}`);
    return url;
}

const transport = require('../utils/smart-http');
const handlers = {
    async auto(repo) {
        if (!isInteractive()) throw new Error('gent auto needs an interactive terminal');
        await require('./auto').ensureAuth();
        const user = await authStorage.getUser();
        let changedConfig = false;
        if (!repo.config.get('user.name')) {
            const fullName = [user?.first_name, user?.last_name].filter(Boolean).join(' ');
            repo.localConfig.set('user.name', fullName || user?.username || user?.email?.split('@')[0] || 'Gent User');
            changedConfig = true;
        }
        if (!repo.config.get('user.email') && user?.email) {
            repo.localConfig.set('user.email', user.email);
            changedConfig = true;
        }
        if (changedConfig) await repo.localConfig.save();

        let linked = Boolean(repo.config.get('remote.origin.url'));
        if (!linked) {
            const { how } = await inquirer.prompt([{
                type: 'list',
                name: 'how',
                message: 'No remote linked yet. Link one?',
                choices: [
                    { name: 'Create a new repository on Gent', value: 'create' },
                    { name: 'Link an existing smart HTTP URL', value: 'existing' },
                    { name: 'Skip for now', value: 'skip' },
                ],
            }]);
            if (how === 'existing') {
                const { url } = await inquirer.prompt([{
                    type: 'input', name: 'url', message: 'Remote URL:',
                    validate: value => { try { transport.remoteUrl(value); return true; } catch (error) { return error.message; } },
                }]);
                repo.localConfig.set('remote.origin.url', transport.remoteUrl(url));
                repo.localConfig.set('remote.origin.fetch', '+refs/heads/*:refs/remotes/origin/*');
                await repo.localConfig.save();
                linked = true;
            } else if (how === 'create') {
                const remote = await inquirer.prompt([
                    { type: 'input', name: 'name', message: 'Repository name:', default: path.basename(repo.worktree),
                        validate: value => /^[A-Za-z0-9_-]+$/.test(value) || 'Use letters, digits, _ or -' },
                    { type: 'confirm', name: 'private', message: 'Private repository?', default: false },
                ]);
                await createCanonicalRemote(repo, remote.name, { private: remote.private });
                linked = true;
            }
        }

        const { stage } = await inquirer.prompt([{
            type: 'list',
            name: 'stage',
            message: 'What should Gent stage?',
            choices: [
                { name: 'All changes', value: 'all' },
                { name: 'Specific paths', value: 'paths' },
                { name: 'Nothing', value: 'none' },
            ],
        }]);
        if (stage !== 'none') {
            let paths = [];
            if (stage === 'paths') {
                const answer = await inquirer.prompt([{
                    type: 'input', name: 'paths', message: 'Paths (space-separated):',
                    validate: value => value.trim() ? true : 'Enter at least one path',
                }]);
                paths = answer.paths.trim().split(/\s+/);
            }
            await ops.addPaths(repo, paths, { all: stage === 'all' });
        }
        const status = await ops.status(repo);
        if (status.staged.length) {
            const { message } = await inquirer.prompt([{
                type: 'input', name: 'message', message: 'Commit message:',
                validate: value => value.trim() ? true : 'Commit message is required',
            }]);
            const result = await ops.createCommit(repo, { message });
            console.log(`[${result.branch || 'detached'} ${result.oid.slice(0, 12)}] ${message}`);
        }
        if (linked && (await repo.refs.head()).oid) {
            await transport.push(repo, 'origin');
            console.log('Push complete');
        }
        console.log('All done.');
    },
    async remote(repo, sub, args = []) {
        const [name = 'origin', url] = args;
        transport.nameCheck(name);
        if (sub === 'add' || sub === 'set-url') {
            if (!url) throw new Error('provide a remote URL');
            if (sub === 'add' && repo.config.get(`remote.${name}.url`)) throw new Error('remote already exists');
            repo.localConfig.set(`remote.${name}.url`, transport.remoteUrl(url));
            repo.localConfig.set(`remote.${name}.fetch`, `+refs/heads/*:refs/remotes/${name}/*`);
            await repo.localConfig.save();
        } else if (sub === 'remove') {
            repo.localConfig.unset(`remote.${name}.url`);
            repo.localConfig.unset(`remote.${name}.fetch`);
            await repo.localConfig.save();
        } else if (!sub) console.log(transport.configured(repo, name));
        else throw new Error('use remote add|set-url|remove');
    },
    async fetch(repo, remote = 'origin') { await transport.fetch(repo, remote); console.log(`Fetched ${remote}`); },
    async push(repo, remote = 'origin', branch, options = {}) {
        await transport.push(repo, remote, branch, options); console.log('Push complete');
    },
    async pull(repo, remote = 'origin', branch) {
        branch ||= (await repo.refs.head()).branch;
        if (!branch) throw new Error('specify a branch from detached HEAD');
        await transport.fetch(repo, remote);
        const result = await merge.merge(repo, `refs/remotes/${remote}/${branch}`);
        console.log(result.status);
        if (result.status === 'conflicts') process.exitCode = 1;
    },
    async undo(repo, options = {}) {
        if (options.list) { for (const item of (await journal.read(repo)).undo.slice().reverse()) console.log(item.name); }
        else console.log(`Undid ${await journal.restore(repo)}`);
    },
    async redo(repo) { console.log(`Redid ${await journal.restore(repo, true)}`); },
    async status(repo) {
        const state = await ops.status(repo);
        console.log(`On ${state.head.branch || 'detached HEAD'}`);
        for (const item of state.staged) console.log(`staged ${item.status}: ${item.path}`);
        for (const item of state.unstaged) console.log(`unstaged ${item.status}: ${item.path}`);
        for (const name of state.conflicted) console.log(`conflict: ${name}`);
        for (const name of state.untracked) console.log(`untracked: ${name}`);
        if (!state.staged.length && !state.unstaged.length && !state.conflicted.length && !state.untracked.length) console.log('Working tree clean');
    },
    async add(repo, files, options) {
        const result = await ops.addPaths(repo, files, options);
        console.log(`Staged ${result.staged.length} change(s), ${result.removed.length} deletion(s)`);
    },
    async rm(repo, files, options) { await ops.removePaths(repo, files, options); },
    async commit(repo, options) {
        if (options.ai) throw new Error('AI commit messages are not connected to canonical repositories yet');
        if (!options.message) throw new Error('provide a commit message with -m');
        if (options.all) {
            const index = await GitIndex.read(repo.indexPath);
            const files = [...new Set(index.entries.map(e => path.join(repo.worktree, e.path)))];
            if (files.length) await ops.addPaths(repo, files);
        }
        const result = await ops.createCommit(repo, options);
        console.log(`[${result.branch || 'detached'} ${result.oid.slice(0, 12)}] ${options.message}`);
    },
    async branch(repo, name, options) {
        if (options.delete) await ops.deleteBranch(repo, options.delete);
        else if (name) await ops.createBranch(repo, name);
        else for (const branch of await ops.listBranches(repo)) console.log(`${branch.current ? '*' : ' '} ${branch.name} ${branch.oid.slice(0, 12)}`);
    },
    async checkout(repo, target, options) {
        if (options.abort) { await worktree.abortCheckout(repo); console.log('Checkout restored'); return; }
        const result = await ops.checkout(repo, target, options);
        console.log(`Switched to ${result.branch || result.oid}`);
    },
    async reset(repo, files, options) {
        if (options.hard) await ops.reset(repo, 'hard', options.hard === true ? 'HEAD' : options.hard);
        else if (options.soft) await ops.reset(repo, 'soft', options.soft === true ? 'HEAD' : options.soft);
        else if (files.length) await ops.unstagePaths(repo, files);
        else await ops.reset(repo, 'mixed', 'HEAD');
    },
    async merge(repo, branch, options) {
        if (options.abort) return merge.abortMerge(repo);
        if (options.continue) return merge.concludeMerge(repo, options.message);
        const result = await merge.merge(repo, branch, options);
        if (result.status === 'conflicts') {
            for (const conflict of result.conflicts) {
                if (conflict.kind === 'content') console.log(`Auto-merging ${conflict.path}`);
                console.log(`CONFLICT (${conflict.kind}): Merge conflict in ${conflict.path}`);
            }
            console.log('Automatic merge failed; fix conflicts and then commit the result.');
            console.log('Resolve files, stage with gent add, then gent merge --continue or gent commit -m <message>.');
            process.exitCode = 1;
        } else console.log(result.status);
    },
    async resolve(repo, options = {}) {
        const index = await GitIndex.read(repo.indexPath);
        const names = [...index.conflicts().keys()];
        if (!names.length) {
            console.log('No merge conflicts to resolve.');
            return;
        }
        if (!options.ai) {
            for (const name of names) console.log(name);
            console.log('Edit conflicted files, then gent add <path> and gent merge --continue.');
            return;
        }

        await ai.prime();
        if (!ai.isEnabled()) throw new Error(ai.disabledHint());

        let resolved = 0;
        for (const name of names) {
            const sides = await merge.conflictSides(repo, name);
            if ([sides.base, sides.ours, sides.theirs].some(value => value && looksBinary(value))) {
                console.log(`Skipping binary conflict: ${name}`);
                continue;
            }
            try {
                const suggestion = await ai.resolveConflictHunk({
                    base: sides.base?.toString('utf8') || '',
                    ours: sides.ours?.toString('utf8') || '',
                    theirs: sides.theirs?.toString('utf8') || '',
                    fileName: name,
                });
                console.log(`\nAI suggestion for ${name} (review before accepting):\n${suggestion}`);
                const { accept } = await inquirer.prompt([{
                    type: 'confirm',
                    name: 'accept',
                    message: `Apply and stage this resolution for ${name}?`,
                    default: false,
                }]);
                if (!accept) continue;
                worktree.assertSafeCheckoutPath(repo, name);
                await worktree.assertNoSymlinkParent(repo, name);
                const absolute = path.join(repo.worktree, name);
                await fs.mkdir(path.dirname(absolute), { recursive: true });
                await fs.writeFile(absolute, suggestion, 'utf8');
                await merge.markResolved(repo, name);
                resolved++;
                console.log(`Resolved and staged ${name}`);
            } catch (error) {
                console.log(`AI did not resolve ${name}: ${error.message}`);
            }
        }
        console.log(`${resolved} of ${names.length} conflict(s) resolved with reviewed AI suggestions.`);
        console.log('Review and test the files, then run gent merge --continue.');
    },
    async stash(repo, sub = 'push', options = {}) {
        const position = Number(options.index || 0);
        if (!Number.isInteger(position) || position < 0) throw new Error('stash index must be a nonnegative integer');
        if (sub === 'list') { for (const item of await stash.list(repo)) console.log(`stash@{${item.index}}: ${item.message}`); }
        else if (sub === 'push' || sub === 'save') console.log((await stash.push(repo, options)).message);
        else if (['apply', 'pop', 'drop'].includes(sub)) await stash[sub](repo, position, options);
        else throw new Error(`unknown stash operation '${sub}'`);
    },
    async tag(repo, name, options) {
        if (options.delete) await ops.deleteTag(repo, options.delete);
        else if (name) await ops.createTag(repo, name, options);
        else for (const item of await ops.listTags(repo)) console.log(item.name);
    },
    async log(repo, options) {
        for (const commit of await ops.walkHistory(repo, { max: Number(options.number) })) {
            const graph = options.graph ? '* ' : '';
            console.log(`${graph}${commit.oid.slice(0, 12)} ${commit.message.toString().split('\n')[0]}`);
            if (options.stat) {
                const current = await worktree.readTreeRecursive(repo, commit.tree);
                const parent = commit.parents[0]
                    ? await worktree.readTreeRecursive(repo, (await repo.objects.readCommit(commit.parents[0])).tree)
                    : new Map();
                const changed = [...new Set([...current.keys(), ...parent.keys()])]
                    .filter(name => current.get(name)?.oid !== parent.get(name)?.oid || current.get(name)?.mode !== parent.get(name)?.mode);
                console.log(` ${changed.length} file${changed.length === 1 ? '' : 's'} changed`);
            }
        }
    },
    async show(repo, ref = 'HEAD', options = {}) {
        const oid = await ops.peelToCommit(repo, ref);
        const commit = await repo.objects.readCommit(oid);
        console.log(`commit ${oid}\nParents: ${commit.parents.join(' ')}\n${commit.message.toString()}`);
        if (options.patch !== false) {
            const before = commit.parents.length ? await worktree.readTreeRecursive(repo, (await repo.objects.readCommit(commit.parents[0])).tree) : new Map();
            await printTreeDiff(repo, before, await worktree.readTreeRecursive(repo, commit.tree));
        }
    },
    async diff(repo, files, options) {
        const index = await GitIndex.read(repo.indexPath);
        if (index.hasConflicts()) throw new Error('resolve conflicts before requesting a canonical diff');
        const staged = new Map(index.staged().map(e => [e.path, e]));
        const head = await repo.refs.head();
        const before = options.staged ? await worktree.readTreeRecursive(repo, head.oid ? (await repo.objects.readCommit(head.oid)).tree : null) : staged;
        const after = options.staged ? staged : new Map();
        if (!options.staged) {
            const attrs = new AttributesMatcher(repo);
            for (const [name, entry] of staged) {
                const snapshot = await worktree.snapshotPath(repo, name);
                if (snapshot) after.set(name, { ...entry, mode: snapshot.mode, bytes: snapshot.mode === 0o120000 ? Buffer.from(snapshot.content, 'base64') : await attrs.toIndex(name, Buffer.from(snapshot.content, 'base64')) });
            }
        }
        await printTreeDiff(repo, before, after, files, options.stat);
    },
    async summary(repo, options = {}) {
        if (options.ai) throw new Error('AI summary is not connected to canonical repositories yet');
        console.log(`${(await ops.walkHistory(repo)).length} commits, ${(await ops.listBranches(repo)).length} branches`);
        await handlers.status(repo);
    },
    async config(repo, sub = 'list', args = []) {
        const [key, value] = args;
        if (sub === 'get') console.log(repo.config.get(key, ''));
        else if (sub === 'set') {
            if (!key || value === undefined) throw new Error('usage: gent config set <key> <value>');
            if (!/^user\.(name|email)$/i.test(key)) throw new Error('canonical config writes currently support user.name and user.email only');
            repo.localConfig.set(key, value); await repo.localConfig.save();
        } else throw new Error('use gent config get <key> or gent config set user.name/user.email <value>');
    }
};

async function printTreeDiff(repo, before, after, files = [], stat = false) {
    const wanted = files.map(name => repo.relativePath(path.resolve(name)));
    for (const name of new Set([...before.keys(), ...after.keys()])) {
        if (wanted.length && !wanted.some(p => name === p || name.startsWith(p + '/'))) continue;
        const a = before.get(name), b = after.get(name);
        const read = item => item ? (item.bytes || repo.objects.readBlob(item.oid)) : Buffer.alloc(0);
        const oldBytes = await read(a), newBytes = await read(b);
        if (oldBytes.equals(newBytes) && a?.mode === b?.mode) continue;
        if (stat || looksBinary(oldBytes) || looksBinary(newBytes)) console.log(`${name}: ${oldBytes.length} -> ${newBytes.length} bytes`);
        else console.log(formatUnifiedDiff(name, oldBytes.toString(), newBytes.toString()));
    }
}

module.exports = { route, createCanonicalRemote };
