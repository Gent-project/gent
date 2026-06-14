"""
Commit diff endpoint.

Computes "what changed in a commit" entirely on the server by comparing the
commit's tree to its first parent's tree, then producing a unified line diff for
each changed text blob. This is the server-side counterpart of the algorithm the
web client previously had to run in the browser (it can now just call this).

Strategy (same shape as Git):
  1. `_diff_trees` walks both trees in lock-step, descending only into subtrees
     whose sha differs (identical subtrees are pruned), and emits one
     {added|removed|modified} record per changed file.
  2. For each changed text blob we load the old/new content and run a unified
     line diff via `difflib.SequenceMatcher.get_grouped_opcodes` (hunks + 3
     lines of context, exactly like `diff -u`).
"""
import difflib

from django.shortcuts import get_object_or_404
from rest_framework import status, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from drf_spectacular.utils import extend_schema
from drf_spectacular.types import OpenApiTypes

from api.models import Commit, Tree, Blob
from api.serializers import CommitSerializer
from api.utils import get_repository_or_404

# Above this many DP cells (len(old) * len(new)) we skip the inline line diff to
# keep the request bounded; the file is reported as changed with `too_large`.
MAX_DIFF_CELLS = 1_500_000


def _is_empty_sha(sha):
    """True for the all-zero placeholder sha given to empty trees/branches."""
    return not sha or set(sha) == {'0'}


def _split_lines(text):
    """Split into lines, normalising CRLF and dropping a single trailing newline."""
    if not text:
        return []
    text = text.replace('\r\n', '\n')
    if text.endswith('\n'):
        text = text[:-1]
    return text.split('\n')


def _load_entries(repository, tree_sha, cache):
    """Return a tree's entry list for a sha (cached), or [] if missing/empty."""
    if _is_empty_sha(tree_sha):
        return []
    if tree_sha in cache:
        return cache[tree_sha]
    tree = Tree.objects.filter(repository=repository, sha=tree_sha).first()
    entries = tree.entries if tree else []
    cache[tree_sha] = entries
    return entries


def _read_blob(repository, sha, cache):
    """Return (text, is_binary) for a blob sha. text is None when binary."""
    if sha in cache:
        return cache[sha]
    blob = Blob.objects.filter(repository=repository, sha=sha).first()
    result = ('', False)
    if blob is not None:
        content = blob.content
        if not content and blob.file_path:
            import base64  # local import: only on-disk blobs need it
            try:
                with open(blob.file_path, 'rb') as fh:
                    raw = fh.read()
                try:
                    content = raw.decode('utf-8')
                except UnicodeDecodeError:
                    result = (None, True)
                    cache[sha] = result
                    return result
            except (FileNotFoundError, OSError):
                content = ''
        result = (content or '', False)
    cache[sha] = result
    return result


def _collect_side(repository, entry, path, change_status, tree_cache, out):
    """Emit every blob under one side of an added/removed entry."""
    if entry['type'] != 'tree':
        record = {'path': path, 'status': change_status}
        record['new_sha' if change_status == 'added' else 'old_sha'] = entry['sha']
        out.append(record)
        return
    for sub in _load_entries(repository, entry['sha'], tree_cache):
        _collect_side(repository, sub, f"{path}/{sub['name']}", change_status, tree_cache, out)


def _diff_trees(repository, old_sha, new_sha, prefix, tree_cache, out):
    """Recursively diff two trees, pruning identical subtrees by sha."""
    if old_sha and new_sha and old_sha == new_sha:
        return

    old_by_name = {e['name']: e for e in _load_entries(repository, old_sha, tree_cache)}
    new_by_name = {e['name']: e for e in _load_entries(repository, new_sha, tree_cache)}

    for name in set(old_by_name) | set(new_by_name):
        old = old_by_name.get(name)
        new = new_by_name.get(name)
        path = f"{prefix}/{name}" if prefix else name

        if old and new:
            if old['sha'] == new['sha']:
                continue  # identical subtree/blob — prune
            old_is_tree = old['type'] == 'tree'
            new_is_tree = new['type'] == 'tree'
            if old_is_tree and new_is_tree:
                _diff_trees(repository, old['sha'], new['sha'], path, tree_cache, out)
            elif not old_is_tree and not new_is_tree:
                out.append({'path': path, 'status': 'modified',
                            'old_sha': old['sha'], 'new_sha': new['sha']})
            else:  # file <-> directory swap: model as remove + add
                _collect_side(repository, old, path, 'removed', tree_cache, out)
                _collect_side(repository, new, path, 'added', tree_cache, out)
        elif new:
            _collect_side(repository, new, path, 'added', tree_cache, out)
        elif old:
            _collect_side(repository, old, path, 'removed', tree_cache, out)


