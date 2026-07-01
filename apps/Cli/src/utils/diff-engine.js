/**
 * ============================================================================
 * Diff Engine - Line-level LCS diff with hunk generation and unified format
 * ============================================================================
 *
 * PURPOSE:
 *   Compute minimal edit scripts between two text files, classify each line
 *   as insert / delete / equal, generate unified diff output.
 *
 * ALGORITHM: Longest Common Subsequence (LCS)
 *   - Build M×N dynamic programming matrix where M,N = line counts
 *   - dp[i][j] = length of LCS of first i lines of A and first j lines of B
 *   - Recurrence:
 *       if A[i] == B[j]:  dp[i][j] = dp[i-1][j-1] + 1
 *       else:             dp[i][j] = max(dp[i-1][j], dp[i][j-1])
 *   - Backtrack from dp[M][N] to produce edit operations
 *   - Time: O(M*N), Space: O(M*N) — uses Uint32Array for memory efficiency
 *
 * INSERTION/DELETION CLASSIFICATION:
 *   During backtrack:
 *   - A[i]==B[j] → EQUAL (line unchanged)
 *   - Move up (i-1) → DELETE (line only in old version)
 *   - Move left (j-1) → INSERT (line only in new version)
 *
 * COMMON PREFIX/SUFFIX TRIMMING (optimization):
 *   Before building the O(M×N) matrix, identical leading and trailing lines are
 *   stripped. Only the differing "middle" is run through LCS; the trimmed lines
 *   are re-attached as `equal` ops with their original 1-based positions. For
 *   the common case of a localized edit in a large file this turns an O(M×N)
 *   matrix into something proportional to the size of the change — a large
 *   memory and time win — while producing byte-identical output.
 *
 * HUNK GENERATION:
 *   Groups adjacent changes with N context lines (default 3) into hunks.
 *   Changes within 2*N+1 lines of each other merge into one hunk.
 *   Output format matches unified diff:
 *     @@ -oldStart,oldCount +newStart,newCount @@
 *
 * BACKEND EXPECTATIONS:
 *   Diffs are computed locally. Backend does NOT need diff support.
 *   Backend stores blob objects; clients compute diffs on demand.
 *
 * ============================================================================
 */

const { splitLines } = require('./hash-engine');

// ─── Core LCS / Diff ────────────────────────────────────

/**
 * Build LCS length matrix.
 * @param {String[]} a
 * @param {String[]} b
 * @returns {Array<Uint32Array>}
 */
function buildLcsMatrix(a, b) {
    const rows = a.length + 1;
    const cols = b.length + 1;
    const matrix = Array.from({ length: rows }, () => new Uint32Array(cols));

    for (let i = 1; i < rows; i++) {
        for (let j = 1; j < cols; j++) {
            if (a[i - 1] === b[j - 1]) {
                matrix[i][j] = matrix[i - 1][j - 1] + 1;
            } else {
                matrix[i][j] = Math.max(matrix[i - 1][j], matrix[i][j - 1]);
            }
        }
    }
    return matrix;
}

/**
 * Backtrack the LCS matrix of two line arrays → line operations with
 * 1-based positions local to the given arrays. Pure O(M×N) core; callers
 * normally use buildLineOperations, which trims common prefix/suffix first.
 * @param {String[]} oldLines
 * @param {String[]} newLines
 * @returns {Array<{type: 'equal'|'insert'|'delete', oldLine: number, newLine: number, content: String}>}
 */
function lcsOperations(oldLines, newLines) {
    const matrix = buildLcsMatrix(oldLines, newLines);
    const ops = [];
    let i = oldLines.length;
    let j = newLines.length;

    while (i > 0 || j > 0) {
        if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
            ops.push({ type: 'equal', oldLine: i, newLine: j, content: oldLines[i - 1] });
            i--; j--;
        } else if (j > 0 && (i === 0 || matrix[i][j - 1] >= matrix[i - 1][j])) {
            ops.push({ type: 'insert', oldLine: i, newLine: j, content: newLines[j - 1] });
            j--;
        } else {
            ops.push({ type: 'delete', oldLine: i, newLine: j, content: oldLines[i - 1] });
            i--;
        }
    }

    return ops.reverse();
}

/**
 * Diff two line arrays into operations, trimming common prefix/suffix before
 * running LCS on the differing middle. Output is identical to running LCS on
 * the full arrays, with `oldLine`/`newLine` as absolute 1-based positions.
 * @param {String[]} oldLines
 * @param {String[]} newLines
 * @returns {Array<{type: 'equal'|'insert'|'delete', oldLine: number, newLine: number, content: String}>}
 */
