import base64

from api.models import Blob, Branch, Commit, Tag, Tree


def collect_commits_since(repository, head_sha, since_sha):
    """Return commits reachable from head_sha back to since_sha in oldest-first order."""
    ordered_commits = []
    visited = set()
    commit_cache = {}

    def get_commit(commit_sha):
        if commit_sha not in commit_cache:
            try:
                commit_cache[commit_sha] = Commit.objects.get(
                    repository=repository,
                    sha=commit_sha,
                )
            except Commit.DoesNotExist:
                commit_cache[commit_sha] = None
        return commit_cache[commit_sha]

    def visit(commit_sha):
        if not commit_sha or commit_sha == since_sha or commit_sha in visited:
            return

        visited.add(commit_sha)
        commit = get_commit(commit_sha)
        if not commit:
            return

        for parent_sha in commit.parent_shas or []:
            visit(parent_sha)

        ordered_commits.append(commit)

    visit(head_sha)
    return ordered_commits


def flatten_tree_entries(tree_entries_map, root_tree_sha, cache=None):
    if cache is not None and root_tree_sha in cache:
        return cache[root_tree_sha]

    flattened_entries = []
    blob_hashes = []
    seen_blob_hashes = set()

    def walk(tree_sha, prefix, ancestors):
        for entry in tree_entries_map.get(tree_sha, []):
            entry_name = entry.get('name')
            entry_sha = entry.get('sha')
            entry_type = entry.get('type')
            if not entry_name or not entry_sha or not entry_type:
                continue

            full_name = '/'.join(part for part in [prefix, entry_name] if part)

            if entry_type == 'tree':
                if entry_sha in ancestors:
                    continue
                walk(entry_sha, full_name, ancestors | {entry_sha})
                continue

            flattened_entries.append({
                'mode': entry.get('mode'),
                'name': full_name,
                'hash': entry_sha,
                'type': entry_type,
            })
            if entry_type == 'blob' and entry_sha not in seen_blob_hashes:
                blob_hashes.append(entry_sha)
                seen_blob_hashes.add(entry_sha)

    if root_tree_sha:
        walk(root_tree_sha, '', {root_tree_sha})

    result = (flattened_entries, blob_hashes)
    if cache is not None and root_tree_sha:
        cache[root_tree_sha] = result
    return result


def format_cli_commit(commit, tree_entries):
    parents = commit.parent_shas or []
    parent = parents[0] if len(parents) > 0 else None
    merge_parent = parents[1] if len(parents) > 1 else None

    files = []
    for entry in tree_entries:
        if entry.get('type') == 'blob' and entry.get('hash'):
            files.append({
                'path': entry.get('name'),
                'hash': entry.get('hash'),
            })

    return {
        'hash': commit.sha,
        'message': commit.message,
        'author': {
            'name': commit.author_name,
            'email': commit.author_email,
        },
        'timestamp': commit.committed_at.isoformat(),
        'parent': parent,
        'mergeParent': merge_parent,
        'treeHash': commit.tree_sha,
        'tree': tree_entries,
        'files': files,
        'stats': {},
    }


def build_commits_and_blob_hashes(commits, tree_entries_map):
    result_commits = []
    blob_hashes = []
    seen_blob_hashes = set()
    tree_flatten_cache = {}

    for commit in commits:
        tree_entries, commit_blob_hashes = flatten_tree_entries(
            tree_entries_map,
            commit.tree_sha,
            cache=tree_flatten_cache,
        )
        for blob_sha in commit_blob_hashes:
            if blob_sha not in seen_blob_hashes:
                blob_hashes.append(blob_sha)
                seen_blob_hashes.add(blob_sha)

        result_commits.append(format_cli_commit(commit, tree_entries))

    return result_commits, blob_hashes


def encode_blob_objects(repository, blob_hashes):
    blobs = {}
    if blob_hashes:
        for blob in Blob.objects.filter(repository=repository, sha__in=blob_hashes):
            blobs[blob.sha] = blob

    objects = []
    for blob_sha in blob_hashes:
        blob = blobs.get(blob_sha)
        if not blob:
            continue
        if blob.content is not None:
            data = base64.b64encode(blob.content.encode('utf-8')).decode('ascii')
        elif blob.file_path:
            try:
                with open(blob.file_path, 'rb') as blob_file:
                    data = base64.b64encode(blob_file.read()).decode('ascii')
            except (FileNotFoundError, OSError):
                data = ''
        else:
            data = ''
        objects.append({
            'hash': blob.sha,
            'type': 'blob',
            'data': data,
        })

    return objects


def build_tree_entries_map(repository):
    return {
        tree.sha: tree.entries or []
        for tree in Tree.objects.filter(repository=repository)
    }


def build_branches_map(repository):
    branches = {}
    for branch in Branch.objects.filter(repository=repository):
        commit_sha = branch.commit_sha
        if not commit_sha or commit_sha == '0' * 64:
            branches[branch.name] = None
        else:
            branches[branch.name] = commit_sha
    return branches


def build_tags_map(repository):
    tags = {}
    for tag in Tag.objects.filter(repository=repository):
        tags[tag.name] = {
            'hash': tag.commit_sha,
            'message': tag.message or '',
            'annotated': tag.annotated,
            'tagger': {
                'name': tag.tagger_name or '',
                'email': tag.tagger_email or '',
            },
            'timestamp': tag.created_at.isoformat(),
        }
    return tags


def build_clone_payload(repository):
    commits = Commit.objects.filter(repository=repository).order_by('committed_at')
    tree_entries_map = build_tree_entries_map(repository)
    result_commits, blob_hashes = build_commits_and_blob_hashes(
        commits,
        tree_entries_map,
    )

    branches = build_branches_map(repository)
    default_branch = repository.default_branch
    if default_branch and default_branch not in branches:
        branches[default_branch] = None

    return {
        'name': repository.name,
        'description': repository.description or '',
        'currentBranch': default_branch,
        'branches': branches,
        'tags': build_tags_map(repository),
        'commits': result_commits,
        'objects': encode_blob_objects(repository, blob_hashes),
    }
