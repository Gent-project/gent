/**
 * ============================================================================
 * Resolve Command - Interactive merge-conflict resolver
 * ============================================================================
 *
 * PURPOSE:
 *   Walk each conflict hunk left by `gent merge` and let the user choose how to
 *   resolve it — ours / theirs / both / edit / (optionally) ask AI — instead of
 *   hand-editing conflict markers. When every conflict is resolved it offers to
 *   finalize the merge commit.
 *
 * USAGE:
 *   gent resolve            → interactively resolve the in-progress merge
 *
 * STATE:
 *   Reads staging.mergeState (written by merge.js on conflict): sourceBranch,
 *   oursHash, theirsHash, baseHash, mergedEntries, conflicts.
 *
 * ============================================================================
 */

const fs = require('fs').promises;
const path = require('path');
const chalk = require('chalk');
const inquirer = require('inquirer');
const { getGentPath, readJSON, writeJSON } = require('../utils/fileSystem');
const { COMMITS_FILE, STAGING_FILE, CONFIG_FILE } = require('../utils/constants');
const { storeBlob, storeTree, readBlobAsString } = require('../utils/hash-engine');
const { parseConflictMarkers, hasConflictMarkers } = require('../utils/merge-engine');
const { generateCommitHash } = require('../utils/helpers');
const authStorage = require('../utils/auth-storage');
const journal = require('../utils/journal');
const ai = require('../utils/ai-service');
const reviewCommand = require('./review');

