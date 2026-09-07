const fs = require('fs').promises;
const path = require('path');
const { spawn } = require('child_process');

const repository = require('./repository');
const { FORMAT_MARKER } = require('./feature-support');
const { executeCanonicalOperation } = require('./canonical-operation');
const ops = require('./gent-ops');
const merge = require('./merge-ops');
const stash = require('./stash-ops');
const transport = require('./smart-http');

class AdapterError extends Error {
    constructor(message, exitCode = 1) {
        super(message);
        this.exitCode = exitCode;
    }
}

function parseInvocation(argv, initialCwd = process.cwd()) {
    let cwd = initialCwd;
    let index = 0;
    const globals = [];
    while (index < argv.length) {
        const arg = argv[index];
        if (arg === '-C') {
            if (!argv[index + 1]) throw new AdapterError('-C requires a directory');
            cwd = path.resolve(cwd, argv[index + 1]);
            globals.push(arg, argv[index + 1]);
            index += 2;
        } else if (arg === '--no-pager') {
            globals.push(arg);
            index += 1;
        } else if (arg === '-c') {
            if (!argv[index + 1]) throw new AdapterError('-c requires a configuration assignment');
            globals.push(arg, argv[index + 1]);
            index += 2;
        } else {
            break;
        }
    }
    return { cwd, globals, command: argv[index] || null, args: argv.slice(index + 1), original: argv };
}

function validateGlobals(globals) {
    for (let i = 0; i < globals.length; i++) {
        if (globals[i] === '-C' || globals[i] === '--no-pager') {
            if (globals[i] === '-C') i++;
            continue;
        }
        if (globals[i] === '-c' && globals[i + 1] === 'log.showSignature=false') {
            i++;
            continue;
        }
        throw new AdapterError(`unsupported global option for a Gent repository: ${globals[i]}`);
    }
}

async function classify(cwd) {
    let located;
    try { located = await repository.findGitdir(cwd); }
    catch (error) {
        if (error.code === 'GENT_NOT_A_REPOSITORY') return { kind: 'none' };
        throw error;
    }
    if (await repository.isLegacyRepository(located.commondir)) return { kind: 'legacy', located };

    let loaded;
    try { loaded = await repository.loadConfig(located.commondir, located.gitdir); }
    catch (error) {
        if (path.basename(located.commondir) === repository.GENT_DIR) throw error;
        return { kind: 'git', located };
    }
    const marker = loaded.set.get('gent.format');
    if (marker !== FORMAT_MARKER) {
        if (marker !== undefined) throw new AdapterError(`unsupported Gent format marker '${marker}' at ${located.commondir}`);
        if (path.basename(located.commondir) === repository.GENT_DIR) {
            throw new AdapterError(`unsupported Gent repository at ${located.commondir}: missing gent.format marker`);
        }
        return { kind: 'git', located };
    }
    return { kind: 'canonical', repo: await repository.open(cwd) };
}

function isRevision(value) {
    return typeof value === 'string' && value.length > 0 && !value.startsWith('-');
}

function validateRead(invocation) {
    const { command, args } = invocation;
    if (command === 'rev-parse') return args.length === 1 && args[0] === '--show-toplevel';
    if (command === 'branch') {
        return args.length >= 1 && args.length <= 2 && args.includes('--no-color') && args.every(a => a === '-a' || a === '--no-color');
    }
    if (command === 'remote') return args.length === 0;
    if (command === 'diff-index') return args.length === 1 && args[0] === 'HEAD';
    if (command === 'reflog') {
        return args.length === 3 && args[0].startsWith('--format=') && args[1] === 'refs/stash' && args[2] === '--';
    }
    if (command === 'show-ref') {
        return args.length >= 2 && args.every(a => ['--heads', '--tags', '-d', '--head'].includes(a)) && args.includes('-d') && args.includes('--head');
    }
    if (command === 'for-each-ref') {
        return args.length === 2 && args[0].startsWith('refs/tags/') && args[1].startsWith('--format=');
    }
    if (command === 'config') {
        if (args.length === 2 && args[0] === '--get') return /^(remote\.[^.]+\.url|user\.(name|email))$/i.test(args[1]);
        const base = args.slice(0, 3);
        return base.join('\0') === ['--list', '-z', '--includes'].join('\0') && args.length >= 3 && args.length <= 4 && (args.length === 3 || ['--local', '--global'].includes(args[3]));
    }
    if (command === 'status') {
        const allowed = new Set(['-s', '--porcelain', '-z', '--untracked-files=all', '--untracked-files=no']);
        return args.length >= 2 && args.every(a => allowed.has(a)) && args.includes('--porcelain');
    }
    if (command === 'show') {
        if (args.length === 1) return isRevision(args[0]) && /^[^:]+:.+/.test(args[0]);
        return args.length === 3 && args[0] === '--quiet' && isRevision(args[1]) && args[2].startsWith('--format=');
    }
    if (command === 'log') {
        const allowedOption = arg => arg === '--' || arg === '-n' || arg === '--first-parent' || arg === '--branches' || arg === '--tags' || arg === '--reflog' || arg === '--remotes' ||
            arg.startsWith('--max-count=') || arg.startsWith('--format=') || /^--(date|author-date|topo)-order$/.test(arg) || arg.startsWith('--glob=refs/remotes/');
        return args.includes('--') && args.some(a => a.startsWith('--format=')) && args.every(a => allowedOption(a) || isRevision(a));
    }
    if (command === 'diff' || command === 'diff-tree') {
        if (args.some(a => ['--ext-diff', '--textconv', '--no-index', '--output', '-o'].includes(a))) return false;
        const allowedOption = arg => ['--name-status', '--numstat', '-r', '--root', '--find-renames', '-z'].includes(arg) || /^--diff-filter=[AMDR]+$/.test(arg);
        return args.some(a => a === '--name-status' || a === '--numstat') && args.includes('-z') && args.every(a => allowedOption(a) || isRevision(a));
    }
    return false;
}

