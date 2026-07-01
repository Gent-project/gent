/**
 * Unit tests for the content-addressable hash/object store.
 * Run with:  node --test tests/hash.test.js
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
    hashBlob,
    hashTree,
    storeBlob,
    readBlob,
    readBlobAsString,
    objectExists,
    storeTree,
    readTree,
    decodeRemoteBlobContent,
    splitLines,
    isBinaryBuffer
} = require('../src/utils/hash-engine');

function tmpStore() {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'gent-hash-'));
}

test('hashBlob is deterministic and 64-char hex', () => {
    const h1 = hashBlob('hello world');
    const h2 = hashBlob('hello world');
    assert.equal(h1, h2);
    assert.match(h1, /^[0-9a-f]{64}$/);
    assert.notEqual(hashBlob('hello'), hashBlob('world'));
});

test('storeBlob -> readBlob round-trips content', async () => {
    const store = tmpStore();
    const content = 'line1\nline2\n';
    const hash = await storeBlob(store, content);
    assert.equal(hash, hashBlob(content));
    assert.equal(await readBlobAsString(store, hash), content);
    assert.ok(Buffer.isBuffer(await readBlob(store, hash)));
});

test('storeBlob deduplicates identical content', async () => {
    const store = tmpStore();
    const h1 = await storeBlob(store, 'same');
    assert.equal(await objectExists(store, h1), true);
    const h2 = await storeBlob(store, 'same'); // should be a no-op write
    assert.equal(h1, h2);
});

test('binary content round-trips byte-for-byte', async () => {
    const store = tmpStore();
    const bin = Buffer.from([0, 1, 2, 255, 0, 42]);
    assert.equal(isBinaryBuffer(bin), true);
    const hash = await storeBlob(store, bin);
    assert.deepEqual(await readBlob(store, hash), bin);
});

test('tree hashing is order-independent (entries sorted)', () => {
    const e1 = [
        { mode: '100644', name: 'b.js', hash: 'h2', type: 'blob' },
        { mode: '100644', name: 'a.js', hash: 'h1', type: 'blob' }
    ];
    const e2 = [
        { mode: '100644', name: 'a.js', hash: 'h1', type: 'blob' },
        { mode: '100644', name: 'b.js', hash: 'h2', type: 'blob' }
    ];
    assert.equal(hashTree(e1), hashTree(e2));
});

test('storeTree -> readTree round-trips entries', async () => {
    const store = tmpStore();
    const entries = [{ mode: '100644', name: 'x.js', hash: 'deadbeef', type: 'blob' }];
    const hash = await storeTree(store, entries);
    const read = await readTree(store, hash);
    assert.deepEqual(read, entries);
});

test('decodeRemoteBlobContent prefers the representation matching the hash', () => {
    const raw = 'plain text content';
    const expected = hashBlob(Buffer.from(raw, 'utf-8'));
    assert.equal(decodeRemoteBlobContent(raw, expected).toString('utf-8'), raw);

    // base64-wrapped payload whose decoded bytes match the expected hash
    const b64 = Buffer.from(raw, 'utf-8').toString('base64');
    assert.equal(decodeRemoteBlobContent(b64, expected).toString('utf-8'), raw);
});

test('splitLines normalizes CRLF', () => {
    assert.deepEqual(splitLines('a\r\nb\r\nc'), ['a', 'b', 'c']);
    assert.deepEqual(splitLines(''), []);
});
