const test = require('node:test');
const assert = require('node:assert/strict');

const resolve = require('../src/commands/resolve');

test('interactive resolve keeps every previous choice and adds AI', () => {
    assert.deepEqual(
        resolve.resolutionChoices().map(choice => choice.value),
        ['ours', 'theirs', 'both', 'ai', 'edit', 'skip']
    );
    assert.match(resolve.resolutionChoices()[3].name, /Resolve with AI/i);
});

test('AI conflict explanation is explicitly model-labelled and compares both branches', () => {
    const lines = resolve.aiAnalysisLines({
        oursSummary: 'Keeps the current text.',
        theirsSummary: 'Adds the incoming text.',
        summary: 'Keeps both non-duplicate changes.',
    }, { oursLabel: 'branch1', theirsLabel: 'branch2' });
    assert.match(lines[0], /Gent AI analysis \(xiaomi\/mimo-v2\.5:nitro\)/);
    assert.equal(lines[1], 'Current branch (branch1): Keeps the current text.');
    assert.equal(lines[2], 'Incoming branch (branch2): Adds the incoming text.');
    assert.equal(lines[3], 'AI merge decision: Keeps both non-duplicate changes.');
});