async function resolve(options = {}) {
    try {
        await ai.prime();
        if (options.ai && !ai.isEnabled()) {
            console.error(chalk.red(ai.disabledHint()));
            process.exitCode = 1;
            return;
        }

        const gentPath = await getGentPath();
        const cwd = process.cwd();

        const staging = await readJSON(path.join(gentPath, STAGING_FILE));
        const mergeState = staging.mergeState;

        if (!mergeState) {
            console.log(chalk.yellow('No merge in progress'));
            console.log(chalk.gray('Run "gent merge <branch>" first; if it conflicts, resolve it here.'));
            return;
        }

        // Files that carry conflict markers on disk.
        const markerFiles = (mergeState.conflicts || [])
            .filter(c => c.type === 'content' || c.type === 'add-add')
            .map(c => c.file);

        if (markerFiles.length === 0) {
            console.log(chalk.green('No conflict markers to resolve.'));
            console.log(chalk.cyan('Run "gent commit" to finalize the merge.'));
            return;
        }

        console.log(chalk.bold.cyan(`\nResolving merge of '${mergeState.sourceBranch}' — ${markerFiles.length} file(s)\n`));
        const repository = await readJSON(path.join(gentPath, COMMITS_FILE));
        const hunkOptions = {
            ...options,
            oursLabel: repository.currentBranch || 'ours',
            theirsLabel: mergeState.sourceBranch || 'theirs',
        };

        // Working copy of merged tree entries (we patch hashes as files resolve).
        const entriesByName = new Map((mergeState.mergedEntries || []).map(e => [e.name, { ...e }]));
        let unresolvedFiles = 0;

        for (const file of markerFiles) {
            const full = path.join(cwd, file);
            let content;
            try {
                content = await fs.readFile(full, 'utf-8');
            } catch {
                console.log(chalk.gray(`  (skipping ${file} — not on disk)`));
                continue;
            }

            if (!hasConflictMarkers(content)) {
                console.log(chalk.green(`  ✓ ${file} already resolved`));
                await stageResolved(gentPath, staging, entriesByName, file, content);
                continue;
            }

            console.log(chalk.bold(`\n${file}`));
            const segments = parseConflictMarkers(content);
            const conflictCount = segments.filter(s => s.type === 'conflict').length;
            let idx = 0;
            let aborted = false;
            const out = [];
            const aiSummaries = [];

            for (const seg of segments) {
                if (seg.type === 'text') {
                    out.push(...seg.lines);
                    continue;
                }
                idx++;
                const resolvedLines = await resolveHunk(seg, file, idx, conflictCount, hunkOptions, aiSummaries);
                if (resolvedLines === null) { aborted = true; break; }
                out.push(...resolvedLines);
            }

            if (aborted) {
                console.log(chalk.yellow(`  Left ${file} with remaining markers — re-run "gent resolve" later.`));
                unresolvedFiles++;
                continue;
            }

            const resolvedContent = out.join('\n');
            await fs.writeFile(full, resolvedContent, 'utf-8');

            if (hasConflictMarkers(resolvedContent)) {
                unresolvedFiles++;
                console.log(chalk.yellow(`  ${file} still has markers`));
            } else {
                await stageResolved(gentPath, staging, entriesByName, file, resolvedContent);
                console.log(chalk.green(`  ✓ resolved ${file}`));
                if (aiSummaries.length) {
                    console.log(chalk.gray(`    AI: ${summarizeFileChanges(aiSummaries)}`));
                }
            }
        }

        await writeJSON(path.join(gentPath, STAGING_FILE), staging);

        if (unresolvedFiles > 0) {
            console.log(chalk.yellow(`\n${unresolvedFiles} file(s) still have conflicts. Re-run "gent resolve" when ready.`));
            process.exitCode = 1;
            return;
        }

        // All conflicts resolved — offer to finalize the merge commit.
        const finalize = options.ai || (await inquirer.prompt([{
            type: 'confirm',
            name: 'finalize',
            message: 'All conflicts resolved. Create the merge commit now?',
            default: true
        }])).finalize;

        if (!finalize) {
            console.log(chalk.cyan('Resolved files staged. Run "gent commit" when ready.'));
            return;
        }

        const mergeCommit = await finalizeMerge(gentPath, staging, mergeState, entriesByName);
        if (options.ai) {
            console.log(chalk.bold.cyan('\nAI review of the completed merge'));
            await reviewCommand(mergeCommit.hash, { head: true });
        }
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
 * Prompt for one conflict hunk. Returns the chosen lines, or null to abort
 * (leave the rest of the file as-is with markers).
 */
async function resolveHunk(seg, file, idx, total, options = {}, aiSummaries = []) {
    console.log(chalk.gray(`  Conflict ${idx}/${total}:`));
    console.log(chalk.green('    <<< ours'));
    seg.ours.forEach(l => console.log(chalk.green(`      ${l}`)));
    console.log(chalk.red('    >>> theirs'));
    seg.theirs.forEach(l => console.log(chalk.red(`      ${l}`)));

    const choices = resolutionChoices();

    if (options.ai) {
        const suggestion = await askAiForHunk(seg, file, true, aiSummaries, options);
        if (suggestion !== null) return suggestion;
        return null;
    }

    const { choice } = await inquirer.prompt([{
        type: 'list',
        name: 'choice',
        message: `Resolve conflict ${idx}`,
        choices
    }]);

    switch (choice) {
        case 'ours': return seg.ours;
        case 'theirs': return seg.theirs;
        case 'both': return [...seg.ours, ...seg.theirs];
        case 'skip': return null;
        case 'edit': {
            const { text } = await inquirer.prompt([{
                type: 'editor',
                name: 'text',
                message: 'Edit the resolved section',
                default: [...seg.ours, ...seg.theirs].join('\n')
            }]);
            return text.replace(/\n$/, '').split('\n');
        }
        case 'ai': {
            const suggestion = await askAiForHunk(seg, file, false, aiSummaries, options);
            if (suggestion !== null) return suggestion;
            return resolveHunk(seg, file, idx, total, { ...options, ai: false }, aiSummaries);
        }
        default: return seg.ours;
    }
}

function resolutionChoices() {
    return [
        { name: 'Keep ours', value: 'ours' },
        { name: 'Keep theirs', value: 'theirs' },
        { name: 'Keep both (ours then theirs)', value: 'both' },
        { name: `Resolve with AI (${ai.getModel()})`, value: 'ai' },
        { name: 'Edit manually', value: 'edit' },
        { name: 'Skip the rest of this file', value: 'skip' },
    ];
}

async function askAiForHunk(seg, file, autoAccept = false, aiSummaries = [], labels = {}) {
    try {
        const resolution = await ai.resolveConflictHunk({
            ours: seg.ours.join('\n'),
            theirs: seg.theirs.join('\n'),
            fileName: file
        });
        printAiAnalysis(resolution, labels);
        if (autoAccept) {
            aiSummaries.push(resolution.summary);
            return resolution.merged.split('\n');
        }
        console.log(chalk.bold.cyan('    AI-proposed merged content:'));
        resolution.merged.split('\n').forEach(line => console.log(chalk.cyan(`      ${line}`)));
        const { accept } = await inquirer.prompt([{
            type: 'confirm',
            name: 'accept',
            message: 'Use this AI suggestion?',
            default: false,
        }]);
        if (!accept) return null;
        aiSummaries.push(resolution.summary);
        return resolution.merged.split('\n');
    } catch (error) {
        console.log(chalk.yellow(`    AI failed (${error.message}); no file was changed.`));
        return null;
    }
}

function aiAnalysisLines(resolution, labels = {}) {
    const ours = labels.oursLabel || 'ours';
    const theirs = labels.theirsLabel || 'theirs';
    return [
        `Gent AI analysis (${ai.getModel()}):`,
        `Current branch (${ours}): ${resolution.oursSummary}`,
        `Incoming branch (${theirs}): ${resolution.theirsSummary}`,
        `AI merge decision: ${resolution.summary}`,
    ];
}

function printAiAnalysis(resolution, labels) {
    const [heading, ...details] = aiAnalysisLines(resolution, labels);
    console.log(chalk.bold.cyan(`    ${heading}`));
    details.forEach(line => console.log(chalk.cyan(`      ${line}`)));
}

function summarizeFileChanges(summaries) {
    const summary = [...new Set(summaries)].join('; ');
    const words = summary.split(/\s+/);
    const wordLimited = words.length <= 32
        ? summary
        : `${words.slice(0, 32).join(' ')}...`;
    return wordLimited.length <= 220
        ? wordLimited
        : `${wordLimited.slice(0, 217).trimEnd()}...`;
}

/** Store the resolved file as a blob, patch the tree entry, and stage it. */
async function stageResolved(gentPath, staging, entriesByName, file, content) {
    const hash = await storeBlob(gentPath, content);
    const entry = entriesByName.get(file) || { mode: '100644', name: file, type: 'blob' };
    entry.hash = hash;
    entriesByName.set(file, entry);

    staging.entries = staging.entries || [];
    const existing = staging.entries.find(e => e.path === file);
    if (existing) {
        existing.hash = hash;
        existing.status = 'modified';
    } else {
        staging.entries.push({ path: file, hash, status: 'modified', binary: false, stats: { insertions: 0, deletions: 0 } });
    }
    staging.files = staging.entries.map(e => e.path);
}

/** Create the merge commit from the resolved tree and clear merge state. */
async function finalizeMerge(gentPath, staging, mergeState, entriesByName) {
    const repository = await readJSON(path.join(gentPath, COMMITS_FILE));
    const config = await readJSON(path.join(gentPath, CONFIG_FILE));

    let authorName = config.user && config.user.name;
    let authorEmail = config.user && config.user.email;
    if (!authorName || !authorEmail) {
        const globalUser = await authStorage.getUser();
        if (globalUser) {
            if (!authorName) authorName = [globalUser.first_name, globalUser.last_name].filter(Boolean).join(' ');
            if (!authorEmail) authorEmail = globalUser.email;
        }
    }
    if (!authorName && authorEmail) authorName = authorEmail;

    const mergedEntries = [...entriesByName.values()];
    const treeHash = await storeTree(gentPath, mergedEntries);

    const mergeCommit = {
        hash: generateCommitHash(),
        message: `Merge branch '${mergeState.sourceBranch}' into ${repository.currentBranch}`,
        author: { name: authorName || 'Unknown', email: authorEmail || 'unknown@gent' },
        timestamp: new Date().toISOString(),
        parent: mergeState.oursHash,
        mergeParent: mergeState.theirsHash,
        treeHash,
        tree: mergedEntries,
        files: mergedEntries.map(e => ({ path: e.name, hash: e.hash })),
        stats: { filesChanged: mergedEntries.length, insertions: 0, deletions: 0 }
    };

    await journal.recordOp(gentPath, 'merge', `resolve+merge '${mergeState.sourceBranch}' into ${repository.currentBranch}`);

    repository.commits = repository.commits || [];
    repository.commits.push(mergeCommit);
    repository.branches[repository.currentBranch] = mergeCommit.hash;
    await writeJSON(path.join(gentPath, COMMITS_FILE), repository);

    staging.entries = [];
    staging.files = [];
    staging.mergeState = null;
    await writeJSON(path.join(gentPath, STAGING_FILE), staging);

    console.log(chalk.green(`\n✓ Merge committed — ${mergeCommit.hash.substring(0, 7)}`));
    return mergeCommit;
}

module.exports = resolve;
module.exports.resolutionChoices = resolutionChoices;
module.exports.aiAnalysisLines = aiAnalysisLines;
