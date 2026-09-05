"""Bounded pack v2/v3 decoder and full-object encoder; no Git dependencies."""
import hashlib
import struct
import zlib
from .objects import GitError, object_id

MAX_OBJECT = 32 * 1024 * 1024
MAX_BYTES = 128 * 1024 * 1024
MAX_OBJECTS = 10000
MAX_DEPTH = 64
TYPES = {1: 'commit', 2: 'tree', 3: 'blob', 4: 'tag'}


def variable(data, pos):
    value = shift = 0
    while True:
        if pos >= len(data) or shift > 63:
            raise GitError('invalid delta size')
        byte = data[pos]
        pos += 1
        value |= (byte & 127) << shift
        if byte < 128:
            return value, pos
        shift += 7


def apply_delta(base, delta):
    base_size, pos = variable(delta, 0)
    size, pos = variable(delta, pos)
    if base_size != len(base) or size > MAX_OBJECT:
        raise GitError('invalid delta result/base size')
    result = bytearray()
    while pos < len(delta):
        command = delta[pos]
        pos += 1
        if command & 128:
            offset = length = 0
            for i in range(7):
                if command & (1 << i):
                    if pos >= len(delta):
                        raise GitError('truncated delta copy')
                    if i < 4:
                        offset |= delta[pos] << (i * 8)
                    else:
                        length |= delta[pos] << ((i - 4) * 8)
                    pos += 1
            length = length or 65536
            if offset + length > len(base):
                raise GitError('delta copy outside base')
            result.extend(base[offset:offset + length])
        elif command:
            if pos + command > len(delta):
                raise GitError('truncated delta insert')
            result.extend(delta[pos:pos + command])
            pos += command
        else:
            raise GitError('invalid delta opcode')
        if len(result) > size:
            raise GitError('delta exceeds result size')
    if len(result) != size:
        raise GitError('delta result size mismatch')
    return bytes(result)


def decode(data, resolve_base=lambda oid: None):
    if len(data) < 44 or len(data) > MAX_BYTES or data[:4] != b'PACK':
        raise GitError('invalid pack or pack exceeds transfer limit')
    version, count = struct.unpack('!II', data[4:12])
    if version not in (2, 3) or count > MAX_OBJECTS:
        raise GitError('unsupported pack version or object count')
    body = data[:-32]
    if hashlib.sha256(body).digest() != data[-32:]:
        raise GitError('pack checksum mismatch')
    records = []
    pos, total = 12, 0
    for _ in range(count):
        start = pos
        if pos >= len(body):
            raise GitError('truncated pack')
        byte = body[pos]
        pos += 1
        code, size, shift = (byte >> 4) & 7, byte & 15, 4
        while byte & 128:
            if pos >= len(body) or shift > 63:
                raise GitError('invalid pack object size')
            byte = body[pos]
            pos += 1
            size |= (byte & 127) << shift
            shift += 7
        if size > MAX_OBJECT or code not in (1, 2, 3, 4, 6, 7):
            raise GitError('invalid object type or size limit exceeded')
        base = None
        if code == 6:
            if pos >= len(body):
                raise GitError('truncated offset delta')
            byte = body[pos]
            pos += 1
            distance = byte & 127
            while byte & 128:
                if pos >= len(body) or distance > MAX_BYTES:
                    raise GitError('invalid delta offset')
                byte = body[pos]
                pos += 1
                distance = ((distance + 1) << 7) | (byte & 127)
            base = start - distance
            if base >= start or base < 12:
                raise GitError('invalid delta base offset')
        elif code == 7:
            if pos + 32 > len(body):
                raise GitError('truncated reference delta')
            base = body[pos:pos + 32].hex()
            pos += 32
        inflater = zlib.decompressobj()
        try:
            payload = inflater.decompress(body[pos:], size + 1)
        except zlib.error as error:
            raise GitError('corrupt compressed object') from error
        if not inflater.eof or len(payload) != size:
            raise GitError('inflated object size mismatch')
        pos = len(body) - len(inflater.unused_data)
        total += size
        if total > MAX_BYTES:
            raise GitError('inflated pack exceeds transfer limit')
        records.append((start, code, base, payload))
    if pos != len(body):
        raise GitError('trailing pack data')
    offsets, objects, depths = {}, {}, {}
    pending = records
    for _ in range(MAX_DEPTH + 1):
        remaining = []
        for start, code, base, payload in pending:
            depth = 0
            if code in TYPES:
                kind = TYPES[code]
            else:
                source = offsets.get(base) if code == 6 else objects.get(base)
                if source is None and code == 7:
                    source = resolve_base(base)
                if source is None:
                    remaining.append((start, code, base, payload))
                    continue
                kind, source_bytes = source
                depth = depths.get(base, 0) + 1
                if depth > MAX_DEPTH:
                    raise GitError('delta chain exceeds depth limit')
                payload = apply_delta(source_bytes, payload)
                total += len(payload)
                if total > MAX_BYTES:
                    raise GitError('resolved pack exceeds transfer limit')
            key = object_id(kind, payload)
            offsets[start] = objects[key] = (kind, payload)
            depths[start] = depths[key] = depth
        if not remaining:
            return objects
        if len(remaining) == len(pending):
            raise GitError('missing delta base or cyclic delta chain')
        pending = remaining
    raise GitError('delta resolution exceeded depth limit')


def encode(objects):
    parts = [b'PACK' + struct.pack('!II', 2, len(objects))]
    codes = {v: k for k, v in TYPES.items()}
    for kind, data in objects:
        size = len(data)
        byte = (codes[kind] << 4) | (size & 15)
        size >>= 4
        header = bytearray()
        while size:
            header.append(byte | 128)
            byte, size = size & 127, size >> 7
        header.append(byte)
        parts.extend((bytes(header), zlib.compress(data)))
    body = b''.join(parts)
    return body + hashlib.sha256(body).digest()
