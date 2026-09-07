const fs = require('fs').promises;
const path = require('path');
const chalk = require('chalk');
const { getGentPath, readJSON, writeJSON } = require('../utils/fileSystem');
const { COMMITS_FILE, STAGING_FILE } = require('../utils/constants');
const { hashBlob, readBlob, storeBlob, isBinaryBuffer } = require('../utils/hash-engine');
const { mergeFileContent } = require('../utils/merge-engine');
const commitCommand = require('./commit');

function treeMap(commit) {
    const entries = commit?.tree || (commit?.files || []).map(file => ({
        mode: '100644', name: file.path || file.name, hash: file.hash, type: 'blob'
    }));
    return new Map(entries.map(entry => [entry.name || entry.path, entry]));
}

function safePath(cwd, relativePath) {
    if (!relativePath || path.isAbsolute(relativePath) || relativePath.split(/[\\/]/).includes('..')) {
        throw new Error(`Unsafe repository path '${relativePath}'`);
    }
    const full = path.resolve(cwd, relativePath);
    if (!full.startsWith(cwd + path.sep)) throw new Error(`Unsafe repository path '${relativePath}'`);
    return full;
}

async function revert(revision, options = {}) {
    try {
        if (!revision) throw new Error('usage: gent revert <commit>');
        const gentPath = await getGentPath();
        const cwd = path.dirname(gentPath);
        const repository = await readJSON(path.join(gentPath, COMMITS_FILE));
        const stagingPath = path.join(gentPath, STAGING_FILE);
        const staging = await readJSON(stagingPath);
        if ((staging.entries || []).length || (staging.files || []).length || staging.mergeState) {
            throw new Error('commit or stash staged changes before reverting');
        }

        const commits = repository.commits || [];
        const matches = commits.filter(item => item.hash === revision || item.hash.startsWith(revision));
        if (matches.length !== 1) throw new Error(matches.length ? `'${revision}' is ambiguous` : `Commit '${revision}' not found`);
        const target = matches[0];
        const parents = [target.parent, target.mergeParent].filter(Boolean);
        let parentHash = parents[0] || null;
        if (parents.length > 1) {
            const mainline = Number(options.mainline);
            if (!Number.isInteger(mainline) || mainline < 1 || mainline > parents.length) {
                throw new Error(`Commit ${target.hash.slice(0, 12)} is a merge; use --mainline <1-${parents.length}>`);
            }
            parentHash = parents[mainline - 1];
        }
        const parent = parentHash ? commits.find(item => item.hash === parentHash) : null;
        if (parentHash && !parent) throw new Error(`Parent commit '${parentHash}' not found`);
        const headHash = repository.branches[repository.currentBranch];
        const head = commits.find(item => item.hash === headHash);
        if (!head) throw new Error('cannot revert before the first commit');

        const baseTree = treeMap(target);
        const oursTree = treeMap(head);
        const parentTree = treeMap(parent);
        const resultTree = new Map();
        const conflicts = [];
        const same = (a, b) => (!a && !b) || (a && b && a.hash === b.hash);

        for (const file of new Set([...baseTree.keys(), ...oursTree.keys(), ...parentTree.keys()])) {
            const base = baseTree.get(file) || null;
            const ours = oursTree.get(file) || null;
            const theirs = parentTree.get(file) || null;
            if (same(ours, theirs)) { if (ours) resultTree.set(file, ours); continue; }
            if (same(base, ours)) { if (theirs) resultTree.set(file, theirs); continue; }
            if (same(base, theirs)) { if (ours) resultTree.set(file, ours); continue; }
            if (!base || !ours || !theirs) { conflicts.push(file); continue; }

            const [baseBytes, oursBytes, theirsBytes] = await Promise.all([
                readBlob(gentPath, base.hash), readBlob(gentPath, ours.hash), readBlob(gentPath, theirs.hash)
            ]);
            if ([baseBytes, oursBytes, theirsBytes].some(isBinaryBuffer)) { conflicts.push(file); continue; }
            const merged = mergeFileContent(
                baseBytes.toString('utf8'), oursBytes.toString('utf8'), theirsBytes.toString('utf8'), file,
                { ours: 'HEAD', theirs: `parent of ${target.hash.slice(0, 12)}` }
            );
            if (merged.hasConflicts) { conflicts.push(file); continue; }
            resultTree.set(file, { ...ours, hash: await storeBlob(gentPath, Buffer.from(merged.content, 'utf8')) });
        }
        if (conflicts.length) throw new Error(`revert conflicts with current changes:\n${conflicts.map(file => `  ${file}`).join('\n')}`);

        const changed = [...new Set([...oursTree.keys(), ...resultTree.keys()])]
            .filter(file => oursTree.get(file)?.hash !== resultTree.get(file)?.hash);
        const writes = new Map();
        for (const file of changed) {
            const full = safePath(cwd, file);
            const current = oursTree.get(file);
            const desired = resultTree.get(file);
            const stat = await fs.lstat(full).catch(() => null);
            if (current) {
                if (!stat?.isFile() || hashBlob(await fs.readFile(full)) !== current.hash) {
                    throw new Error(`local changes would be overwritten by revert: ${file}`);
                }
            } else if (desired && stat) {
                throw new Error(`untracked file would be overwritten by revert: ${file}`);
            }
            if (desired) writes.set(file, await readBlob(gentPath, desired.hash));
        }

        for (const file of changed) {
            if (!resultTree.has(file)) await fs.rm(safePath(cwd, file), { force: true });
        }
        for (const [file, bytes] of writes) {
            const full = safePath(cwd, file);
            await fs.mkdir(path.dirname(full), { recursive: true });
            await fs.writeFile(full, bytes);
        }

        staging.entries = changed.map(file => {
            const desired = resultTree.get(file);
            return {
                path: file,
                hash: desired?.hash || null,
                status: desired ? (oursTree.has(file) ? 'modified' : 'added') : 'deleted',
                binary: desired ? isBinaryBuffer(writes.get(file)) : false,
                stats: { insertions: 0, deletions: 0 },
            };
        });
        staging.files = staging.entries.map(entry => entry.path);
        await writeJSON(stagingPath, staging);

        if (options.commit === false) {
            console.log(chalk.green(`Revert of ${target.hash.slice(0, 12)} staged but not committed`));
            return;
        }
        const subject = String(target.message || '').split('\n')[0];
        await commitCommand({ message: `Revert "${subject}"\n\nThis reverts commit ${target.hash}.` });
    } catch (error) {
        console.error(chalk.red('Error:'), error.message);
        process.exitCode = 1;
    }
}

module.exports = revert;
