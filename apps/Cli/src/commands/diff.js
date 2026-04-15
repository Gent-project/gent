/**
 * ============================================================================
 * Diff Command - Show changes between commits, staging, and working tree
 * ============================================================================
 *
 * PURPOSE:
 *   Display line-by-line differences between file versions, similar to
 *   `git diff`. Shows what changed, where, and how much.
 *
 * USAGE:
 *   gent diff                  → Working tree vs staging area
 *   gent diff --staged         → Staging area vs last commit
 *   gent diff <file>           → Diff specific file(s)
 *   gent diff --stat           → Summary only (no patch)
 *
 * ALGORITHM:
 *   Uses LCS (Longest Common Subsequence) line-level diff from diff-engine.js.
 *   Outputs unified diff format with context lines (3 by default).
 *   Time complexity: O(m*n) where m,n = line counts of old/new files.
 *
 * BACKEND EXPECTATIONS:
 *   None (local only). Backend receives final blob hashes, not diffs.
 *
 * ============================================================================
 */

const fs = require('fs').promises;
const path = require('path');
const chalk = require('chalk');
const { getGentPath, readJSON, pathExists, getAllFiles, getIgnorePatterns } = require('../utils/fileSystem');
const { STAGING_FILE, COMMITS_FILE } = require('../utils/constants');
const { readBlobAsString, hashBlob } = require('../utils/hash-engine');
const { formatUnifiedDiff, diffText } = require('../utils/diff-engine');

/**
 * Show differences
 * @param {Array} files - Optional specific files to diff
 * @param {Object} options - Command options
 */
async function diff(files, options) {
    try {
        const gentPath = await getGentPath();
        const cwd = process.cwd();

        const staging = await readJSON(path.join(gentPath, STAGING_FILE));
        const repository = await readJSON(path.join(gentPath, COMMITS_FILE));

        const currentBranch = repository.currentBranch || 'main';
        const headHash = repository.branches[currentBranch] || null;
        const headCommit = headHash
            ? (repository.commits || []).find(c => c.hash === headHash)
            : null;

        // Build HEAD tree map: path → blobHash
        const headTree = buildTreeMap(headCommit);

        // Build staging map: path → blobHash
        const stagingEntries = staging.entries || [];
        const stagingMap = new Map(stagingEntries.map(e => [e.path, e.hash]));

        if (options.staged) {
            // Staged vs HEAD
            await diffStagedVsHead(gentPath, cwd, stagingEntries, headTree, files, options);
        } else {
            // Working tree vs staged (or HEAD if not staged)
            await diffWorkingTree(gentPath, cwd, stagingMap, headTree, files, options);
        }

    } catch (error) {
        if (error.code === 'ENOENT' && error.message.includes('.gent')) {
            console.error(chalk.red('Error: Not a gent repository'));
            console.log(chalk.yellow('Run "gent init" to initialize a repository'));
        } else {
            console.error(chalk.red('Error:'), error.message);
        }
        process.exit(1);
    }
}

/**
 * Diff working tree vs staging/HEAD
 */
async function diffWorkingTree(gentPath, cwd, stagingMap, headTree, filterFiles, options) {
    const ignorePatterns = await getIgnorePatterns(cwd);
    const allFiles = await getAllFiles(cwd, ignorePatterns);
    let hasDiffs = false;

    let totalInsertions = 0;
    let totalDeletions = 0;
    const fileSummaries = [];

    for (const absPath of allFiles) {
        const relPath = path.relative(cwd, absPath);

        // Filter if specific files provided
        if (filterFiles && filterFiles.length > 0 && !filterFiles.includes(relPath)) continue;

        // Determine base hash (staging → HEAD fallback)
        const baseHash = stagingMap.get(relPath) || headTree.get(relPath);
        if (!baseHash) continue; // untracked

        const currentContent = await fs.readFile(absPath, 'utf-8');
        const currentHash = hashBlob(currentContent);

        if (currentHash === baseHash) continue; // unchanged

        let oldContent = '';
        try {
            oldContent = await readBlobAsString(gentPath, baseHash);
        } catch {
            // No blob = new file
        }

        const d = diffText(oldContent, currentContent);
        totalInsertions += d.stats.insertions;
        totalDeletions += d.stats.deletions;
        fileSummaries.push({ file: relPath, stats: d.stats });

        if (!options.stat) {
            const unified = formatUnifiedDiff(relPath, oldContent, currentContent);
            if (unified) {
                hasDiffs = true;
                printColorizedDiff(unified);
            }
        } else {
            hasDiffs = true;
        }
    }

    if (options.stat || hasDiffs) {
        printDiffStat(fileSummaries, totalInsertions, totalDeletions);
    }

    if (!hasDiffs) {
        console.log(chalk.gray('No changes'));
    }
}

