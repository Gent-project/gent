"""Canonical SHA-256 Git bytes. Display decoding never changes stored bytes."""
import hashlib
import re

OID = re.compile(r'[0-9a-f]{64}\Z')
TYPES = {'blob', 'tree', 'commit', 'tag'}
MODES = {b'100644': 'blob', b'100755': 'blob', b'120000': 'blob', b'40000': 'tree', b'160000': 'commit'}
ZERO = '0' * 64


class GitError(ValueError):
    pass


def oid(value):
    if not isinstance(value, str) or not OID.fullmatch(value):
        raise GitError('invalid SHA-256 object ID')
    return value


def object_id(kind, data):
    if kind not in TYPES or not isinstance(data, bytes):
        raise GitError('invalid object type or payload')
    return hashlib.sha256(f'{kind} {len(data)}\0'.encode() + data).hexdigest()


def ref_name(name):
    if (not isinstance(name, str) or not name.startswith('refs/') or len(name.encode()) > 1024
            or any(ord(c) < 33 or ord(c) == 127 for c in name)
            or any(c in name for c in '~^:?*[\\') or '..' in name or '@{' in name
            or name.endswith('.') or any(not p or p.startswith('.') or p.endswith('.lock') for p in name.split('/'))):
        raise GitError('invalid ref name')
    return name


def parse_tree(data):
    result = []
    offset = 0
    previous = None
    names = set()
    while offset < len(data):
        space, nul = data.find(b' ', offset), data.find(b'\0', offset)
        if space < offset or nul <= space or nul + 33 > len(data):
            raise GitError('truncated tree entry')
        mode, name = data[offset:space], data[space + 1:nul]
        if mode not in MODES or not name or b'/' in name or name in (b'.', b'..'):
            raise GitError('invalid tree entry')
        key = name + (b'/' if mode == b'40000' else b'')
        if name in names or (previous is not None and key <= previous):
            raise GitError('tree entries must be unique and sorted')
        names.add(name)
        previous = key
        result.append({'mode': mode.decode(), 'name': name.decode('utf-8', 'replace'),
                       'name_bytes': name, 'sha': data[nul + 1:nul + 33].hex(), 'type': MODES[mode]})
        offset = nul + 33
    return result


def serialize_tree(entries):
    entries = sorted(entries, key=lambda e: e['name'].encode() + (b'/' if str(e['mode']) == '40000' else b''))
    data = b''.join(str(e['mode']).encode() + b' ' + e['name'].encode() + b'\0' + bytes.fromhex(oid(e['sha'])) for e in entries)
    parse_tree(data)
    return data


def headers(data):
    head, sep, message = data.partition(b'\n\n')
    if not sep:
        raise GitError('object has no header/message separator')
    result = {}
    last = None
    for line in head.split(b'\n'):
        if line.startswith(b' ') and last:
            result[last][-1] += b'\n' + line
            continue
        key, space, value = line.partition(b' ')
        if not space or not key:
            raise GitError('invalid object header')
        last = key.decode('ascii')
        result.setdefault(last, []).append(value)
    return result, message


def single(values, name):
    if len(values.get(name, [])) != 1:
        raise GitError(f'object requires one {name} header')
    return values[name][0]


def identity(raw):
    match = re.fullmatch(rb'(.*?) <([^<>\n]*)> (-?\d+) ([+-]\d{4})', raw)
    if not match:
        raise GitError('invalid author/committer identity')
    name, email, timestamp, zone = match.groups()
    return {'name': name.decode('utf-8', 'replace'), 'email': email.decode('utf-8', 'replace'),
            'timestamp': int(timestamp), 'timezone': zone.decode()}


def parse_commit(data):
    values, message = headers(data)
    return {'tree': oid(single(values, 'tree').decode()),
            'parents': [oid(p.decode()) for p in values.get('parent', [])],
            'author': identity(single(values, 'author')), 'committer': identity(single(values, 'committer')),
            'message': message.decode('utf-8', 'replace')}


def parse_tag(data):
    values, message = headers(data)
    kind = single(values, 'type').decode()
    if kind not in TYPES:
        raise GitError('invalid tag target type')
    return {'target': oid(single(values, 'object').decode()), 'type': kind,
            'name': single(values, 'tag').decode('utf-8', 'replace'),
            'tagger': identity(single(values, 'tagger')) if 'tagger' in values else None,
            'message': message.decode('utf-8', 'replace')}


def dependencies(kind, data):
    if kind == 'blob':
        return []
    if kind == 'tree':
        return [(e['sha'], e['type']) for e in parse_tree(data) if e['mode'] != '160000']
    if kind == 'commit':
        commit = parse_commit(data)
        return [(commit['tree'], 'tree')] + [(p, 'commit') for p in commit['parents']]
    if kind == 'tag':
        tag = parse_tag(data)
        return [(tag['target'], tag['type'])]
    raise GitError('unknown object type')
