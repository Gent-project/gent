/**
 * ============================================================================
 * Merge Engine - Three-Way Smart Merge (diff3) with Auto-Resolution
 * ============================================================================
 *
 * PURPOSE:
 *   Merge two diverged branches using their common ancestor as reference.
 *   Minimizes manual conflict resolution through aggressive auto-resolution
 *   while NEVER silently producing an incorrect merge — when in doubt, it
 *   emits conflict markers for a human (or `gent resolve`) to decide.
 *
 * THREE-WAY MERGE ALGORITHM (diff3):
 *   Given: BASE (common ancestor), OURS (current branch), THEIRS (incoming)
 *
 *   1. Match BASE↔OURS and BASE↔THEIRS line-for-line via LCS. A base line is a
 *      "stable anchor" when it survives unchanged in BOTH sides — at an anchor
 *      all three files are synchronized.
 *   2. Walk anchors in order. Between two consecutive anchors lies one
 *      "unstable region": baseSeg / oursSeg / theirsSeg (each possibly empty).
 *   3. Classify each region with the rules below, then emit the anchor line.
 *
 *   AUTO-RESOLUTION RULES (per unstable region):
 *   ┌────────────────────────────────────────────┬──────────────────────────┐
 *   │ Scenario                                    │ Result                   │
 *   ├────────────────────────────────────────────┼──────────────────────────┤
 *   │ Neither side changed the region             │ Keep base                │
 *   │ Only OURS changed                           │ Take OURS                │
 *   │ Only THEIRS changed                         │ Take THEIRS              │
 *   │ Both changed identically                    │ Take either              │
 *   │ Both changed, same length, disjoint lines   │ Line-by-line sub-merge   │
 *   │ Whitespace-only difference                  │ Take OURS                │
 *   │ True overlapping conflict                   │ Insert conflict markers  │
 *   └────────────────────────────────────────────┴──────────────────────────┘
 *
 *   Why diff3 (vs. the previous region-walk): anchoring whole unstable regions
 *   between synchronized lines correctly handles one-sided pure insertions
 *   (zero base lines consumed) and overlapping edits on both sides — the two
 *   cases that crashed / dropped data before.
 *
 * MERGE BASE FINDER (DAG-aware):
 *   Walks BOTH `parent` and `mergeParent` edges so the lowest common ancestor
 *   is found correctly even after merge commits exist. BFS from one tip,
 *   nearest-first, returns the first ancestor shared with the other tip.
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

// ─── Helpers ────────────────────────────────────────────

/**
 * Shallow array equality (line arrays).
 * @param {String[]} a
 * @param {String[]} b
 * @returns {Boolean}
 */
function linesEqual(a, b) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) return false;
    }
    return true;
}