def _fmt_range(start, stop):
    """Format a unified-diff hunk range (mirrors difflib's own formatter)."""
    length = stop - start
    if length == 0:
        return f"{start},0"
    if length == 1:
        return f"{start + 1}"
    return f"{start + 1},{length}"


def _line_diff(old_text, new_text):
    """Unified line diff -> (lines, additions, deletions)."""
    old_lines = _split_lines(old_text)
    new_lines = _split_lines(new_text)
    matcher = difflib.SequenceMatcher(a=old_lines, b=new_lines, autojunk=False)

    lines = []
    additions = 0
    deletions = 0
    for group in matcher.get_grouped_opcodes(n=3):
        first, last = group[0], group[-1]
        lines.append({
            'kind': 'hunk',
            'text': f"@@ -{_fmt_range(first[1], last[2])} +{_fmt_range(first[3], last[4])} @@",
        })
        for tag, i1, i2, j1, j2 in group:
            if tag == 'equal':
                for off in range(i2 - i1):
                    lines.append({'kind': 'context', 'text': old_lines[i1 + off],
                                  'old': i1 + off + 1, 'new': j1 + off + 1})
            else:
                if tag in ('replace', 'delete'):
                    for i in range(i1, i2):
                        lines.append({'kind': 'del', 'text': old_lines[i], 'old': i + 1})
                        deletions += 1
                if tag in ('replace', 'insert'):
                    for j in range(j1, j2):
                        lines.append({'kind': 'add', 'text': new_lines[j], 'new': j + 1})
                        additions += 1
    return lines, additions, deletions


@extend_schema(
    responses={200: OpenApiTypes.OBJECT, 404: OpenApiTypes.OBJECT},
    summary='Get commit diff',
    description="Return the diff of a commit against its first parent: a list of "
                "added/removed/modified files, each with a unified line diff.",
)
@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def commit_diff(request, owner_id, repo_name, sha):
    """Compute and return the diff for a single commit."""
    repository = get_repository_or_404(owner_id, repo_name, request.user)
    commit = get_object_or_404(Commit, repository=repository, sha=sha)

    parent_sha = commit.parent_shas[0] if commit.parent_shas else None
    old_tree_sha = None
    if parent_sha:
        parent = Commit.objects.filter(repository=repository, sha=parent_sha).first()
        old_tree_sha = parent.tree_sha if parent else None

    tree_cache = {}
    blob_cache = {}
    raw_changes = []
    _diff_trees(repository, old_tree_sha, commit.tree_sha, '', tree_cache, raw_changes)
    raw_changes.sort(key=lambda c: c['path'])

    files = []
    total_additions = 0
    total_deletions = 0
    for change in raw_changes:
        old_text, old_binary = (
            _read_blob(repository, change['old_sha'], blob_cache)
            if change.get('old_sha') else ('', False)
        )
        new_text, new_binary = (
            _read_blob(repository, change['new_sha'], blob_cache)
            if change.get('new_sha') else ('', False)
        )
        binary = old_binary or new_binary

        entry = {
            'path': change['path'],
            'status': change['status'],
            'old_sha': change.get('old_sha'),
            'new_sha': change.get('new_sha'),
            'binary': binary,
            'too_large': False,
            'additions': 0,
            'deletions': 0,
            'lines': [],
        }

        if not binary:
            old_lines = _split_lines(old_text or '')
            new_lines = _split_lines(new_text or '')
            if old_lines and new_lines and len(old_lines) * len(new_lines) > MAX_DIFF_CELLS:
                entry['too_large'] = True
            else:
                lines, additions, deletions = _line_diff(old_text or '', new_text or '')
                entry['lines'] = lines
                entry['additions'] = additions
                entry['deletions'] = deletions
                total_additions += additions
                total_deletions += deletions

        files.append(entry)

    return Response(
        {
            'commit': CommitSerializer(commit).data,
            'parent_sha': parent_sha,
            'files': files,
            'additions': total_additions,
            'deletions': total_deletions,
        },
        status=status.HTTP_200_OK,
    )
