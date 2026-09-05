/**
 * Unit tests for file scanning and ignore rules.
 * Run with:  node --test tests/file-system.test.js
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { getAllFiles, getIgnorePatterns, shouldIgnore } = require('../src/utils/fileSystem');

function tmpRepo() {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'gent-files-'));
}

function write(filePath, content = '') {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content);
}

function relativeFiles(root, files) {
    return files.map(file => path.relative(root, file).replace(/\\/g, '/')).sort();
}

test('default ignore rules skip .gentignore and .gitignore files', async () => {
    const root = tmpRepo();
    write(path.join(root, '.gentignore'), '*.tmp\n');
    write(path.join(root, '.gitignore'), 'ignored-by-git.txt\n');
    write(path.join(root, 'keep.txt'), 'keep');
    write(path.join(root, 'note.tmp'), 'tmp');
    write(path.join(root, 'ignored-by-git.txt'), 'ignored');

    const patterns = await getIgnorePatterns(root);
    const files = relativeFiles(root, await getAllFiles(root, patterns));

    assert.deepEqual(files, ['keep.txt']);
});

test('nested .gitignore rules apply relative to their directory', async () => {
    const root = tmpRepo();
    write(path.join(root, 'src', '.gitignore'), 'dist/\n*.log\n');
    write(path.join(root, 'src', 'dist', 'bundle.js'), 'ignored');
    write(path.join(root, 'src', 'debug.log'), 'ignored');
    write(path.join(root, 'src', 'app.js'), 'keep');
    write(path.join(root, 'debug.log'), 'ignored by default pattern');

    const patterns = await getIgnorePatterns(root);
    const files = relativeFiles(root, await getAllFiles(root, patterns));

    assert.deepEqual(files, ['src/app.js']);
});

test('shouldIgnore handles directory patterns with trailing slashes', () => {
    assert.equal(shouldIgnore('node_modules/package/index.js', ['node_modules/']), true);
    assert.equal(shouldIgnore('src/dist/app.js', ['src/dist/']), true);
    assert.equal(shouldIgnore('src/app.js', ['src/dist/']), false);
});
