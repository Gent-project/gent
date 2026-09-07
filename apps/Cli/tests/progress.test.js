const test = require('node:test');
const assert = require('node:assert/strict');
const { PassThrough } = require('node:stream');
const { createProgress } = require('../src/utils/progress');

test('non-interactive progress prints phases and a final result', () => {
    const stream = new PassThrough();
    let output = '';
    stream.on('data', chunk => { output += chunk; });

    const progress = createProgress('Starting...', { stream, interactive: false });
    progress.update('Downloading...');
    progress.update('Downloading...');
    progress.succeed('Complete');
    progress.update('Ignored after completion');

    assert.equal(output, 'Starting...\nDownloading...\nComplete\n');
});
