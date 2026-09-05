"""Deterministic legacy conversion, matching the Node migration byte contract."""
import base64
import json
import math
from datetime import datetime
from django.db import transaction
from api.models import Repository, Commit, Tree, Blob, Branch, Tag, GitMigrationMap, GitObject
from api.services.repository_export import build_clone_payload
from .objects import GitError, object_id, serialize_tree, oid, ref_name, ZERO
from . import store


def identity(value, timestamp):
    try:
        seconds = math.floor(datetime.fromisoformat(timestamp.replace('Z', '+00:00')).timestamp())
    except (ValueError, AttributeError):
        raise GitError('legacy timestamp missing or invalid') from None
    name, email = value.get('name') or 'Unknown', value.get('email') or ''
    if any(c in name + email for c in '\n\r\0<>'):
        raise GitError('unsafe legacy identity')
    return f'{name} <{email}> {seconds} +0000'


def convert(history, read_blob):
    incoming, mapping, refs = {}, {}, {}

    def put(kind, data):
        key = object_id(kind, data)
        incoming[key] = (kind, data)
        return key

    def tree(entries):
        root = {}
        for entry in entries:
            name, key = entry.get('name') or entry.get('path'), oid(entry['hash'])
            if not name or '\\' in name or '\0' in name or any(p.lower() in ('', '.', '..', '.git', '.gent') for p in name.split('/')):
                raise GitError('unsafe legacy path')
            mode = entry.get('mode') or '100644'
            if str(mode) not in ('100644', '100755', '120000') or entry.get('type', 'blob') != 'blob':
                raise GitError('unsupported legacy mode/type')
            data = read_blob(key)
            if object_id('blob', data) != key:
                raise GitError('corrupt legacy blob')
            put('blob', data)
            parts, node = name.split('/'), root
            for part in parts[:-1]:
                node = node.setdefault(part, {})
                if not isinstance(node, dict):
                    raise GitError('legacy file/directory collision')
            if parts[-1] in node:
                raise GitError('duplicate legacy path')
            node[parts[-1]] = (str(mode), key)

        def build(node):
            return put('tree', serialize_tree([{'name': name, 'mode': '40000' if isinstance(item, dict) else item[0],
                'sha': build(item) if isinstance(item, dict) else item[1]} for name, item in node.items()]))
        return build(root)

    pending = list(history['commits'])
    ids = {c['hash'] for c in pending}
    if len(ids) != len(pending):
        raise GitError('duplicate legacy commit IDs')
    while pending:
        remaining = []
        for commit in pending:
            oid(commit['hash'])
            parents = [p for p in (commit.get('parent'), commit.get('mergeParent')) if p]
            if any(p not in ids for p in parents):
                raise GitError('missing legacy parent')
            if any(p not in mapping for p in parents):
                remaining.append(commit)
                continue
            entries = commit.get('tree', commit.get('files'))
            if not isinstance(entries, list):
                raise GitError('legacy commit lacks a complete tree snapshot')
            tree_id = tree(entries)
            author = identity(commit.get('author') or {}, commit.get('timestamp'))
            data = (f'tree {tree_id}\n' + ''.join(f'parent {mapping[p]}\n' for p in parents)
                    + f'author {author}\ncommitter {author}\n\n' + (commit.get('message') or '')).encode()
            mapping[commit['hash']] = put('commit', data)
        if len(remaining) == len(pending):
            raise GitError('cyclic legacy history')
        pending = remaining
    for name, old in history['branches'].items():
        ref_name('refs/heads/' + name)
        if old:
            if old not in mapping:
                raise GitError('branch names missing legacy commit')
            refs['refs/heads/' + name] = mapping[old]
    for name, tag in history.get('tags', {}).items():
        ref_name('refs/tags/' + name)
        if tag['hash'] not in mapping:
            raise GitError('tag names missing legacy commit')
        key = mapping[tag['hash']]
        if tag.get('annotated'):
            tagger = identity(tag.get('tagger') or {}, tag.get('timestamp'))
            key = put('tag', (f'object {key}\ntype commit\ntag {name}\ntagger {tagger}\n\n' + (tag.get('message') or '')).encode())
        refs['refs/tags/' + name] = key
    store.closure([(key, 'commit' if name.startswith('refs/heads/') else None) for name, key in refs.items()], incoming.get)
    return incoming, mapping, refs


def snapshot(repository):
    # Validate the old durable store before using the display/export adapters.
    trees = {t.sha: t.entries for t in Tree.objects.filter(repository=repository)}
    visited = set()
    def walk(key, ancestors):
        if key in ancestors or key not in trees:
            raise GitError('missing or cyclic legacy tree')
        if key in visited:
            return
        visited.add(key)
        for entry in trees[key]:
            if entry['type'] == 'tree':
                walk(entry['sha'], ancestors | {key})
            elif entry['type'] != 'blob':
                raise GitError('unsupported legacy tree entry')
    for commit in Commit.objects.filter(repository=repository):
        if len(commit.parent_shas) > 2:
            raise GitError('legacy export cannot preserve more than two parents')
        walk(commit.tree_sha, set())
    payload = build_clone_payload(repository)
    blobs = {}
    for blob in Blob.objects.filter(repository=repository):
        if blob.content is not None:
            data = blob.content.encode()
        elif blob.file_path:
            with open(blob.file_path, 'rb') as file:
                data = file.read()
        else:
            raise GitError('legacy blob data is missing')
        if len(data) != blob.size or object_id('blob', data) != blob.sha:
            raise GitError('legacy blob ID or size mismatch')
        blobs[blob.sha] = data
    return payload, blobs


@transaction.atomic
def migrate(repository, backup_path=None, dry_run=False):
    repository = Repository.objects.select_for_update().get(pk=repository.pk)
    if repository.object_format != 'legacy':
        raise GitError('repository is already canonical')
    payload, blobs = snapshot(repository)
    incoming, mapping, refs = convert(payload, lambda key: blobs[key])
    report = {'format': 'gent-migration-1', 'mapping': mapping, 'refs': refs}
    if dry_run:
        return report
    if backup_path is None:
        raise GitError('provide a backup path outside repository storage')
    backup = {'repository_id': repository.pk, 'legacy': payload,
              'blobs': {key: base64.b64encode(data).decode() for key, data in blobs.items()}, **report}
    # Exclusive creation and fsync: never overwrite an existing backup.
    import os
    with open(backup_path, 'x') as file:
        json.dump(backup, file)
        file.flush(); os.fsync(file.fileno())
    with open(backup_path) as file:
        if json.load(file) != backup:
            raise GitError('backup verification failed')
    Commit.objects.filter(repository=repository).delete()
    Tree.objects.filter(repository=repository).delete()
    Blob.objects.filter(repository=repository).delete()
    Branch.objects.filter(repository=repository).delete()
    Tag.objects.filter(repository=repository).delete()
    repository.object_format = 'sha256'
    repository.save(update_fields=['object_format'])
    store.publish(repository, repository.owner, [(ZERO, key, name) for name, key in refs.items()], incoming)
    # Preserve orphan history addressed by migration maps as well as live refs.
    for key, (kind, data) in incoming.items():
        _, created = GitObject.objects.get_or_create(repository=repository, oid=key,
            defaults={'type': kind, 'size': len(data), 'data': data})
        if created:
            store.index_object(repository, key, kind, data)
    GitMigrationMap.objects.bulk_create([GitMigrationMap(repository=repository, old_oid=old, new_oid=new) for old, new in mapping.items()])
    return report
