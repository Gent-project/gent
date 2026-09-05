"""Browser edits produce canonical bytes on the server through the shared store."""
import base64
import binascii
import time
from django.db import transaction
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from api.models import Repository
from api.utils import get_repository_or_404
from api.serializers import CommitSerializer
from api.models import Commit
from .objects import GitError, ZERO, oid, ref_name, object_id, parse_commit, parse_tree, serialize_tree
from .pack import MAX_OBJECT, MAX_BYTES
from . import store


def safe_path(value):
    if (not isinstance(value, str) or '\\' in value or '\0' in value or len(value.encode()) > 4096
            or len(value.split('/')) > 100
            or any(p.lower() in ('', '.', '..', '.git', '.gent') for p in value.split('/'))):
        raise GitError('unsafe file path')
    return value


@transaction.atomic
def commit_files(repository, user, branch, expected_head, message, files):
    repository = Repository.objects.select_for_update().get(pk=repository.pk)
    if repository.object_format != 'sha256':
        raise GitError('canonical file edits require a SHA-256 repository')
    ref = ref_name('refs/heads/' + branch)
    expected_head = oid(expected_head or ZERO)
    if store.public_refs(repository).get(ref, ZERO) != expected_head:
        raise GitError('branch changed; refresh and retry')
    if not isinstance(message, str) or not message.strip() or len(message.encode()) > 65536:
        raise GitError('provide a commit message up to 64 KiB')
    if not isinstance(files, list) or not files or len(files) > 1000:
        raise GitError('provide between 1 and 1000 file changes')
    incoming = {}
    def put(kind, data):
        key = object_id(kind, data); incoming[key] = (kind, data); return key
    flat, total = {}, 0
    if expected_head != ZERO:
        commit = store.read(repository, expected_head)
        if not commit or commit[0] != 'commit':
            raise GitError('branch head is missing')
        todo = [(parse_commit(commit[1])['tree'], '', 0)]
        while todo:
            key, prefix, depth = todo.pop()
            if depth > 100 or len(flat) > 10000:
                raise GitError('tree exceeds browser edit limits')
            item = store.read(repository, key)
            if not item or item[0] != 'tree':
                raise GitError('missing tree')
            for entry in parse_tree(item[1]):
                name = safe_path(prefix + entry['name'])
                if entry['type'] == 'tree':
                    todo.append((entry['sha'], name + '/', depth + 1))
                else:
                    flat[name] = (entry['mode'], entry['sha'])
    seen = set()
    for change in files:
        if not isinstance(change, dict):
            raise GitError('invalid file change')
        name = safe_path(change.get('path'))
        if name in seen:
            raise GitError('duplicate file change')
        seen.add(name)
        if flat.get(name, ('',))[0] == '160000':
            raise GitError('browser editing of submodules is unsupported')
        if change.get('delete'):
            if name not in flat:
                raise GitError('cannot delete a missing file')
            del flat[name]
            continue
        try:
            data = base64.b64decode(change['data'], validate=True)
        except (KeyError, ValueError, TypeError, binascii.Error):
            raise GitError('file data must be base64') from None
        total += len(data)
        if len(data) > MAX_OBJECT or total > MAX_BYTES:
            raise GitError('files exceed upload limits')
        mode = flat.get(name, ('100644',))[0]
        flat[name] = (mode, put('blob', data))
    root = {}
    for name, entry in flat.items():
        parts, node = name.split('/'), root
        for part in parts[:-1]:
            node = node.setdefault(part, {})
            if not isinstance(node, dict):
                raise GitError('file/directory collision')
        if parts[-1] in node:
            raise GitError('file/directory collision')
        node[parts[-1]] = entry
    def build(node):
        return put('tree', serialize_tree([{'name': name, 'mode': '40000' if isinstance(item, dict) else item[0],
            'sha': build(item) if isinstance(item, dict) else item[1]} for name, item in node.items()]))
    tree = build(root)
    name, email = user.get_full_name(), user.email
    if any(c in name + email for c in '\n\r\0<>'):
        raise GitError('account identity is not representable in a commit')
    identity = f'{name} <{email}> {int(time.time())} +0000'
    data = (f'tree {tree}\n' + (f'parent {expected_head}\n' if expected_head != ZERO else '')
            + f'author {identity}\ncommitter {identity}\n\n' + message).encode()
    key = put('commit', data)
    store.publish(repository, user, [(expected_head, key, ref)], incoming)
    return Commit.objects.get(repository=repository, sha=key)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def file_commit(request, owner_ref, repo_name):
    repository = get_repository_or_404(owner_ref, repo_name, request.user)
    try:
        commit = commit_files(repository, request.user, request.data.get('branch', repository.default_branch),
            request.data.get('expected_head'), request.data.get('message'), request.data.get('files'))
    except (GitError, TypeError, ValueError) as error:
        return Response({'error': str(error)}, status=409 if 'branch changed' in str(error) else 400)
    return Response({'commit': CommitSerializer(commit).data}, status=201)


def ref_response(repository, user, old, new, name, incoming=None):
    """REST adapters share the same publication boundary and ref validation."""
    try:
        store.publish(repository, user, [(old or ZERO, new or ZERO, name)], incoming or {})
    except GitError as error:
        return Response({'error': str(error)}, status=409)
    return None


def create_tag(repository, user, values):
    from api.models import Tag
    from api.serializers import TagSerializer
    target = oid(values['commit_sha'])
    item = store.read(repository, target)
    if not item:
        return Response({'error': 'tag target is missing'}, status=400)
    name = values['name']
    ref_name('refs/tags/' + name)
    incoming = {}
    if values.get('annotated'):
        tagger = f'{user.get_full_name()} <{user.email}> {int(time.time())} +0000'
        if any(c in user.get_full_name() + user.email for c in '\n\r\0<>'):
            return Response({'error': 'account identity is not representable'}, status=400)
        data = (f'object {target}\ntype {item[0]}\ntag {name}\ntagger {tagger}\n\n' + values.get('message', '')).encode()
        target = object_id('tag', data); incoming[target] = ('tag', data)
    error = ref_response(repository, user, ZERO, target, 'refs/tags/' + name, incoming)
    if error is not None:
        return error
    return Response({'message': 'Tag created successfully', 'tag': TagSerializer(Tag.objects.get(repository=repository, name=name)).data}, status=201)