async function realGitPath() {
    const configModule = require('./git-graph-config');
    const config = await configModule.readConfig();
    if (!config.realGitPath) throw new AdapterError('real Git is not configured; run gent graph setup --git-path <absolute-path>');
    return config.realGitPath;
}

async function forward(argv, cwd, readOnly) {
    const executable = await realGitPath();
    return new Promise((resolve, reject) => {
        const env = { ...process.env };
        if (readOnly) {
            env.GIT_OPTIONAL_LOCKS = '0';
            env.GIT_EXTERNAL_DIFF = '';
        }
        const child = spawn(executable, argv, { cwd, env, stdio: 'inherit' });
        child.once('error', reject);
        child.once('exit', (code, signal) => resolve(code === null ? (signal ? 1 : 0) : code));
    });
}

function exact(args, expected) {
    return args.length === expected.length && args.every((arg, index) => arg === expected[index]);
}

function stashIndex(selector) {
    const match = /^stash@\{(\d+)\}$/.exec(selector || '');
    if (!match) throw new AdapterError(`unsupported stash selector '${selector || ''}'`);
    return Number(match[1]);
}

async function removeRemote(repo, name) {
    transport.nameCheck(name);
    if (!repo.config.get(`remote.${name}.url`)) throw new AdapterError(`remote '${name}' does not exist`);
    const tracking = await repo.refs.list(`refs/remotes/${name}/`);
    await repo.refs.updateMany([...tracking].map(([ref, oid]) => ({ name: ref, delete: true, expectedOldOid: oid })), `remote: remove ${name}`);
    for (const branch of repo.config.subsections('branch')) {
        if (repo.config.get(`branch.${branch}.remote`) !== name) continue;
        repo.localConfig.unset(`branch.${branch}.remote`);
        repo.localConfig.unset(`branch.${branch}.merge`);
        repo.localConfig.unset(`branch.${branch}.pushremote`);
    }
    for (const key of ['url', 'fetch', 'pushurl']) repo.localConfig.unset(`remote.${name}.${key}`);
    await repo.localConfig.save();
}

