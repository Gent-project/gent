/**
 * Unit tests for the diff3 three-way merge engine.
 * Run with:  node --test tests/merge.test.js
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const {
    threeWayMerge,
    mergeFileContent,
    mergeJsonContent,
    autoMerge,
    isImportRegion,
    unionLines,
    hasConflictMarkers,
    parseConflictMarkers
} = require('../src/utils/merge-engine');

test('REGRESSION: one-sided insertion + disjoint change does not crash', () => {
    // Previously caused an infinite loop -> RangeError: Invalid array length.
    const r = threeWayMerge(['a', 'b', 'c'], ['a', 'X', 'b', 'c'], ['a', 'b', 'C']);
    assert.deepEqual(r.merged, ['a', 'X', 'b', 'C']);
    assert.equal(r.hasConflicts, false);
});

test('takes the only side that changed', () => {
    assert.deepEqual(
        threeWayMerge(['a', 'b', 'c'], ['a', 'B', 'c'], ['a', 'b', 'c']).merged,
        ['a', 'B', 'c']
    );
    assert.deepEqual(
        threeWayMerge(['a', 'b', 'c'], ['a', 'b', 'c'], ['a', 'b', 'C']).merged,
        ['a', 'b', 'C']
    );
});

test('both sides delete different lines', () => {
    const r = threeWayMerge(['a', 'b', 'c', 'd'], ['b', 'c', 'd'], ['a', 'b', 'c']);
    assert.deepEqual(r.merged, ['b', 'c']);
    assert.equal(r.hasConflicts, false);
});

test('identical change on both sides auto-resolves', () => {
    const r = threeWayMerge(['a', 'b'], ['a', 'X', 'b'], ['a', 'X', 'b']);
    assert.deepEqual(r.merged, ['a', 'X', 'b']);
    assert.equal(r.hasConflicts, false);
});

test('different insertions at the same point conflict', () => {
    const r = threeWayMerge(['a', 'b'], ['a', 'X', 'b'], ['a', 'Y', 'b']);
    assert.equal(r.hasConflicts, true);
    assert.ok(r.merged.includes('<<<<<<< ours'));
    assert.ok(r.merged.includes('======='));
    assert.ok(r.merged.includes('>>>>>>> theirs'));
});

test('overlapping edits to the same line conflict', () => {
    const r = threeWayMerge(['a', 'b', 'c'], ['a', 'BO', 'c'], ['a', 'BT', 'c']);
    assert.equal(r.hasConflicts, true);
});

test('whitespace-only difference favours ours', () => {
    const r = threeWayMerge(['x'], ['  y'], ['y']);
    assert.deepEqual(r.merged, ['  y']);
    assert.equal(r.hasConflicts, false);
});

test('empty base with identical add/add', () => {
    const r = threeWayMerge([], ['x', 'y'], ['x', 'y']);
    assert.deepEqual(r.merged, ['x', 'y']);
    assert.equal(r.hasConflicts, false);
});

test('trailing insertions on both sides (identical)', () => {
    const r = threeWayMerge(['a'], ['a', 'b'], ['a', 'b']);
    assert.deepEqual(r.merged, ['a', 'b']);
});

test('mergeFileContent joins lines and reports conflicts', () => {
    const clean = mergeFileContent('a\nb\nc\n', 'a\nX\nb\nc\n', 'a\nb\nC\n');
    assert.equal(clean.content, 'a\nX\nb\nC\n');
    assert.equal(clean.hasConflicts, false);

    const conflicted = mergeFileContent('a\n', 'b\n', 'c\n');
    assert.equal(conflicted.hasConflicts, true);
});

test('autoMerge fast paths and confidence', () => {
    assert.equal(autoMerge('x', 'x', 'x').confidence, 1);          // nothing changed
    assert.equal(autoMerge('x', 'y', 'x').mergedText, 'y');        // only ours
    assert.equal(autoMerge('x', 'x', 'z').mergedText, 'z');        // only theirs
    const conf = autoMerge('a\nb\n', 'A\nb\n', 'X\nb\n');
    assert.equal(conf.hasConflicts, true);
    assert.ok(conf.confidence >= 0 && conf.confidence <= 1);
});

test('large disjoint edits stay fast and correct', () => {
    const base = Array.from({ length: 5000 }, (_, i) => `line ${i}`);
    const ours = base.slice(); ours[10] = 'OURS';
    const theirs = base.slice(); theirs[4990] = 'THEIRS';
    const r = threeWayMerge(base, ours, theirs);
    assert.equal(r.hasConflicts, false);
    assert.equal(r.merged[10], 'OURS');
    assert.equal(r.merged[4990], 'THEIRS');
    assert.equal(r.merged.length, base.length);
});

// ── Language-aware merge ───────────────────────────────────────────────────

test('both sides add different imports → union, not conflict', () => {
    const base = "import a from 'a';\nconst x = 1;\n";
    const ours = "import a from 'a';\nimport b from 'b';\nconst x = 1;\n";
    const theirs = "import a from 'a';\nimport c from 'c';\nconst x = 1;\n";
    const r = mergeFileContent(base, ours, theirs, 'index.js');
    assert.equal(r.hasConflicts, false);
    assert.match(r.content, /import b from 'b';/);
    assert.match(r.content, /import c from 'c';/);
});

test('isImportRegion / unionLines helpers', () => {
    assert.equal(isImportRegion(["import x from 'x'"]), true);
    assert.equal(isImportRegion(["const y = require('y')"]), true);
    assert.equal(isImportRegion(['just code();']), false);
    assert.equal(isImportRegion([]), false);
    assert.deepEqual(unionLines(['a', 'b'], ['b', 'c']), ['a', 'b', 'c']);
});

test('JSON merge: disjoint key changes auto-resolve', () => {
    const base = JSON.stringify({ name: 'p', version: '1.0.0', deps: { a: '1' } });
    const ours = JSON.stringify({ name: 'p', version: '1.1.0', deps: { a: '1' } });
    const theirs = JSON.stringify({ name: 'p', version: '1.0.0', deps: { a: '1', b: '2' } });
    const r = mergeFileContent(base, ours, theirs, 'package.json');
    assert.equal(r.hasConflicts, false);
    const obj = JSON.parse(r.content);
    assert.equal(obj.version, '1.1.0');
    assert.deepEqual(obj.deps, { a: '1', b: '2' });
});

test('JSON merge: same key changed differently falls back to markers', () => {
    const base = JSON.stringify({ version: '1.0.0' });
    const ours = JSON.stringify({ version: '2.0.0' });
    const theirs = JSON.stringify({ version: '3.0.0' });
    const r = mergeFileContent(base, ours, theirs, 'package.json');
    assert.equal(r.hasConflicts, true);
    assert.match(r.content, /<<<<<<< ours/);
});

test('mergeJsonContent returns null for non-object roots', () => {
    assert.equal(mergeJsonContent('[]', '[1]', '[2]'), null);
    assert.equal(mergeJsonContent('not json', '{}', '{}'), null);
});

// ── Conflict marker parsing (used by `gent resolve`) ───────────────────────

test('hasConflictMarkers detects a conflict', () => {
    assert.equal(hasConflictMarkers('a\n<<<<<<< ours\nb\n=======\nc\n>>>>>>> theirs\n'), true);
    assert.equal(hasConflictMarkers('a\nb\nc\n'), false);
});

test('parseConflictMarkers splits text and conflict hunks', () => {
    const content = [
        'line1',
        '<<<<<<< ours',
        'our line',
        '=======',
        'their line',
        '>>>>>>> theirs',
        'line2'
    ].join('\n');
    const segs = parseConflictMarkers(content);
    assert.equal(segs.length, 3);
    assert.deepEqual(segs[0], { type: 'text', lines: ['line1'] });
    assert.deepEqual(segs[1], { type: 'conflict', ours: ['our line'], theirs: ['their line'] });
    assert.deepEqual(segs[2], { type: 'text', lines: ['line2'] });

    // Reassembling a "take ours" resolution drops the markers.
    const resolved = segs.flatMap(s => s.type === 'text' ? s.lines : s.ours).join('\n');
    assert.equal(hasConflictMarkers(resolved), false);
    assert.equal(resolved, 'line1\nour line\nline2');
});