/**
 * Diff staged files vs HEAD commit
 */
async function diffStagedVsHead(gentPath, cwd, stagedEntries, headTree, filterFiles, options) {
    let hasDiffs = false;
    let totalInsertions = 0;
    let totalDeletions = 0;
    const fileSummaries = [];

    for (const entry of stagedEntries) {
        if (filterFiles && filterFiles.length > 0 && !filterFiles.includes(entry.path)) continue;

        const headBlobHash = headTree.get(entry.path);

        if (entry.status === 'deleted') {
            if (headBlobHash) {
                const oldContent = await readBlobAsString(gentPath, headBlobHash);
                const d = diffText(oldContent, '');
                totalDeletions += d.stats.deletions;
                fileSummaries.push({ file: entry.path, stats: d.stats });
                if (!options.stat) {
                    printColorizedDiff(formatUnifiedDiff(entry.path, oldContent, ''));
                }
                hasDiffs = true;
            }
            continue;
        }

        if (!entry.hash) continue;

        if (entry.hash === headBlobHash) continue; // unchanged

        let oldContent = '';
        try {
            if (headBlobHash) oldContent = await readBlobAsString(gentPath, headBlobHash);
        } catch { /* new file */ }

        const newContent = await readBlobAsString(gentPath, entry.hash);
        const d = diffText(oldContent, newContent);
        totalInsertions += d.stats.insertions;
        totalDeletions += d.stats.deletions;
        fileSummaries.push({ file: entry.path, stats: d.stats });

        if (!options.stat) {
            const unified = formatUnifiedDiff(entry.path, oldContent, newContent);
            if (unified) {
                hasDiffs = true;
                printColorizedDiff(unified);
            }
        } else {
            hasDiffs = true;
        }
    }

    if (options.stat || hasDiffs) {
        printDiffStat(fileSummaries, totalInsertions, totalDeletions);
    }

    if (!hasDiffs) {
        console.log(chalk.gray('No staged changes'));
    }
}

/**
 * Build path → hash map from commit object
 */
function buildTreeMap(commit) {
    const map = new Map();
    if (!commit) return map;
    const tree = commit.tree || commit.files || [];
    for (const f of tree) {
        map.set(f.path || f.name, f.hash);
    }
    return map;
}

/**
 * Print colorized unified diff
 */
function printColorizedDiff(unifiedDiff) {
    const lines = unifiedDiff.split('\n');
    for (const line of lines) {
        if (line.startsWith('---') || line.startsWith('+++')) {
            console.log(chalk.bold(line));
        } else if (line.startsWith('@@')) {
            console.log(chalk.cyan(line));
        } else if (line.startsWith('+')) {
            console.log(chalk.green(line));
        } else if (line.startsWith('-')) {
            console.log(chalk.red(line));
        } else {
            console.log(line);
        }
    }
    console.log('');
}

/**
 * Print diff stat summary
 */
function printDiffStat(fileSummaries, totalIns, totalDel) {
    if (fileSummaries.length === 0) return;

    console.log('');
    const maxLen = Math.max(...fileSummaries.map(f => f.file.length));

    for (const { file, stats } of fileSummaries) {
        const total = stats.insertions + stats.deletions;
        const bar = chalk.green('+'.repeat(Math.min(stats.insertions, 30))) +
            chalk.red('-'.repeat(Math.min(stats.deletions, 30)));
        console.log(` ${file.padEnd(maxLen)} | ${String(total).padStart(4)} ${bar}`);
    }

    console.log(chalk.gray(` ${fileSummaries.length} file(s) changed, `) +
        chalk.green(`${totalIns} insertion(s)`) + ', ' +
        chalk.red(`${totalDel} deletion(s)`));
}

module.exports = diff;