async function mutate(repo, command, args) {
    if (repo.bare || repo.gitdir !== repo.commondir) throw new AdapterError('Git Graph mutations require a non-bare Gent working tree without linked worktrees');

    if (command === 'branch') {
        if (exact(args.slice(0, 2), ['-d', '-r']) && args.length === 3) {
            const ref = `refs/remotes/${args[2]}`;
            const oid = await repo.refs.resolveToOid(ref);
            if (!oid) throw new AdapterError(`remote-tracking branch '${args[2]}' does not exist`);
            return repo.refs.delete(ref, { expectedOldOid: oid, reason: 'remote branch deleted' });
        }
        if (args[0] === '-m' && args.length === 3) return ops.renameBranch(repo, args[1], args[2]);
        if (['--delete', '-d'].includes(args[0])) {
            let index = 1, force = false;
            if (args[index] === '--force') { force = true; index++; }
            if (index !== args.length - 1) throw new AdapterError('unsupported branch deletion arguments');
            return ops.deleteBranch(repo, args[index], { force });
        }
        let index = 0;
        if (args[index] === '-f') throw new AdapterError('force branch replacement is not supported');
        if (args.length !== 2) throw new AdapterError('unsupported branch arguments');
        return ops.createBranch(repo, args[0], args[1]);
    }

    if (command === 'checkout') {
        if (args[0] === '-b' && args.length === 3) {
            const [, name, startPoint] = args;
            const result = await ops.checkout(repo, name, { create: true, startPoint });
            if (startPoint.startsWith('refs/remotes/') || (await repo.refs.resolveToOid(`refs/remotes/${startPoint}`))) {
                const remoteRef = startPoint.startsWith('refs/remotes/') ? startPoint.slice(13) : startPoint;
                const slash = remoteRef.indexOf('/');
                if (slash > 0) {
                    repo.localConfig.set(`branch.${name}.remote`, remoteRef.slice(0, slash));
                    repo.localConfig.set(`branch.${name}.merge`, `refs/heads/${remoteRef.slice(slash + 1)}`);
                    await repo.localConfig.save();
                }
            }
            return result;
        }
        if (args.length === 1 && isRevision(args[0])) return ops.checkout(repo, args[0]);
        throw new AdapterError('unsupported checkout arguments');
    }

    if (command === 'merge') {
        if (!args.length || args.length > 2 || !isRevision(args[0])) throw new AdapterError('unsupported merge arguments');
        if (args[1] && args[1] !== '--no-ff') throw new AdapterError(`unsupported merge option '${args[1]}'`);
        const result = await merge.merge(repo, args[0], { noFastForward: args[1] === '--no-ff' });
        if (result.status === 'conflicts') {
            return { adapterExitCode: 1, adapterMessage: 'Automatic merge failed; resolve with Gent CLI, then refresh Git Graph' };
        }
        return result;
    }

    if (command === 'tag') {
        if (args[0] === '-d' && args.length === 2) return ops.deleteTag(repo, args[1]);
        if (args.includes('-f') || args.includes('-s') || args.some(a => a.startsWith('--sign'))) throw new AdapterError('force and signed tags are not supported');
        if (args[0] === '-a' && args.length === 5 && args[2] === '-m') return ops.createTag(repo, args[1], { message: args[3], target: args[4] });
        if (args.length === 2) return ops.createTag(repo, args[0], { target: args[1] });
        throw new AdapterError('unsupported tag arguments');
    }

    if (command === 'reset') {
        if (args.length !== 2 || !['--soft', '--mixed', '--hard'].includes(args[0])) throw new AdapterError('only whole-repository soft, mixed and hard reset are supported');
        return ops.reset(repo, args[0].slice(2), args[1]);
    }

    if (command === 'stash') {
        const action = args[0];
        if (action === 'push') {
            const options = {};
            for (let i = 1; i < args.length; i++) {
                if (args[i] === '--include-untracked') options.includeUntracked = true;
                else if (args[i] === '--message' && args[i + 1] !== undefined) options.message = args[++i];
                else throw new AdapterError(`unsupported stash push option '${args[i]}'`);
            }
            return stash.push(repo, options);
        }
        if (['apply', 'pop'].includes(action)) {
            let index = 1, restoreIndex = false;
            if (args[index] === '--index') { restoreIndex = true; index++; }
            if (index !== args.length - 1) throw new AdapterError(`unsupported stash ${action} arguments`);
            return stash[action](repo, stashIndex(args[index]), { restoreIndex });
        }
        if (action === 'drop' && args.length === 2) return stash.drop(repo, stashIndex(args[1]));
        throw new AdapterError(`unsupported stash action '${action || ''}'`);
    }

    if (command === 'remote') {
        const action = args[0];
        if (action === 'add' && args.length === 3) {
            transport.nameCheck(args[1]);
            if (repo.config.get(`remote.${args[1]}.url`)) throw new AdapterError(`remote '${args[1]}' already exists`);
            repo.localConfig.set(`remote.${args[1]}.url`, transport.remoteUrl(args[2]));
            repo.localConfig.set(`remote.${args[1]}.fetch`, `+refs/heads/*:refs/remotes/${args[1]}/*`);
            return repo.localConfig.save();
        }
        if (action === 'set-url' && (args.length === 3 || args.length === 4)) {
            transport.nameCheck(args[1]);
            const current = repo.config.get(`remote.${args[1]}.url`);
            if (!current) throw new AdapterError(`remote '${args[1]}' does not exist`);
            if (args.length === 4 && current !== args[3]) throw new AdapterError(`remote '${args[1]}' URL changed; refresh Git Graph and retry`);
            repo.localConfig.set(`remote.${args[1]}.url`, transport.remoteUrl(args[2]));
            return repo.localConfig.save();
        }
        if (action === 'remove' && args.length === 2) return removeRemote(repo, args[1]);
        if (action === 'prune' && args.length === 2) return transport.fetch(repo, args[1], { prune: true });
        throw new AdapterError('remote rename, push URLs and custom URL lists are not supported');
    }

    if (command === 'config') {
        if (args[0] !== '--local') throw new AdapterError('only local user.name and user.email may be changed');
        if (args[1] === '--unset-all' && args.length === 3 && /^user\.(name|email)$/i.test(args[2])) {
            repo.localConfig.unset(args[2]);
            return repo.localConfig.save();
        }
        if (args.length === 3 && /^user\.(name|email)$/i.test(args[1])) {
            repo.localConfig.set(args[1], args[2]);
            return repo.localConfig.save();
        }
        throw new AdapterError('only local user.name and user.email may be changed');
    }

    if (command === 'fetch') {
        let index = 0, all = false, prune = false;
        if (args[index] === '--all') { all = true; index++; }
        const remote = all ? null : args[index++];
        for (; index < args.length; index++) {
            if (args[index] === '--prune') prune = true;
            else if (args[index] === '--prune-tags') throw new AdapterError('tag pruning is not supported');
            else throw new AdapterError(`unsupported fetch option '${args[index]}'`);
        }
        if (all) {
            for (const name of repo.config.subsections('remote')) {
                try { await transport.fetch(repo, name, { prune }); }
                catch (error) { throw new AdapterError(`fetch '${name}' failed: ${error.message}`); }
            }
            return;
        }
        if (!remote) throw new AdapterError('a remote is required');
        return transport.fetch(repo, remote, { prune });
    }

    if (command === 'push') {
        if (args.length < 2) throw new AdapterError('push requires an explicit remote and branch or tag');
        const [remote, item] = args;
        if (args.includes('--force') || args.some(a => a.startsWith('--force-with-lease'))) throw new AdapterError('force push is not supported');
        if (item === '--delete') {
            if (args.length !== 3) throw new AdapterError('remote deletion requires one explicit ref name');
            if (typeof transport.deleteRemoteRef !== 'function') throw new AdapterError('remote ref deletion is unavailable');
            return transport.deleteRemoteRef(repo, remote, args[2]);
        }
        const setUpstream = args.slice(2).includes('--set-upstream');
        if (args.slice(2).some(a => a !== '--set-upstream')) throw new AdapterError('unsupported push option');
        const branch = await repo.refs.resolveToOid(`refs/heads/${item}`);
        const tag = await repo.refs.resolveToOid(`refs/tags/${item}`);
        if (branch && tag) throw new AdapterError(`'${item}' is ambiguous; a branch and tag share that name`);
        if (!branch && !tag) throw new AdapterError(`unknown branch or tag '${item}'`);
        return transport.push(repo, remote, branch ? `refs/heads/${item}` : `refs/tags/${item}`, { setUpstream });
    }

    if (command === 'pull') {
        if (args.length < 2 || args.length > 3) throw new AdapterError('pull requires an explicit remote and branch');
        if (args[2] && args[2] !== '--no-ff') throw new AdapterError(`unsupported pull option '${args[2]}'`);
        await transport.fetch(repo, args[0]);
        const result = await merge.merge(repo, `refs/remotes/${args[0]}/${args[1]}`, { noFastForward: args[2] === '--no-ff' });
        if (result.status === 'conflicts') return { adapterExitCode: 1, adapterMessage: 'Pull fetched successfully but the merge has conflicts; resolve with Gent CLI, then refresh Git Graph' };
        return result;
    }

    throw new AdapterError(`unsupported Git Graph action '${command}' for a Gent repository`);
}

