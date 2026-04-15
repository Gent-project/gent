/**
 * ============================================================================
 * Merge Engine - Three-Way Smart Merge with Auto-Resolution
 * ============================================================================
 *
 * PURPOSE:
 *   Merge two diverged branches using their common ancestor as reference.
 *   Minimizes manual conflict resolution through aggressive auto-resolution.
 *
 * THREE-WAY MERGE ALGORITHM:
 *   Given: BASE (common ancestor), OURS (current branch), THEIRS (incoming)
 *
 *   1. Compute diff: BASE → OURS  (what we changed)
 *   2. Compute diff: BASE → THEIRS (what they changed)
 *   3. Build "change regions" from each diff (contiguous modified areas)
 *   4. Walk base line-by-line, apply resolution rules:
 *
 *   AUTO-RESOLUTION RULES (in priority order):
 *   ┌─────────────────────────────────────────────────────────────────┐
 *   │ Scenario                          │ Result                     │
 *   ├─────────────────────────────────────────────────────────────────┤
 *   │ Only OURS modified region         │ Take OURS                  │
 *   │ Only THEIRS modified region       │ Take THEIRS                │
 *   │ Both modified identically         │ Take either (same)         │
 *   │ Both modified, same-length,       │                            │
 *   │   non-overlapping line changes    │ Line-by-line merge         │
 *   │ Whitespace-only difference        │ Take OURS                  │
 *   │ Modify/delete conflict            │ Keep modified (smart)      │
 *   │ True overlapping conflict         │ Insert conflict markers    │
 *   └─────────────────────────────────────────────────────────────────┘
 *
 * MERGE BASE FINDER:
 *   Walks parent chain from both branch tips.
 *   Collects all ancestors of branch A, then walks B until first hit.
 *   Returns the most recent common ancestor. O(n) where n = total commits.
 *
 * TREE-LEVEL MERGE:
 *   Compares file presence/absence + blob hashes across base/ours/theirs trees.
 *   For each file: decide add/delete/modify/conflict independently.
 *   Only files with different blob hashes on both sides trigger content merge.
 *
 * CONFLICT MARKERS FORMAT:
 *   <<<<<<< ours
 *   [our version of conflicting lines]
 *   =======
 *   [their version of conflicting lines]
 *   >>>>>>> theirs
 *
 * BACKEND EXPECTATIONS:
 *   POST /api/repos/:id/merge/
 *   { sourceBranch, targetBranch, strategy: "three-way" }
 *   Backend can use same algorithm or delegate to client.
 *   Backend should store merge commit with two parents (parent + mergeParent).
 *
 * ============================================================================
 */

const { splitLines } = require('./hash-engine');
const { buildLineOperations } = require('./diff-engine');
const { readBlobAsString, treeToMap, storeBlob } = require('./hash-engine');

// ─── Line-Level 3-Way Merge ─────────────────────────────

/**
 * Three-way merge of line arrays.
 * @param {String[]} baseLines
 * @param {String[]} oursLines
 * @param {String[]} theirsLines
 * @returns {{merged: String[], conflicts: Array, hasConflicts: Boolean}}
 */
function threeWayMerge(baseLines, oursLines, theirsLines) {
    const ourOps = buildLineOperations(baseLines, oursLines);
    const theirOps = buildLineOperations(baseLines, theirsLines);

    const ourRegions = buildChangeRegions(ourOps);
    const theirRegions = buildChangeRegions(theirOps);

    const ourMap = mapRegionsByBase(ourRegions);
    const theirMap = mapRegionsByBase(theirRegions);

    const allStarts = new Set([...ourMap.keys(), ...theirMap.keys()]);
    const merged = [];
    const conflicts = [];
    let baseIdx = 0;

    while (baseIdx <= baseLines.length) {
        if (allStarts.has(baseIdx)) {
            const ourR = ourMap.get(baseIdx);
            const theirR = theirMap.get(baseIdx);

            if (ourR && theirR) {
                const ourText = ourR.newLines.join('\n');
                const theirText = theirR.newLines.join('\n');

                if (ourText === theirText) {
                    merged.push(...ourR.newLines);
                } else {
                    const sub = subMergeRegion(ourR.oldLines, ourR.newLines, theirR.newLines);
                    if (sub.hasConflicts) {
                        conflicts.push({
                            baseLine: baseIdx,
                            baseContent: ourR.oldLines,
                            oursContent: ourR.newLines,
                            theirsContent: theirR.newLines
                        });
                        merged.push('<<<<<<< ours');
                        merged.push(...ourR.newLines);
                        merged.push('=======');
                        merged.push(...theirR.newLines);
                        merged.push('>>>>>>> theirs');
                    } else {
                        merged.push(...sub.lines);
                    }
                }
                const skip = Math.max(ourR.oldLines.length, theirR.oldLines.length);
                baseIdx += skip;
                continue;
            } else if (ourR) {
                merged.push(...ourR.newLines);
                baseIdx += ourR.oldLines.length;
                continue;
            } else if (theirR) {
                merged.push(...theirR.newLines);
                baseIdx += theirR.oldLines.length;
                continue;
            }
        }

        if (baseIdx < baseLines.length) {
            merged.push(baseLines[baseIdx]);
        }
        baseIdx++;
    }

    return { merged, conflicts, hasConflicts: conflicts.length > 0 };
}

