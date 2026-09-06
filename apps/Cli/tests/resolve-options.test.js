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
