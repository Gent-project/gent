"""One transactional publication boundary for canonical objects and public refs."""
from datetime import datetime, timezone
from django.db import transaction
from api.models import Repository, GitObject, GitRef, Commit, Tree, Blob, Branch, Tag
from api.services.repository_access import user_can_write_repo
from .objects import GitError, ZERO, oid, ref_name, object_id, dependencies, parse_commit, parse_tree, parse_tag
from .pack import MAX_BYTES, MAX_OBJECTS


def read(repository, key):
    item = GitObject.objects.filter(repository=repository, oid=key).first()
    if item is None:
        return None
    data = bytes(item.data)
    if item.size != len(data) or object_id(item.type, data) != key:
        raise GitError('corrupt stored object')
    return item.type, data


def closure(roots, resolve):
    objects, pending, total = {}, list(roots), 0
    while pending:
        key, expected = pending.pop()
        oid(key)
        item = objects.get(key) or resolve(key)
        if item is None:
            raise GitError(f'missing reachable object {key}')
        kind, data = item
        if expected and expected != kind:
            raise GitError('object relationship has incorrect type')
        if key in objects:
            continue
        if object_id(kind, data) != key:
            raise GitError('object ID mismatch')
        total += len(data)
        if total > MAX_BYTES or len(objects) >= MAX_OBJECTS:
            raise GitError('reachable history exceeds service limits')
        objects[key] = item
        pending.extend(dependencies(kind, data))
    return objects


def public_refs(repository):
    return dict(GitRef.objects.filter(repository=repository, name__regex=r'^refs/(heads|tags)/').values_list('name', 'target'))


def index_object(repository, key, kind, data):
    if kind == 'commit':
        value = parse_commit(data)
        author, committer = value['author'], value['committer']
        try:
            date = datetime.fromtimestamp(committer['timestamp'], timezone.utc)
        except (ValueError, OverflowError, OSError) as error:
            raise GitError('commit timestamp outside API supported range') from error
        Commit.objects.update_or_create(repository=repository, sha=key, defaults={
            'tree_sha': value['tree'], 'parent_shas': value['parents'], 'message': value['message'],
            'author_name': author['name'], 'author_email': author['email'], 'committed_at': date,
            'author_timestamp': author['timestamp'], 'author_timezone': author['timezone'],
            'committer_name': committer['name'], 'committer_email': committer['email'],
            'committer_timestamp': committer['timestamp'], 'committer_timezone': committer['timezone'],
        })
    elif kind == 'tree':
        entries = [{k: v for k, v in entry.items() if k != 'name_bytes'} for entry in parse_tree(data)]
        Tree.objects.update_or_create(repository=repository, sha=key, defaults={'entries': entries})
    elif kind == 'blob':
        # Display index only; exact bytes remain exclusively in GitObject.
        Blob.objects.update_or_create(repository=repository, sha=key,
                                      defaults={'size': len(data), 'content': None, 'file_path': ''})


@transaction.atomic
def publish(repository, user, updates, incoming, authorize=None):
    repository = Repository.objects.select_for_update().get(pk=repository.pk)
    if repository.object_format != 'sha256':
        raise GitError('repository requires coordinated migration first')
    if not user_can_write_repo(user, repository) or (authorize and not authorize(repository)):
        raise GitError('write permission denied')
    names = set()
    current = dict(GitRef.objects.filter(repository=repository).values_list('name', 'target'))
    for old, new, name in updates:
        oid(old); oid(new); ref_name(name)
        if not name.startswith(('refs/heads/', 'refs/tags/')) or name in names:
            raise GitError('only unique branch and tag updates are accepted')
        names.add(name)
        if current.get(name, ZERO) != old:
            raise GitError('stale old ref; fetch and retry')
        if new == ZERO:
            current.pop(name, None)
        else:
            current[name] = new
    for a in current:
        if any(a.startswith(b + '/') for b in current if a != b):
            raise GitError('ref directory/file collision')
    if len(incoming) > MAX_OBJECTS or sum(len(data) for _, data in incoming.values()) > MAX_BYTES:
        raise GitError('incoming objects exceed service limits')
    resolve = lambda key: incoming.get(key) or read(repository, key)
    for key, (kind, data) in incoming.items():
        if object_id(kind, data) != key:
            raise GitError('supplied object ID mismatch')
        dependencies(kind, data)
    reachable = closure([(key, 'commit' if name.startswith('refs/heads/') else None)
                         for name, key in current.items()], resolve)
    # Unreachable incoming objects are quarantined and discarded.
    for key, (kind, data) in reachable.items():
        _, created = GitObject.objects.get_or_create(repository=repository, oid=key,
                            defaults={'type': kind, 'size': len(data), 'data': data})
        if created:
            index_object(repository, key, kind, data)
    for old, new, name in updates:
        if new == ZERO:
            GitRef.objects.filter(repository=repository, name=name).delete()
        else:
            GitRef.objects.update_or_create(repository=repository, name=name, defaults={'target': new})
        model = Branch if name.startswith('refs/heads/') else Tag
        short = name.split('/', 2)[2]
        if new == ZERO:
            model.objects.filter(repository=repository, name=short).delete()
        elif model is Branch:
            model.objects.update_or_create(repository=repository, name=short, defaults={'commit_sha': new})
        else:
            kind, data = reachable[new]
            tag = parse_tag(data) if kind == 'tag' else None
            peeled, peeled_kind = new, kind
            for _ in range(64):
                if peeled_kind != 'tag':
                    break
                peeled = parse_tag(reachable[peeled][1])['target']
                peeled_kind = reachable[peeled][0]
            else:
                raise GitError('tag chain exceeds depth limit')
            model.objects.update_or_create(repository=repository, name=short, defaults={
                'target_oid': new, 'target_type': kind,
                'commit_sha': peeled if peeled_kind == 'commit' else '', 'annotated': bool(tag), 'message': tag['message'] if tag else '',
                'tagger_name': (tag.get('tagger') or {}).get('name', '') if tag else '',
                'tagger_email': (tag.get('tagger') or {}).get('email', '') if tag else '',
            })
    repository.save(update_fields=['updated_at'])