function checkpointFor(command) {
    return ['checkout', 'merge', 'pull', 'reset'].includes(command);
}

async function main(argv) {
    const invocation = parseInvocation(argv);
    if (exact(argv, ['--version'])) return forward(argv, process.cwd(), true);
    if (!invocation.command) throw new AdapterError('no command was provided');
    const classification = await classify(invocation.cwd);
    if (classification.kind === 'none' || classification.kind === 'git') return forward(argv, process.cwd(), false);
    if (classification.kind === 'legacy') throw new AdapterError('Git Graph integration is unavailable for legacy Gent repositories; run gent migrate --dry-run first');

    validateGlobals(invocation.globals);
    if (validateRead(invocation)) return forward(argv, process.cwd(), true);
    const readCommands = new Set(['rev-parse', 'log', 'show', 'show-ref', 'for-each-ref', 'remote', 'config', 'status', 'diff', 'diff-tree', 'diff-index', 'reflog', 'branch']);
    if (readCommands.has(invocation.command) && !['branch', 'remote', 'config'].includes(invocation.command)) {
        throw new AdapterError(`unapproved ${invocation.command} query for a Gent repository`);
    }
    const result = await executeCanonicalOperation({
        name: `graph-${invocation.command}`,
        startDir: invocation.cwd,
        repo: classification.repo,
        checkpoint: checkpointFor(invocation.command),
        displayName: `gent-git-graph ${invocation.command}`
    }, repo => mutate(repo, invocation.command, invocation.args));
    if (result?.adapterMessage) process.stderr.write(`gent-git-graph: ${result.adapterMessage}\n`);
    if (Number.isInteger(result?.adapterExitCode)) return result.adapterExitCode;
    return 0;
}

module.exports = { AdapterError, classify, main, mutate, parseInvocation, validateRead };
