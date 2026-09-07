const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const chalk = require('chalk');

const authStorage = require('../utils/auth-storage');
const graphConfig = require('../utils/git-graph-config');
const repository = require('../utils/repository');
const { FORMAT_MARKER } = require('../utils/feature-support');

const MIN_NODE_MAJOR = 18;

function resolveAdapterPath() {
    if (process.env.GENT_GRAPH_ADAPTER) return path.resolve(process.env.GENT_GRAPH_ADAPTER);
    return path.join(os.homedir(), '.gent', 'bin', 'gent-git-graph');
}

function resolveAdapterEntrypoint() {
    return path.resolve(__dirname, '..', 'git-graph.js');
}

async function installLauncher(entrypoint) {
    if (/[\r\n]/.test(process.execPath) || /[\r\n]/.test(entrypoint)) throw new Error('Node or adapter path contains a newline');
    if (/\s/.test(process.execPath)) throw new Error(`Node path '${process.execPath}' contains whitespace and cannot be used in the macOS launcher shebang`);
    const launcher = resolveAdapterPath();
    await fs.mkdir(path.dirname(launcher), { recursive: true });
    const temporary = `${launcher}.${process.pid}.tmp`;
    await fs.writeFile(temporary, `#!${process.execPath}\nrequire(${JSON.stringify(entrypoint)});\n`, { mode: 0o755 });
    await fs.rename(temporary, launcher);
    await fs.chmod(launcher, 0o755);
    return launcher;
}

async function setup(options = {}) {
    const explicitAdapter = options.adapterPath || process.env.GENT_GRAPH_ADAPTER;
    const entrypoint = explicitAdapter ? path.resolve(explicitAdapter) : resolveAdapterEntrypoint();
    await assertExecutable(entrypoint, 'gent-git-graph adapter');
    const validated = await graphConfig.validateRealGit(options.gitPath, entrypoint);
    const configPath = await graphConfig.writeConfig({ realGitPath: validated.path });
    const adapterPath = explicitAdapter ? entrypoint : await installLauncher(entrypoint);

    console.log(`Configured real Git: ${validated.path}`);
    console.log(`Git version: ${validated.version}`);
    console.log(`Saved adapter configuration: ${configPath}`);
    console.log('\nVS Code settings.json:');
    console.log(JSON.stringify({ 'git.path': adapterPath }, null, 2));
    console.log('\nUse a dedicated VS Code profile because git.path also affects the built-in Git extension.');

    return { adapterPath, configPath, ...validated };
}

async function doctor(options = {}) {
    const checks = [];
    const adapterPath = options.adapterPath || tryResolveAdapterPath();
    const config = await graphConfig.readConfig().catch(error => {
        checks.push(fail('Adapter configuration', error.message, 'Run `gent graph setup --git-path <absolute-path>`.'));
        return {};
    });

    const nodeMajor = Number(process.versions.node.split('.')[0]);
    checks.push(nodeMajor >= MIN_NODE_MAJOR
        ? pass('Node', `${process.execPath} (v${process.versions.node})`)
        : fail('Node', `v${process.versions.node}; Node ${MIN_NODE_MAJOR}+ is required`));

    if (adapterPath) {
        try {
            await assertExecutable(adapterPath, 'gent-git-graph adapter');
            checks.push(pass('Adapter executable', adapterPath));
        } catch (error) {
            checks.push(fail('Adapter executable', error.message, 'Reinstall or relink gent-cli.'));
        }
    } else {
        checks.push(fail('Adapter executable', 'gent-git-graph is not present in this CLI installation'));
    }

    let validatedGit;
    if (!config.realGitPath) {
        if (!checks.some(check => check.name === 'Adapter configuration')) {
            checks.push(fail('Adapter configuration', 'real Git is not configured', 'Run `gent graph setup --git-path <absolute-path>`.'));
        }
    } else {
        try {
            validatedGit = await graphConfig.validateRealGit(config.realGitPath, adapterPath);
            checks.push(pass('Real Git', `${validatedGit.path} (${validatedGit.version})`));
        } catch (error) {
            checks.push(fail('Real Git', error.message, 'Run `gent graph setup` again with the installed Git executable.'));
        }
    }

    if (validatedGit) {
        try {
            await probeSha256(validatedGit.path);
            checks.push(pass('Git SHA-256 support', 'temporary repository probe passed'));
        } catch (error) {
            checks.push(fail('Git SHA-256 support', error.message, 'Install a Git build with SHA-256 repository support.'));
        }
    }

    const repoCheck = await checkRepository(options.cwd || process.cwd());
    checks.push(repoCheck.repository);
    checks.push(repoCheck.remote);

    if (await authStorage.isAuthenticated()) {
        const user = await authStorage.getUser();
        checks.push(pass('Saved authentication', user?.email ? `available for ${user.email}` : 'available'));
    } else {
        checks.push(warn('Saved authentication', 'not available', 'Run `gent login` for private remotes and mutations.'));
    }

    for (const check of checks) printCheck(check);
    const failed = checks.filter(check => check.status === 'fail').length;
    if (failed) process.exitCode = 1;
    return checks;
}