// ─── Region Building ────────────────────────────────────

/**
 * Extract contiguous change regions from diff ops, anchored to base line indices.
 * @param {Array} ops
 * @returns {Array<{baseStart, oldLines, newLines}>}
 */
function buildChangeRegions(ops) {
    const regions = [];
    let current = null;
    let baseIdx = 0;

    for (const op of ops) {
        if (op.type === 'equal') {
            if (current) { regions.push(current); current = null; }
            baseIdx++;
        } else if (op.type === 'delete') {
            if (!current) current = { baseStart: baseIdx, oldLines: [], newLines: [] };
            current.oldLines.push(op.content);
            baseIdx++;
        } else if (op.type === 'insert') {
            if (!current) current = { baseStart: baseIdx, oldLines: [], newLines: [] };
            current.newLines.push(op.content);
        }
    }
    if (current) regions.push(current);
    return regions;
}

/**
 * Map regions by baseStart index.
 * @param {Array} regions
 * @returns {Map}
 */
function mapRegionsByBase(regions) {
    const map = new Map();
    for (const r of regions) map.set(r.baseStart, r);
    return map;
}

// ─── Sub-Merge (fine-grained) ───────────────────────────

/**
 * Attempt line-by-line merge within a region.
 * Catches non-overlapping edits inside same region.
 * @param {String[]} baseLines
 * @param {String[]} oursLines
 * @param {String[]} theirsLines
 * @returns {{lines: String[], hasConflicts: Boolean}}
 */
function subMergeRegion(baseLines, oursLines, theirsLines) {
    if (oursLines.length === 0 && theirsLines.length === 0) {
        return { lines: [], hasConflicts: false };
    }

    if (oursLines.length === theirsLines.length) {
        const result = [];
        for (let i = 0; i < oursLines.length; i++) {
            const baseLine = i < baseLines.length ? baseLines[i] : null;
            const ourLine = oursLines[i];
            const theirLine = theirsLines[i];

            if (ourLine === theirLine) { result.push(ourLine); continue; }
            if (ourLine === baseLine) { result.push(theirLine); continue; }
            if (theirLine === baseLine) { result.push(ourLine); continue; }
            // Whitespace-only diff → take ours
            if (ourLine.trim() === theirLine.trim()) { result.push(ourLine); continue; }
            return { lines: [], hasConflicts: true };
        }
        return { lines: result, hasConflicts: false };
    }

    return { lines: [], hasConflicts: true };
}

// ─── File-Level Merge ───────────────────────────────────

/**
 * Merge single file content strings.
 * @param {String} baseContent
 * @param {String} oursContent
 * @param {String} theirsContent
 * @returns {{content: String, hasConflicts: Boolean, conflicts: Array}}
 */
function mergeFileContent(baseContent, oursContent, theirsContent) {
    const base = splitLines(baseContent || '');
    const ours = splitLines(oursContent || '');
    const theirs = splitLines(theirsContent || '');
    const result = threeWayMerge(base, ours, theirs);
    return { content: result.merged.join('\n'), hasConflicts: result.hasConflicts, conflicts: result.conflicts };
}

/**
 * Quick auto-merge with fast-path shortcuts.
 * @param {String} baseText
 * @param {String} oursText
 * @param {String} theirsText
 * @returns {{mergedText: String, hasConflicts: Boolean, conflicts: Array, algorithm: String, confidence: Number}}
 */
function autoMerge(baseText, oursText, theirsText) {
    // Fast paths
    if (oursText === theirsText) return { mergedText: oursText, hasConflicts: false, conflicts: [], algorithm: 'three-way-line-v2', confidence: 1 };
    if (oursText === baseText) return { mergedText: theirsText, hasConflicts: false, conflicts: [], algorithm: 'three-way-line-v2', confidence: 1 };
    if (theirsText === baseText) return { mergedText: oursText, hasConflicts: false, conflicts: [], algorithm: 'three-way-line-v2', confidence: 1 };

    const result = mergeFileContent(baseText, oursText, theirsText);
    const maxLen = Math.max(splitLines(baseText).length, 1);
    const confidence = result.hasConflicts ? Math.max(0, 1 - result.conflicts.length / maxLen) : 1;

    return {
        mergedText: result.content,
        hasConflicts: result.hasConflicts,
        conflicts: result.conflicts,
        algorithm: 'three-way-line-v2',
        confidence
    };
}

