const path = require('path');
const chalk = require('chalk');
const { getGentPath, readJSON } = require('../utils/fileSystem');
const { COMMITS_FILE } = require('../utils/constants');
const { readBlob, isBinaryBuffer } = require('../utils/hash-engine');
const { traceBlame } = require('../utils/blame-engine');

function treeMap(commit) {
    const tree = commit?.tree || (commit?.files || []).map(file => ({
        name: file.path || file.name,
        hash: file.hash,
    }));
    return new Map(tree.map(entry => [entry.name || entry.path, entry.hash]));
}

async function blame(file, revision) {
    try {
        if (!file) throw new Error('usage: gent blame <file> [revision]');
        const gentPath = await getGentPath();
        const cwd = path.dirname(gentPath);
        const relative = path.relative(cwd, path.resolve(process.cwd(), file));
        if (!relative || relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
            throw new Error(`'${file}' is outside the repository`);
        }

        const repository = await readJSON(path.join(gentPath, COMMITS_FILE));
        const commits = repository.commits || [];
        const start = revision || repository.branches[repository.currentBranch];
        let commit = commits.find(item => item.hash === start || item.hash.startsWith(start));
        if (!commit) throw new Error(`Commit '${start || 'HEAD'}' not found`);

        const history = [];
        while (commit) {
            const blob = treeMap(commit).get(relative);
            const bytes = blob ? await readBlob(gentPath, blob) : Buffer.alloc(0);
            if (isBinaryBuffer(bytes)) throw new Error(`cannot blame binary file '${relative}'`);
            history.push({
                oid: commit.hash,
                author: commit.author?.name || commit.author?.email || 'Unknown',
                timestamp: commit.timestamp,
                text: bytes.toString('utf8'),
            });
            commit = commit.parent ? commits.find(item => item.hash === commit.parent) : null;
        }
        if (!treeMap(commits.find(item => item.hash === start || item.hash.startsWith(start))).has(relative)) {
            throw new Error(`path '${relative}' does not exist in ${revision || 'HEAD'}`);
        }
        printBlame(traceBlame(history));
    } catch (error) {
        console.error(chalk.red('Error:'), error.message);
        process.exitCode = 1;
    }
}

function printBlame(lines) {
    const authorWidth = Math.max(1, ...lines.map(item => item.author.length));
    const lineWidth = String(lines.length || 1).length;
    for (const item of lines) {
        const date = new Date(item.timestamp).toISOString().slice(0, 10);
        console.log(`${item.oid.slice(0, 12)} (${item.author.padEnd(authorWidth)} ${date} ${String(item.lineNumber).padStart(lineWidth)}) ${item.line}`);
    }
}

module.exports = blame;
module.exports.printBlame = printBlame;
