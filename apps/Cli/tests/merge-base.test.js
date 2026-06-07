/**
 * Unit tests for the DAG-aware merge-base finder.
 * Run with:  node --test tests/merge-base.test.js
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const { findMergeBase } = require('../src/utils/merge-engine');

// Linear history: A <- B <- C <- D
const linear = [
    { hash: 'A', parent: null },
    { hash: 'B', parent: 'A' },
    { hash: 'C', parent: 'B' },
    { hash: 'D', parent: 'C' }
];

test('linear: ancestor of a node is itself', () => {
    assert.equal(findMergeBase(linear, 'C', 'C'), 'C');
});

test('linear: base of two points is the older one', () => {
    assert.equal(findMergeBase(linear, 'D', 'B'), 'B');
});

// Branched: A <- B, then C (from B) and D (from B)
const branched = [
    { hash: 'A', parent: null },
    { hash: 'B', parent: 'A' },
    { hash: 'C', parent: 'B' },
    { hash: 'D', parent: 'B' }
];

test('branched: common ancestor is the fork point', () => {
    assert.equal(findMergeBase(branched, 'C', 'D'), 'B');
});

// DAG with a merge commit:
//   A <- B <- C ----\
//          \         M <- E
//           D ------/
// M.parent = C, M.mergeParent = D
const dag = [
    { hash: 'A', parent: null },
    { hash: 'B', parent: 'A' },
    { hash: 'C', parent: 'B' },
    { hash: 'D', parent: 'B' },
    { hash: 'M', parent: 'C', mergeParent: 'D' },
    { hash: 'E', parent: 'M' }
];

test('DAG: mergeParent edge is traversed', () => {
    // D is an ancestor of E only through M.mergeParent.
    assert.equal(findMergeBase(dag, 'E', 'D'), 'D');
});

test('DAG: fork point still found through merge node', () => {
    assert.equal(findMergeBase(dag, 'C', 'D'), 'B');
});

test('unrelated histories have no merge base', () => {
    const a = [{ hash: 'X', parent: null }];
    const b = [{ hash: 'Y', parent: null }];
    assert.equal(findMergeBase([...a, ...b], 'X', 'Y'), null);
});