// ─── Tree-Level Merge ───────────────────────────────────

/**
 * Merge two tree snapshots against common-base tree.
 * Handles file add/delete/modify across branches.
 * @param {String} gentPath
 * @param {Array} baseEntries
 * @param {Array} oursEntries
 * @param {Array} theirsEntries
 * @returns {Promise<{mergedEntries: Array, conflicts: Array, hasConflicts: Boolean}>}
 */
async function mergeTreeEntries(gentPath, baseEntries, oursEntries, theirsEntries) {
    const baseMap = treeToMap(baseEntries);
    const oursMap = treeToMap(oursEntries);
    const theirsMap = treeToMap(theirsEntries);

    const allFiles = new Set([...baseMap.keys(), ...oursMap.keys(), ...theirsMap.keys()]);
    const mergedEntries = [];
    const conflicts = [];

    for (const filePath of allFiles) {
        const bH = baseMap.get(filePath) || null;
        const oH = oursMap.get(filePath) || null;
        const tH = theirsMap.get(filePath) || null;

        // No change or both identical
        if (oH === tH) {
            if (oH) mergedEntries.push({ mode: '100644', name: filePath, hash: oH, type: 'blob' });
            continue;
        }

        // Only one side changed
        if (oH === bH && tH !== bH) {
            if (tH) mergedEntries.push({ mode: '100644', name: filePath, hash: tH, type: 'blob' });
            continue;
        }
        if (tH === bH && oH !== bH) {
            if (oH) mergedEntries.push({ mode: '100644', name: filePath, hash: oH, type: 'blob' });
            continue;
        }

        // Both changed differently — content merge
        if (oH && tH && bH) {
            const [baseC, oursC, theirsC] = await Promise.all([
                readBlobAsString(gentPath, bH),
                readBlobAsString(gentPath, oH),
                readBlobAsString(gentPath, tH)
            ]);
            const result = mergeFileContent(baseC, oursC, theirsC);
            const mergedHash = await storeBlob(gentPath, result.content);
            mergedEntries.push({ mode: '100644', name: filePath, hash: mergedHash, type: 'blob' });
            if (result.hasConflicts) conflicts.push({ file: filePath, type: 'content', details: result.conflicts });
            continue;
        }

        // Modify/delete conflict — keep modified version (smart default)
        if (!oH && tH && tH !== bH) {
            conflicts.push({ file: filePath, type: 'modify-delete', deletedBy: 'ours', modifiedBy: 'theirs' });
            mergedEntries.push({ mode: '100644', name: filePath, hash: tH, type: 'blob' });
            continue;
        }
        if (!tH && oH && oH !== bH) {
            conflicts.push({ file: filePath, type: 'modify-delete', deletedBy: 'theirs', modifiedBy: 'ours' });
            mergedEntries.push({ mode: '100644', name: filePath, hash: oH, type: 'blob' });
            continue;
        }

        // Both added (no base) with different content
        if (!bH && oH && tH) {
            const [oursC, theirsC] = await Promise.all([
                readBlobAsString(gentPath, oH),
                readBlobAsString(gentPath, tH)
            ]);
            const result = mergeFileContent('', oursC, theirsC);
            const mergedHash = await storeBlob(gentPath, result.content);
            mergedEntries.push({ mode: '100644', name: filePath, hash: mergedHash, type: 'blob' });
            if (result.hasConflicts) conflicts.push({ file: filePath, type: 'add-add', details: result.conflicts });
        }
    }

    return { mergedEntries, conflicts, hasConflicts: conflicts.length > 0 };
}

// ─── Merge Base Finder ──────────────────────────────────

/**
 * Find common ancestor of two branch tips by walking parents.
 * @param {Array} commits
 * @param {String} hashA
 * @param {String} hashB
 * @returns {String|null}
 */
function findMergeBase(commits, hashA, hashB) {
    const commitMap = new Map();
    for (const c of commits) commitMap.set(c.hash, c);

    // Collect all ancestors of A
    const ancestorsA = new Set();
    let cur = hashA;
    while (cur) {
        ancestorsA.add(cur);
        const c = commitMap.get(cur);
        cur = c ? c.parent : null;
    }

    // Walk B ancestors → first hit in A's set = merge base
    cur = hashB;
    while (cur) {
        if (ancestorsA.has(cur)) return cur;
        const c = commitMap.get(cur);
        cur = c ? c.parent : null;
    }
    return null;
}

module.exports = {
    threeWayMerge,
    mergeFileContent,
    autoMerge,
    mergeTreeEntries,
    findMergeBase,
    buildChangeRegions,
    subMergeRegion
};
