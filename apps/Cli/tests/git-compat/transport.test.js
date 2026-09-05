const test = require('node:test');
const assert = require('node:assert/strict');
const zlib = require('node:zlib');
const crypto = require('node:crypto');
const { pkt, packet, remoteUrl, closure } = require('../../src/utils/smart-http');
const { readPackStream, encodeObjectHeader } = require('../../src/utils/packfile');
const { hashObject } = require('../../src/utils/git-objects');

test('strict packet framing and credential-free transport URLs', () => {
    assert.equal(packet(pkt('hello\n'), 0).line.toString(), 'hello\n');
    for (const value of ['0001', 'zzzz', '0020short']) assert.throws(() => packet(Buffer.from(value), 0));
    for (const value of ['http://example.com/repo.git', 'https://u:p@example.com/r.git', 'ssh://example.com/r', 'https://host/r?token=secret']) assert.throws(() => remoteUrl(value));
    assert.equal(remoteUrl('http://127.0.0.1:8000/o/r.git'), 'http://127.0.0.1:8000/o/r.git');
});

test('forward reference delta resolves and inflated aggregate limits apply', async () => {
    const base = Buffer.from('abc'), delta = Buffer.from([3, 4, 0x90, 3, 1, 100]);
    const header = Buffer.alloc(12); header.write('PACK'); header.writeUInt32BE(2, 4); header.writeUInt32BE(2, 8);
    const body = Buffer.concat([header, encodeObjectHeader(7, delta.length), Buffer.from(hashObject('blob', base), 'hex'), zlib.deflateSync(delta), encodeObjectHeader(3, base.length), zlib.deflateSync(base)]);
    const pack = Buffer.concat([body, crypto.createHash('sha256').update(body).digest()]);
    const result = await readPackStream(pack);
    assert(result.some(o => o.payload.equals(Buffer.from('abcd'))));
    await assert.rejects(readPackStream(pack, { maxBytes: 20 }), /limit/);
    await assert.rejects(readPackStream(pack, { maxObjects: 1 }), /limit/);
});

test('closure rejects wrong object IDs and relationship types', async () => {
    const payload = Buffer.from('hello'), oid = hashObject('blob', payload);
    await assert.rejects(closure([[oid, 'commit']], async () => ({ type: 'blob', payload })), /mistyped/);
    await assert.rejects(closure([['a'.repeat(64), 'blob']], async () => ({ type: 'blob', payload })), /ID mismatch/);
});

test('shared Node/Python canonical byte and pack fixtures', async () => {
    const fixture = require('../../../../tests/fixtures/git-compat/canonical.json');
    const decoded = new Map((await readPackStream(Buffer.from(fixture.pack, 'base64'))).map(item => [item.oid, item]));
    for (const item of fixture.objects) {
        const payload = Buffer.from(item.payload, 'base64');
        assert.equal(hashObject(item.type, payload), item.oid);
        assert.deepEqual(decoded.get(item.oid).payload, payload);
    }
});