function tryResolveAdapterPath() {
    try {
        return resolveAdapterPath();
    } catch {
        return null;
    }
}

async function assertExecutable(filePath, label) {
    if (!path.isAbsolute(filePath)) throw new Error(`${label} path must be absolute`);
    const stat = await fs.stat(filePath).catch(error => {
        throw new Error(`${label} not found at '${filePath}': ${error.message}`);
    });
    if (!stat.isFile()) throw new Error(`${label} is not a file: '${filePath}'`);
    await fs.access(filePath, fs.constants.X_OK).catch(error => {
        throw new Error(`${label} is not executable at '${filePath}': ${error.message}`);
    });
}

function run(executable, args) {
    return new Promise((resolve, reject) => {
        const child = spawn(executable, args, { stdio: ['ignore', 'pipe', 'pipe'] });
        const stdout = [];
        const stderr = [];
        child.stdout.on('data', chunk => stdout.push(chunk));
        child.stderr.on('data', chunk => stderr.push(chunk));
        child.on('error', reject);
        child.on('close', code => {
            const output = Buffer.concat(stdout).toString('utf8').trim();
            const errorOutput = Buffer.concat(stderr).toString('utf8').trim();
            if (code === 0) resolve(output);
            else reject(new Error(errorOutput || output || `Git exited with status ${code}`));
        });
    });
}

async function probeSha256(gitPath) {
    const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'gent-graph-doctor-'));
    const repoPath = path.join(temporaryRoot, 'probe.git');
    try {
        await run(gitPath, ['init', '--bare', '--object-format=sha256', repoPath]);
        const format = await run(gitPath, ['-C', repoPath, 'rev-parse', '--show-object-format']);
        if (format !== 'sha256') throw new Error(`temporary probe reported object format '${format}'`);
    } finally {
        await fs.rm(temporaryRoot, { recursive: true, force: true });
    }
}

async function checkRepository(cwd) {
    let located;
    try {
        located = await repository.findGitdir(cwd);
    } catch (error) {
        if (error.code === 'GENT_NOT_A_REPOSITORY') {
            return {
                repository: warn('Repository', 'no repository found from this directory'),
                remote: warn('Remote configuration', 'not checked without a repository'),
            };
        }
        return {
            repository: fail('Repository', error.message),
            remote: warn('Remote configuration', 'not checked because repository discovery failed'),
        };
    }

    if (await repository.isLegacyRepository(located.commondir)) {
        return {
            repository: fail('Repository', `legacy Gent repository at ${located.worktree || located.commondir}`, 'Git Graph supports fresh canonical Gent repositories only.'),
            remote: warn('Remote configuration', 'not checked for a legacy repository'),
        };
    }

    try {
        const { set } = await repository.loadConfig(located.commondir, located.gitdir);
        const marker = set.get('gent.format');
        if (!marker) {
            if (path.basename(located.commondir) === repository.GENT_DIR) {
                return {
                    repository: fail('Repository', `malformed Gent repository at ${located.commondir}: gent.format marker is missing`),
                    remote: warn('Remote configuration', 'not checked for a malformed Gent repository'),
                };
            }
            return {
                repository: pass('Repository', `ordinary Git repository at ${located.worktree || located.commondir}`),
                remote: pass('Remote configuration', 'handled directly by installed Git'),
            };
        }
        if (marker !== FORMAT_MARKER) {
            return {
                repository: fail('Repository', `unsupported Gent format marker '${marker}' at ${located.commondir}`),
                remote: warn('Remote configuration', 'not checked for an unsupported Gent repository'),
            };
        }

        const repo = await repository.open(cwd);
        const remotes = new Set();
        for (const [key] of repo.config.list()) {
            const match = /^remote\.([^.]*)\.url$/i.exec(key);
            if (match) remotes.add(match[1]);
        }
        return {
            repository: pass('Repository', `canonical Gent repository at ${repo.worktree || repo.commondir}`),
            remote: remotes.size
                ? pass('Remote configuration', `configured: ${[...remotes].sort().join(', ')}`)
                : warn('Remote configuration', 'no remotes configured'),
        };
    } catch (error) {
        return {
            repository: fail('Repository', error.message),
            remote: warn('Remote configuration', 'not checked because repository validation failed'),
        };
    }
}

function pass(name, detail) { return { name, status: 'pass', detail }; }
function warn(name, detail, hint) { return { name, status: 'warn', detail, hint }; }
function fail(name, detail, hint) { return { name, status: 'fail', detail, hint }; }

function printCheck(check) {
    const badge = check.status === 'pass' ? chalk.green('PASS')
        : check.status === 'warn' ? chalk.yellow('WARN')
            : chalk.red('FAIL');
    console.log(`${badge}  ${check.name}: ${check.detail}`);
    if (check.hint) console.log(chalk.gray(`      ${check.hint}`));
}

module.exports = {
    setup,
    doctor,
    resolveAdapterPath,
    resolveAdapterEntrypoint,
    installLauncher,
    probeSha256,
    checkRepository,
};
