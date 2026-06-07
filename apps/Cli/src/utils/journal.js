/**
 * ============================================================================
 * Operation Journal - Safety net for history-changing commands
 * ============================================================================
 *
 * PURPOSE:
 *   Record every history-changing operation (commit, merge, reset, checkout,
 *   branch delete, pull) so it can be reversed with a single `gent undo` and
 *   re-applied with `gent redo`. Friendlier and more discoverable than
 *   `git reflog`: a human-readable list and one-command undo.
 *
 * WHAT IS RECORDED:
 *   Before an operation mutates `commits.json`, `recordOp()` snapshots the
 *   parts that change — the `branches` map and `currentBranch`. That snapshot
 *   plus a label/description/timestamp becomes one journal entry.
 *
 * UNDO SEMANTICS (intentionally non-destructive):
 *   - `gent undo` restores branch pointers + current branch to their state
 *     before the last operation.
 *   - Working files are NEVER deleted. For operations that discard file
 *     content (reset --hard, fast-forward merge, pull) the entry is flagged
 *     `restoreTree`, and undo also rewrites those files from the object store.
 *     For commit / checkout / branch-delete, undo leaves the working tree
 *     as-is — a just-committed change simply becomes uncommitted again.
 *   - `gent redo` re-applies the last undone operation. Any new history-
 *     changing operation clears the redo stack.
 *
 * STORAGE:
 *   .gent/journal.json → { entries: [...], redo: [...] }
 *   History is capped to the most recent MAX_ENTRIES operations.
 *
 * ============================================================================
 */

const fs = require('fs').promises;
const path = require('path');
const { readJSON, writeJSON, pathExists } = require('./fileSystem');
const { COMMITS_FILE, STAGING_FILE } = require('./constants');
const { readBlobAsString } = require('./hash-engine');

const JOURNAL_FILE = 'journal.json';
const MAX_ENTRIES = 100;

// ─── Persistence ────────────────────────────────────────

async function readJournal(gentPath) {
    const p = path.join(gentPath, JOURNAL_FILE);
    if (!await pathExists(p)) return { entries: [], redo: [] };
    try {
        const j = await readJSON(p);
        return { entries: j.entries || [], redo: j.redo || [] };
    } catch {
        return { entries: [], redo: [] };
    }
}

async function writeJournal(gentPath, journal) {
    await writeJSON(path.join(gentPath, JOURNAL_FILE), journal);
}

// ─── Helpers ────────────────────────────────────────────

function snapshotState(repository) {
    return {
        branches: { ...(repository.branches || {}) },
        currentBranch: repository.currentBranch || 'main'
    };
}

function makeId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

/** Resolve a commit's tree entries (supports legacy `files` shape). */
function treeOf(commits, hash) {
    if (!hash) return [];
    const c = (commits || []).find(x => x.hash === hash);
    if (!c) return [];
    if (Array.isArray(c.tree)) return c.tree;
    return (c.files || []).map(f => ({ mode: '100644', name: f.path || f.name, hash: f.hash, type: 'blob' }));
}

/** Overwrite/create working files from a tree (never deletes). */
async function restoreFiles(gentPath, cwd, tree) {
    for (const e of tree) {
        try {
            const content = await readBlobAsString(gentPath, e.hash);
            const full = path.join(cwd, e.name);
            await fs.mkdir(path.dirname(full), { recursive: true });
            await fs.writeFile(full, content, 'utf-8');
        } catch {
            // Blob may be missing for legacy commits — best effort.
        }
    }
}

async function clearStaging(gentPath) {
    await writeJSON(path.join(gentPath, STAGING_FILE), { entries: [], files: [], mergeState: null });
}

// ─── Public API ─────────────────────────────────────────

/**
 * Record the pre-operation state. Call this BEFORE the command writes
 * commits.json. Journaling must never break the underlying command, so all
 * failures are swallowed.
 * @param {String} gentPath
 * @param {String} op - short op label (commit|merge|reset|checkout|branch-delete|pull)
 * @param {String} description - human-readable detail
 * @param {Object} [meta] - e.g. { restoreTree: true }
 */
async function recordOp(gentPath, op, description, meta = {}) {
    try {
        const repository = await readJSON(path.join(gentPath, COMMITS_FILE));
        const journal = await readJournal(gentPath);
        journal.entries.push({
            id: makeId(),
            op,
            description: description || '',
            timestamp: new Date().toISOString(),
            meta,
            state: snapshotState(repository)
        });
        if (journal.entries.length > MAX_ENTRIES) {
            journal.entries = journal.entries.slice(-MAX_ENTRIES);
        }
        journal.redo = []; // a fresh action invalidates the redo stack
        await writeJournal(gentPath, journal);
    } catch {
        // Never let journaling failures surface to the user.
    }
}

/** Return journal entries, most-recent first. */
async function listEntries(gentPath) {
    const journal = await readJournal(gentPath);
    return [...journal.entries].reverse();
}

/**
 * Restore commits.json pointers + (optionally) working tree to `targetState`.
 * Shared by undo and redo.
 */
async function applyState(gentPath, cwd, repository, commits, targetState, restoreTree) {
    repository.branches = { ...targetState.branches };
    repository.currentBranch = targetState.currentBranch;
    await writeJSON(path.join(gentPath, COMMITS_FILE), repository);

    if (restoreTree) {
        const head = targetState.branches[targetState.currentBranch];
        await restoreFiles(gentPath, cwd, treeOf(commits, head));
    }
    await clearStaging(gentPath);
}

/**
 * Reverse the last recorded operation.
 * @returns {Promise<{ok: Boolean, reason?: String, entry?: Object, head?: String, branch?: String}>}
 */
async function applyUndo(gentPath, cwd) {
    const journal = await readJournal(gentPath);
    if (journal.entries.length === 0) return { ok: false, reason: 'nothing-to-undo' };

    const entry = journal.entries.pop();
    const repository = await readJSON(path.join(gentPath, COMMITS_FILE));
    const commits = repository.commits || [];

    // Remember the post-operation state so `redo` can re-apply it.
    const postState = snapshotState(repository);
    journal.redo.push({ ...entry, state: postState });

    await applyState(gentPath, cwd, repository, commits, entry.state, !!(entry.meta && entry.meta.restoreTree));
    await writeJournal(gentPath, journal);

    return {
        ok: true,
        entry,
        branch: entry.state.currentBranch,
        head: entry.state.branches[entry.state.currentBranch] || null
    };
}

/**
 * Re-apply the last undone operation.
 * @returns {Promise<{ok: Boolean, reason?: String, entry?: Object, head?: String, branch?: String}>}
 */
async function applyRedo(gentPath, cwd) {
    const journal = await readJournal(gentPath);
    if (journal.redo.length === 0) return { ok: false, reason: 'nothing-to-redo' };

    const entry = journal.redo.pop();
    const repository = await readJSON(path.join(gentPath, COMMITS_FILE));
    const commits = repository.commits || [];

    const preState = snapshotState(repository);
    journal.entries.push({ ...entry, state: preState });

    await applyState(gentPath, cwd, repository, commits, entry.state, !!(entry.meta && entry.meta.restoreTree));
    await writeJournal(gentPath, journal);

    return {
        ok: true,
        entry,
        branch: entry.state.currentBranch,
        head: entry.state.branches[entry.state.currentBranch] || null
    };
}

module.exports = {
    recordOp,
    listEntries,
    applyUndo,
    applyRedo,
    readJournal
};