function buildLineOperations(oldLines, newLines) {
    const oldLen = oldLines.length;
    const newLen = newLines.length;
    const minLen = Math.min(oldLen, newLen);

    // Common leading lines.
    let prefix = 0;
    while (prefix < minLen && oldLines[prefix] === newLines[prefix]) prefix++;

    // Common trailing lines (not overlapping the prefix).
    let suffix = 0;
    while (
        suffix < minLen - prefix &&
        oldLines[oldLen - 1 - suffix] === newLines[newLen - 1 - suffix]
    ) suffix++;

    const ops = [];

    // Prefix → equal ops at their original positions.
    for (let k = 0; k < prefix; k++) {
        ops.push({ type: 'equal', oldLine: k + 1, newLine: k + 1, content: oldLines[k] });
    }

    // Middle → LCS, shifted back into absolute coordinates by `prefix`.
    const oldMid = oldLines.slice(prefix, oldLen - suffix);
    const newMid = newLines.slice(prefix, newLen - suffix);
    if (oldMid.length || newMid.length) {
        for (const op of lcsOperations(oldMid, newMid)) {
            ops.push({
                type: op.type,
                oldLine: op.oldLine + prefix,
                newLine: op.newLine + prefix,
                content: op.content
            });
        }
    }

    // Suffix → equal ops at their original positions.
    for (let k = 0; k < suffix; k++) {
        const oldIdx = oldLen - suffix + k;
        const newIdx = newLen - suffix + k;
        ops.push({ type: 'equal', oldLine: oldIdx + 1, newLine: newIdx + 1, content: oldLines[oldIdx] });
    }

    return ops;
}

/**
 * Diff two texts → operations + stats.
 * @param {String} oldText
 * @param {String} newText
 * @returns {{ algorithm: string, operations: Array, stats: Object }}
 */
function diffText(oldText, newText) {
    const oldLines = splitLines(oldText);
    const newLines = splitLines(newText);
    const operations = buildLineOperations(oldLines, newLines);
    const stats = summarizeOperations(operations);
    return { algorithm: 'lcs-line-v1', operations, stats };
}

/**
 * Count insert/delete/equal ops.
 * @param {Array} operations
 * @returns {{insertions, deletions, unchanged, changes}}
 */
function summarizeOperations(operations) {
    let insertions = 0, deletions = 0, unchanged = 0;
    for (const op of operations) {
        if (op.type === 'insert') insertions++;
        else if (op.type === 'delete') deletions++;
        else unchanged++;
    }
    return { insertions, deletions, unchanged, changes: insertions + deletions };
}

// ─── Hunk Generation ────────────────────────────────────

/**
 * Group diff ops into hunks with context lines (like git diff).
 * @param {Array} ops - From buildLineOperations
 * @param {Number} contextLines - Context around changes (default 3)
 * @returns {Array<{oldStart, oldCount, newStart, newCount, lines: String[]}>}
 */
function generateHunks(ops, contextLines = 3) {
    const changeIndices = [];
    for (let i = 0; i < ops.length; i++) {
        if (ops[i].type !== 'equal') changeIndices.push(i);
    }
    if (changeIndices.length === 0) return [];

    // Group changes within contextLines*2 of each other
    const groups = [];
    let group = [changeIndices[0]];
    for (let i = 1; i < changeIndices.length; i++) {
        if (changeIndices[i] - changeIndices[i - 1] <= contextLines * 2 + 1) {
            group.push(changeIndices[i]);
        } else {
            groups.push(group);
            group = [changeIndices[i]];
        }
    }
    groups.push(group);

    const hunks = [];
    for (const g of groups) {
        const first = g[0];
        const last = g[g.length - 1];
        const start = Math.max(0, first - contextLines);
        const end = Math.min(ops.length - 1, last + contextLines);

        let oldLine = 0, newLine = 0;
        for (let i = 0; i < start; i++) {
            if (ops[i].type === 'equal' || ops[i].type === 'delete') oldLine++;
            if (ops[i].type === 'equal' || ops[i].type === 'insert') newLine++;
        }

        const hunkOldStart = oldLine + 1;
        const hunkNewStart = newLine + 1;
        let hunkOldCount = 0, hunkNewCount = 0;
        const lines = [];

        for (let i = start; i <= end; i++) {
            const op = ops[i];
            if (op.type === 'equal') {
                lines.push(` ${op.content}`);
                hunkOldCount++; hunkNewCount++;
            } else if (op.type === 'delete') {
                lines.push(`-${op.content}`);
                hunkOldCount++;
            } else {
                lines.push(`+${op.content}`);
                hunkNewCount++;
            }
        }

        hunks.push({ oldStart: hunkOldStart, oldCount: hunkOldCount, newStart: hunkNewStart, newCount: hunkNewCount, lines });
    }
    return hunks;
}

// ─── Unified Diff Format ────────────────────────────────

/**
 * Format as unified diff string (like `git diff`).
 * @param {String} filePath
 * @param {String} oldText
 * @param {String} newText
 * @returns {String}
 */
function formatUnifiedDiff(filePath, oldText, newText) {
    const oldLines = splitLines(oldText);
    const newLines = splitLines(newText);
    const ops = buildLineOperations(oldLines, newLines);
    const hunks = generateHunks(ops);
    if (hunks.length === 0) return '';

    const out = [`--- a/${filePath}`, `+++ b/${filePath}`];
    for (const h of hunks) {
        out.push(`@@ -${h.oldStart},${h.oldCount} +${h.newStart},${h.newCount} @@`);
        out.push(...h.lines);
    }
    return out.join('\n');
}

// ─── Patch Application ──────────────────────────────────

/**
 * Apply operations to reconstruct target from source.
 * @param {Array} ops
 * @returns {String[]} Reconstructed lines
 */
function applyOperations(ops) {
    const result = [];
    for (const op of ops) {
        if (op.type === 'equal' || op.type === 'insert') {
            result.push(op.content);
        }
    }
    return result;
}

module.exports = {
    diffText,
    summarizeOperations,
    buildLcsMatrix,
    lcsOperations,
    buildLineOperations,
    generateHunks,
    formatUnifiedDiff,
    applyOperations
};
