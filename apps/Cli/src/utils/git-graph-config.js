const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { spawn } = require('node:child_process');

const CONFIG_FILE_NAME = 'git-graph.json';

function getConfigPath() {
    return process.env.GENT_GRAPH_CONFIG
        ? path.resolve(process.env.GENT_GRAPH_CONFIG)
        : path.join(os.homedir(), '.gent', CONFIG_FILE_NAME);
}

async function readConfig() {
    let raw;
    try {
        raw = await fs.readFile(getConfigPath(), 'utf8');
    } catch (error) {
        if (error.code === 'ENOENT') return {};
        throw new Error(`Unable to read Git Graph configuration: ${error.message}`);
    }

    try {
        const config = JSON.parse(raw);
        if (!config || Array.isArray(config) || typeof config !== 'object') {
            throw new Error('expected a JSON object');
        }
        return config;
    } catch (error) {
        throw new Error(`Invalid Git Graph configuration at ${getConfigPath()}: ${error.message}`);
    }
}

async function writeConfig(config) {
    const data = { realGitPath: config.realGitPath };
    const configPath = getConfigPath();
    await fs.mkdir(path.dirname(configPath), { recursive: true });
    const temporaryPath = `${configPath}.${process.pid}.tmp`;
    await fs.writeFile(temporaryPath, `${JSON.stringify(data, null, 2)}\n`, { mode: 0o600 });
    await fs.rename(temporaryPath, configPath);
    await fs.chmod(configPath, 0o600);
    return configPath;
}

function runVersion(executable) {
    return new Promise((resolve, reject) => {
        const child = spawn(executable, ['--version'], { stdio: ['ignore', 'pipe', 'pipe'] });
        const stdout = [];
        const stderr = [];
        child.stdout.on('data', chunk => stdout.push(chunk));
        child.stderr.on('data', chunk => stderr.push(chunk));
        child.on('error', reject);
        child.on('close', code => {
            if (code !== 0) {
                reject(new Error(Buffer.concat(stderr).toString('utf8').trim() || `exited with status ${code}`));
                return;
            }
            resolve(Buffer.concat(stdout).toString('utf8').trim());
        });
    });
}

async function validateRealGit(executablePath, adapterPath) {
    if (!executablePath || !path.isAbsolute(executablePath)) {
        throw new Error('Real Git path must be an absolute path');
    }

    let resolvedPath;
    try {
        const stat = await fs.stat(executablePath);
        if (!stat.isFile()) throw new Error('not a file');
        await fs.access(executablePath, fs.constants.X_OK);
        resolvedPath = await fs.realpath(executablePath);
    } catch (error) {
        throw new Error(`Real Git executable is not usable at '${executablePath}': ${error.message}`);
    }

    if (adapterPath) {
        const resolvedAdapter = await fs.realpath(adapterPath).catch(() => path.resolve(adapterPath));
        if (resolvedPath === resolvedAdapter) {
            throw new Error('Real Git path resolves to gent-git-graph; choose the installed Git executable');
        }
    }

    let version;
    try {
        version = await runVersion(resolvedPath);
    } catch (error) {
        throw new Error(`Unable to run real Git at '${resolvedPath}': ${error.message}`);
    }
    if (!/^git version\s+\S+/i.test(version)) {
        throw new Error(`Executable at '${resolvedPath}' is not Git (--version returned '${version}')`);
    }

    return { path: resolvedPath, version };
}

module.exports = {
    getConfigPath,
    readConfig,
    writeConfig,
    validateRealGit,
};
