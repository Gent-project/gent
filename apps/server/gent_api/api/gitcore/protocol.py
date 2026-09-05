"""Protocol-v0 framing. A v2 request deliberately receives a v0 advertisement."""
from .objects import GitError, ZERO, oid, ref_name
from . import pack, store


def pkt(data):
    if isinstance(data, str):
        data = data.encode()
    if len(data) > 65516:
        raise GitError('packet too large')
    return f'{len(data) + 4:04x}'.encode() + data


def packet(data, pos):
    if pos + 4 > len(data):
        raise GitError('truncated packet')
    raw = data[pos:pos + 4]
    if any(c not in b'0123456789abcdefABCDEF' for c in raw):
        raise GitError('invalid packet length')
    size = int(raw, 16)
    if size == 0:
        return None, pos + 4
    if size < 4 or size > 65520 or pos + size > len(data):
        raise GitError('invalid packet length')
    return data[pos + 4:pos + size], pos + size


def advertisement(repository, service):
    refs = store.public_refs(repository)
    head = 'refs/heads/' + repository.default_branch
    caps = 'object-format=sha256'
    if service == 'git-receive-pack':
        caps += ' report-status delete-refs atomic ofs-delta'
    else:
        caps += ' ofs-delta symref=HEAD:' + head
    rows = sorted(refs.items())
    if service == 'git-upload-pack' and head in refs:
        rows.insert(0, ('HEAD', refs[head]))
    if not rows:
        rows = [('capabilities^{}', ZERO)]
    result = pkt(f'# service={service}\n') + b'0000'
    for i, (name, key) in enumerate(rows):
        result += pkt(f'{key} {name}' + ('\0' + caps if i == 0 else '') + '\n')
    return result + b'0000'


def upload(repository, data):
    pos, wants, done, caps = 0, [], False, []
    while pos < len(data):
        line, pos = packet(data, pos)
        if line is None:
            continue
        fields = line.rstrip(b'\n').decode('ascii').split(' ')
        if fields[0] == 'want' and len(fields) >= 2:
            if not wants:
                caps = fields[2:]
            elif len(fields) != 2:
                raise GitError('capabilities only allowed on first want')
            wants.append(oid(fields[1]))
        elif fields[0] == 'have' and len(fields) == 2:
            oid(fields[1])  # Legal baseline: NAK and send a full closure.
        elif fields == ['done']:
            done = True
        else:
            raise GitError('unsupported upload negotiation')
    # Git v0 fetch-pack selects the advertised format but does not echo it.
    # Every want/have is still strictly validated as a 64-digit SHA-256 ID.
    if any(c not in ('object-format=sha256', 'ofs-delta') and not c.startswith('agent=') for c in caps):
        raise GitError('unsupported upload capability')
    allowed = set(store.public_refs(repository).values())
    if any(key not in allowed for key in wants):
        raise GitError('want is not an advertised ref')
    if not done:
        return pkt('NAK\n')
    objects = store.closure([(key, None) for key in wants], lambda key: store.read(repository, key))
    return pkt('NAK\n') + pack.encode(list(objects.values()))


def receive(repository, user, data, authorize=None):
    pos, updates, caps = 0, [], []
    while True:
        line, pos = packet(data, pos)
        if line is None:
            break
        command, sep, capabilities = line.rstrip(b'\n').partition(b'\0')
        if sep:
            if updates:
                raise GitError('capabilities only allowed on first command')
            caps = capabilities.decode('ascii').split()
        fields = command.decode('utf-8').split(' ')
        if len(fields) != 3:
            raise GitError('invalid ref update')
        old, new, name = fields
        oid(old); oid(new); ref_name(name)
        updates.append((old, new, name))
        if len(updates) > 1024:
            raise GitError('too many ref updates')
    if 'object-format=sha256' not in caps:
        raise GitError('SHA-256 negotiation required')
    if any(c not in ('object-format=sha256', 'report-status', 'delete-refs', 'atomic', 'ofs-delta')
           and not c.startswith('agent=') for c in caps):
        raise GitError('unsupported receive capability')
    try:
        incoming = pack.decode(data[pos:], lambda key: store.read(repository, key)) if pos < len(data) else {}
        store.publish(repository, user, updates, incoming, authorize)
    except GitError as error:
        if 'report-status' not in caps:
            return pkt('ERR ' + str(error) + '\n')
        return pkt('unpack ' + str(error) + '\n') + b''.join(pkt(f'ng {name} transaction rejected\n') for _, _, name in updates) + b'0000'
    return (pkt('unpack ok\n') + b''.join(pkt(f'ok {name}\n') for _, _, name in updates) + b'0000') if 'report-status' in caps else b''
