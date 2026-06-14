/**
 * Unit tests for the diff engine (LCS line diff + prefix/suffix trimming).
 * Run with:  node --test tests/diff.test.js
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const {
    lcsOperations,
    buildLineOperations,
    summarizeOperations,
    applyOperations,
    formatUnifiedDiff,
    diffText
} = require('../src/utils/diff-engine');

// Reconstruct the OLD side from ops (equal + delete).
function reconstructOld(ops) {
    return ops.filter(o => o.type === 'equal' || o.type === 'delete').map(o => o.content);
}

test('identical inputs produce only equal ops', () => {
    const lines = ['a', 'b', 'c'];
    const ops = buildLineOperations(lines, lines);
    assert.ok(ops.every(o => o.type === 'equal'));
    assert.equal(ops.length, 3);
});

test('reconstructs both sides exactly', () => {
    const a = ['one', 'two', 'three', 'four'];
    const b = ['one', 'TWO', 'three', 'four', 'five'];
    const ops = buildLineOperations(a, b);
    assert.deepEqual(applyOperations(ops), b);   // equal + insert => new
    assert.deepEqual(reconstructOld(ops), a);    // equal + delete => old
});

test('equal-op positions index correctly into both arrays', () => {
    const a = ['x', 'a', 'b', 'y'];
    const b = ['x', 'a', 'B', 'y'];
    const ops = buildLineOperations(a, b);
    for (const op of ops) {
        if (op.type === 'equal') {
            assert.equal(a[op.oldLine - 1], op.content);
            assert.equal(b[op.newLine - 1], op.content);
        }
    }
});

test('prefix/suffix trimming is equivalent to untrimmed LCS', () => {
    // Big identical prefix & suffix, small differing middle.
    const prefix = Array.from({ length: 200 }, (_, i) => `p${i}`);
    const suffix = Array.from({ length: 200 }, (_, i) => `s${i}`);
    const a = [...prefix, 'mid-a1', 'mid-a2', ...suffix];
    const b = [...prefix, 'mid-b1', ...suffix];

    const trimmed = buildLineOperations(a, b);
    const full = lcsOperations(a, b);

    // Same edit distance (LCS length is invariant to trimming).
    assert.deepEqual(summarizeOperations(trimmed), summarizeOperations(full));
    // Same reconstruction of both sides.
    assert.deepEqual(applyOperations(trimmed), b);
    assert.deepEqual(reconstructOld(trimmed), a);
});

test('summarizeOperations counts insertions and deletions', () => {
    const ops = buildLineOperations(['a', 'b'], ['a', 'c', 'd']);
    const stats = summarizeOperations(ops);
    assert.equal(stats.insertions, 2); // c, d
    assert.equal(stats.deletions, 1);  // b
    assert.equal(stats.changes, 3);
});

test('handles empty inputs', () => {
    assert.deepEqual(applyOperations(buildLineOperations([], [])), []);
    assert.deepEqual(applyOperations(buildLineOperations([], ['a', 'b'])), ['a', 'b']);
    assert.deepEqual(reconstructOld(buildLineOperations(['a', 'b'], [])), ['a', 'b']);
});

test('unified diff has a hunk header and +/- lines', () => {
    const out = formatUnifiedDiff('f.txt', 'a\nb\nc\n', 'a\nB\nc\n');
    assert.match(out, /^--- a\/f\.txt/m);
    assert.match(out, /^\+\+\+ b\/f\.txt/m);
    assert.match(out, /^@@ -\d+,\d+ \+\d+,\d+ @@/m);
    assert.match(out, /^-b$/m);
    assert.match(out, /^\+B$/m);
});

test('diffText reports an algorithm tag and stats', () => {
    const d = diffText('a\nb\n', 'a\nb\nc\n');
    assert.equal(d.stats.insertions, 1);
    assert.ok(typeof d.algorithm === 'string');
});