// Matches dependency/import declarations across common languages:
// JS/TS import/require, Python import/from, Go/Rust/C# use/using, C #include.
const IMPORT_LINE = /^\s*(import\s|from\s.+\simport\s|(const|let|var)\s+.+=\s*require\(|require\(|#include\s|using\s|use\s|@import\s)/;

/** True when a region is non-empty and every non-blank line is an import/require. */
function isImportRegion(lines) {
    const nonBlank = lines.filter(l => l.trim() !== '');
    if (nonBlank.length === 0) return false;
    return nonBlank.every(l => IMPORT_LINE.test(l));
}

/** Union of two line lists: all of `a`, then lines of `b` not already present. */
function unionLines(a, b) {
    const seen = new Set(a);
    const out = [...a];
    for (const line of b) {
        if (!seen.has(line)) { out.push(line); seen.add(line); }
    }
    return out;
}

/**
 * Map each base line index to the matching line index in `other` (via LCS),
 * or -1 when that base line does not survive unchanged in `other`.
 * @param {String[]} baseLines
 * @param {String[]} otherLines
 * @returns {Int32Array} length === baseLines.length
 */
function matchBaseToOther(baseLines, otherLines) {
    const map = new Int32Array(baseLines.length).fill(-1);
    const ops = buildLineOperations(baseLines, otherLines);
    for (const op of ops) {
        if (op.type === 'equal') {
            // op.oldLine / op.newLine are 1-based positions
            map[op.oldLine - 1] = op.newLine - 1;
        }
    }
    return map;
}

// ─── Line-Level 3-Way Merge (diff3) ─────────────────────

/**
 * Three-way merge of line arrays using the diff3 algorithm.
 * @param {String[]} baseLines
 * @param {String[]} oursLines
 * @param {String[]} theirsLines
 * @returns {{merged: String[], conflicts: Array, hasConflicts: Boolean}}
 */
function threeWayMerge(baseLines, oursLines, theirsLines) {
    const oMatch = matchBaseToOther(baseLines, oursLines);
    const tMatch = matchBaseToOther(baseLines, theirsLines);

    // Stable anchors: base lines present unchanged in BOTH sides.
    // oMatch/tMatch are individually monotonic (LCS), so the shared subset is
    // simultaneously monotonic in base/ours/theirs indices.
    const anchors = [];
    for (let bi = 0; bi < baseLines.length; bi++) {
        if (oMatch[bi] !== -1 && tMatch[bi] !== -1) {
            anchors.push({ b: bi, o: oMatch[bi], t: tMatch[bi] });
        }
    }
    // Sentinel anchor at the end so the trailing region is processed.
    anchors.push({ b: baseLines.length, o: oursLines.length, t: theirsLines.length });

    const merged = [];
    const conflicts = [];
    let prevB = 0, prevO = 0, prevT = 0;

    for (const a of anchors) {
        const baseSeg = baseLines.slice(prevB, a.b);
        const oursSeg = oursLines.slice(prevO, a.o);
        const theirsSeg = theirsLines.slice(prevT, a.t);

        resolveRegion(baseSeg, oursSeg, theirsSeg, merged, conflicts);

        // Emit the synchronized anchor line (skip the end sentinel).
        if (a.b < baseLines.length) {
            merged.push(baseLines[a.b]);
        }

        prevB = a.b + 1;
        prevO = a.o + 1;
        prevT = a.t + 1;
    }

    return { merged, conflicts, hasConflicts: conflicts.length > 0 };
}

/**
 * Classify and resolve a single unstable region, appending to `merged`
 * (and `conflicts` when unresolved).
 * @param {String[]} baseSeg
 * @param {String[]} oursSeg
 * @param {String[]} theirsSeg
 * @param {String[]} merged - output accumulator (mutated)
 * @param {Array} conflicts - output accumulator (mutated)
 */
function resolveRegion(baseSeg, oursSeg, theirsSeg, merged, conflicts) {
    if (baseSeg.length === 0 && oursSeg.length === 0 && theirsSeg.length === 0) {
        return;
    }

    const oursChanged = !linesEqual(baseSeg, oursSeg);
    const theirsChanged = !linesEqual(baseSeg, theirsSeg);

    if (!oursChanged && !theirsChanged) { merged.push(...baseSeg); return; }
    if (!oursChanged) { merged.push(...theirsSeg); return; }       // only theirs changed
    if (!theirsChanged) { merged.push(...oursSeg); return; }       // only ours changed
    if (linesEqual(oursSeg, theirsSeg)) { merged.push(...oursSeg); return; } // same change

    // Language-aware rule: when both sides ADD import/require lines at the same
    // spot (no base lines involved), union them instead of conflicting. This is
    // the classic "both branches added an import" false conflict, and unioning
    // additions is safe. Anything with base content falls through to a conflict.
    if (baseSeg.length === 0 && isImportRegion(oursSeg) && isImportRegion(theirsSeg)) {
        merged.push(...unionLines(oursSeg, theirsSeg));
        return;
    }

    // Both changed differently — attempt fine-grained line-by-line merge.
    const sub = subMergeRegion(baseSeg, oursSeg, theirsSeg);
    if (!sub.hasConflicts) { merged.push(...sub.lines); return; }

    // Unresolved — emit conflict markers.
    conflicts.push({
        baseContent: baseSeg,
        oursContent: oursSeg,
        theirsContent: theirsSeg
    });
    merged.push('<<<<<<< ours');
    merged.push(...oursSeg);
    merged.push('=======');
    merged.push(...theirsSeg);
    merged.push('>>>>>>> theirs');
}

// ─── Sub-Merge (fine-grained) ───────────────────────────

/**
 * Attempt line-by-line merge within a region where both sides changed.
 * Catches non-overlapping edits inside the same region.
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

// ─── JSON-Aware Merge ───────────────────────────────────

function isPlainObject(v) {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Structural deep equality (objects, arrays, primitives). */
function deepEqual(a, b) {
    if (a === b) return true;
    if (typeof a !== typeof b) return false;
    if (Array.isArray(a) || Array.isArray(b)) {
        if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
        return a.every((x, i) => deepEqual(x, b[i]));
    }
    if (isPlainObject(a) && isPlainObject(b)) {
        const ka = Object.keys(a), kb = Object.keys(b);
        if (ka.length !== kb.length) return false;
        return ka.every(k => Object.prototype.hasOwnProperty.call(b, k) && deepEqual(a[k], b[k]));
    }
    return false;
}

/** Decide the merged value for a single key across base/ours/theirs. */
function decideJsonKey(base, ours, theirs, key) {
    const hasB = Object.prototype.hasOwnProperty.call(base, key);
    const hasO = Object.prototype.hasOwnProperty.call(ours, key);
    const hasT = Object.prototype.hasOwnProperty.call(theirs, key);
    const bv = base[key], ov = ours[key], tv = theirs[key];

    const oChanged = hasO !== hasB || !deepEqual(ov, bv);
    const tChanged = hasT !== hasB || !deepEqual(tv, bv);

    if (!oChanged && !tChanged) return hasB ? { action: 'set', value: bv } : { action: 'delete' };
    if (!oChanged) return hasT ? { action: 'set', value: tv } : { action: 'delete' }; // only theirs
    if (!tChanged) return hasO ? { action: 'set', value: ov } : { action: 'delete' }; // only ours
    if (hasO && hasT && deepEqual(ov, tv)) return { action: 'set', value: ov };        // same change
    if (hasO && hasT && isPlainObject(ov) && isPlainObject(tv)) {                      // recurse
        const sub = mergeJsonObjects(isPlainObject(bv) ? bv : {}, ov, tv);
        return sub.hasConflicts ? { action: 'conflict' } : { action: 'set', value: sub.merged };
    }
    return { action: 'conflict' };
}

/** Key-level 3-way merge of two objects. Returns merged object + conflict flag. */
function mergeJsonObjects(base, ours, theirs) {
    const keys = [];
    const seen = new Set();
    for (const k of [...Object.keys(ours), ...Object.keys(theirs), ...Object.keys(base)]) {
        if (!seen.has(k)) { keys.push(k); seen.add(k); }
    }

    const merged = {};
    let hasConflicts = false;
    for (const k of keys) {
        const d = decideJsonKey(base, ours, theirs, k);
        if (d.action === 'set') merged[k] = d.value;
        else if (d.action === 'conflict') hasConflicts = true;
        // 'delete' → omit
    }
    return { merged, hasConflicts };
}

/**
 * Attempt a JSON-aware merge. Returns a clean result only when the structures
 * parse as objects AND every key auto-resolves; otherwise returns null so the
 * caller can fall back to line-based merge (which can emit conflict markers).
 * @returns {{content: String, hasConflicts: Boolean, conflicts: Array}|null}
 */
function mergeJsonContent(baseContent, oursContent, theirsContent) {
    let base, ours, theirs;
    try {
        base = baseContent && baseContent.trim() ? JSON.parse(baseContent) : {};
        ours = JSON.parse(oursContent);
        theirs = JSON.parse(theirsContent);
    } catch {
        return null; // not valid JSON → fall back
    }
    if (!isPlainObject(base) || !isPlainObject(ours) || !isPlainObject(theirs)) {
        return null; // non-object roots (e.g. arrays) → fall back
    }

    const { merged, hasConflicts } = mergeJsonObjects(base, ours, theirs);
    if (hasConflicts) return null; // let the line merge surface markers
    return { content: JSON.stringify(merged, null, 2) + '\n', hasConflicts: false, conflicts: [] };
}

// ─── Conflict Marker Parsing ────────────────────────────

/** True if the text contains a conflict start marker. */
function hasConflictMarkers(content) {
    return /^<<<<<<</m.test(content || '');
}

/**
 * Parse conflict-marked text into ordered segments.
 * @param {String} content
 * @returns {Array<{type:'text', lines:String[]} | {type:'conflict', ours:String[], theirs:String[]}>}
 */
function parseConflictMarkers(content) {
    const lines = (content || '').split('\n');
    const segments = [];
    let textBuf = [];
    const flush = () => { if (textBuf.length) { segments.push({ type: 'text', lines: textBuf }); textBuf = []; } };

    let i = 0;
    while (i < lines.length) {
        if (lines[i].startsWith('<<<<<<<')) {
            flush();
            i++;
            const ours = [];
            while (i < lines.length && !lines[i].startsWith('=======')) ours.push(lines[i++]);
            i++; // skip '======='
            const theirs = [];
            while (i < lines.length && !lines[i].startsWith('>>>>>>>')) theirs.push(lines[i++]);
            i++; // skip '>>>>>>>'
            segments.push({ type: 'conflict', ours, theirs });
        } else {
            textBuf.push(lines[i++]);
        }
    }
    flush();
    return segments;
}

// ─── File-Level Merge ───────────────────────────────────

/**
 * Merge single file content strings. When `fileName` indicates a structured
 * format (currently .json) a language-aware strategy is tried first; it falls
 * back to the line-based diff3 merge if the structured merge cannot fully and
 * safely resolve the change.
 * @param {String} baseContent
 * @param {String} oursContent
 * @param {String} theirsContent
 * @param {String} [fileName] - used to pick a language-aware strategy
 * @returns {{content: String, hasConflicts: Boolean, conflicts: Array}}
 */
function mergeFileContent(baseContent, oursContent, theirsContent, fileName) {
    if (fileName && /\.json$/i.test(fileName)) {
        const jsonResult = mergeJsonContent(baseContent || '', oursContent || '', theirsContent || '');
        if (jsonResult) return jsonResult;
    }

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
    if (oursText === theirsText) return { mergedText: oursText, hasConflicts: false, conflicts: [], algorithm: 'diff3-line-v3', confidence: 1 };
    if (oursText === baseText) return { mergedText: theirsText, hasConflicts: false, conflicts: [], algorithm: 'diff3-line-v3', confidence: 1 };
    if (theirsText === baseText) return { mergedText: oursText, hasConflicts: false, conflicts: [], algorithm: 'diff3-line-v3', confidence: 1 };

    const result = mergeFileContent(baseText, oursText, theirsText);
    const maxLen = Math.max(splitLines(baseText).length, 1);
    const confidence = result.hasConflicts ? Math.max(0, 1 - result.conflicts.length / maxLen) : 1;

    return {
        mergedText: result.content,
        hasConflicts: result.hasConflicts,
        conflicts: result.conflicts,
        algorithm: 'diff3-line-v3',
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
            const result = mergeFileContent(baseC, oursC, theirsC, filePath);
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
            const result = mergeFileContent('', oursC, theirsC, filePath);
            const mergedHash = await storeBlob(gentPath, result.content);
            mergedEntries.push({ mode: '100644', name: filePath, hash: mergedHash, type: 'blob' });
            if (result.hasConflicts) conflicts.push({ file: filePath, type: 'add-add', details: result.conflicts });
        }
    }

    return { mergedEntries, conflicts, hasConflicts: conflicts.length > 0 };
}

// ─── Merge Base Finder (DAG-aware) ──────────────────────

/**
 * Find the lowest common ancestor of two commits by walking BOTH `parent` and
 * `mergeParent` edges. Correct even after merge commits exist.
 * @param {Array} commits - all commit objects
 * @param {String} hashA
 * @param {String} hashB
 * @returns {String|null}
 */
function findMergeBase(commits, hashA, hashB) {
    const commitMap = new Map();
    for (const c of commits) commitMap.set(c.hash, c);

    const parentsOf = (hash) => {
        const c = commitMap.get(hash);
        if (!c) return [];
        const out = [];
        if (c.parent) out.push(c.parent);
        if (c.mergeParent) out.push(c.mergeParent);
        return out;
    };

    // Collect every ancestor of A (including A) across both edges.
    const ancestorsA = new Set();
    const stack = [hashA];
    while (stack.length) {
        const cur = stack.pop();
        if (!cur || ancestorsA.has(cur)) continue;
        ancestorsA.add(cur);
        for (const p of parentsOf(cur)) stack.push(p);
    }

    // BFS from B (nearest-first) → first node also in A's ancestor set is the
    // most-recent common ancestor.
    const seen = new Set();
    const queue = [hashB];
    while (queue.length) {
        const cur = queue.shift();
        if (!cur || seen.has(cur)) continue;
        seen.add(cur);
        if (ancestorsA.has(cur)) return cur;
        for (const p of parentsOf(cur)) queue.push(p);
    }
    return null;
}

module.exports = {
    threeWayMerge,
    mergeFileContent,
    mergeJsonContent,
    mergeJsonObjects,
    autoMerge,
    mergeTreeEntries,
    findMergeBase,
    subMergeRegion,
    resolveRegion,
    isImportRegion,
    unionLines,
    linesEqual,
    hasConflictMarkers,
    parseConflictMarkers
};
