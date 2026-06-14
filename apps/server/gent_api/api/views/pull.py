import base64
from django.shortcuts import get_object_or_404
from rest_framework import status, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from drf_spectacular.utils import extend_schema
from drf_spectacular.types import OpenApiTypes
from api.models import Commit, Tree, Blob, Branch
from api.utils import get_repository_or_404


def _collect_commits_since(repository, head_sha, since_sha):
    commit_map = {
        commit.sha: commit
        for commit in Commit.objects.filter(repository=repository)
    }
    ordered_commits = []
    visited = set()

    def visit(commit_sha):
        if not commit_sha or commit_sha == since_sha or commit_sha in visited:
            return

        visited.add(commit_sha)
        commit = commit_map.get(commit_sha)
        if not commit:
            return

        for parent_sha in commit.parent_shas or []:
            visit(parent_sha)

        ordered_commits.append(commit)

    visit(head_sha)
    return ordered_commits


def _flatten_tree_entries(tree_entries_map, root_tree_sha):
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

    return flattened_entries, blob_hashes


@extend_schema(
    responses={200: OpenApiTypes.OBJECT, 404: OpenApiTypes.OBJECT},
    summary='Pull commits and objects',
    description='Return commits and objects for a branch since a given commit hash.'
)
@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def pull(request, owner_id, repo_name):
    repository = get_repository_or_404(owner_id, repo_name, request.user)
    branch_name = request.query_params.get('branch')
    if not branch_name:
        return Response(
            {'error': 'branch query parameter is required.'},
            status=status.HTTP_400_BAD_REQUEST
        )
    branch = get_object_or_404(Branch, repository=repository, name=branch_name)

    commit_sha = branch.commit_sha
    if not commit_sha or commit_sha == '0' * 64:
        return Response(
            {
                'branch': branch_name,
                'commits': [],
                'objects': [],
                'head': None
            },
            status=status.HTTP_200_OK
        )

    since = request.query_params.get('since', '')

    commits_oldest_first = _collect_commits_since(repository, commit_sha, since)
    tree_entries_map = {
        tree.sha: tree.entries or []
        for tree in Tree.objects.filter(repository=repository)
    }

    result_commits = []
    blob_hashes = []
    seen_blob_hashes = set()

    for commit in commits_oldest_first:
        parents = commit.parent_shas or []
        parent = parents[0] if len(parents) > 0 else None
        merge_parent = parents[1] if len(parents) > 1 else None

        tree_entries, commit_blob_hashes = _flatten_tree_entries(tree_entries_map, commit.tree_sha)
        for blob_sha in commit_blob_hashes:
            if blob_sha not in seen_blob_hashes:
                blob_hashes.append(blob_sha)
                seen_blob_hashes.add(blob_sha)

        files = []
        for entry in tree_entries:
            if entry.get('type') == 'blob' and entry.get('hash'):
                files.append({
                    'path': entry.get('name'),
                    'hash': entry.get('hash'),
                })

        result_commits.append({
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
        })

    blobs = {}
    if blob_hashes:
        for blob in Blob.objects.filter(repository=repository, sha__in=blob_hashes):
            blobs[blob.sha] = blob

    objects = []
    for h in blob_hashes:
        blob = blobs.get(h)
        if not blob:
            continue
        if blob.content is not None:
            data = base64.b64encode(blob.content.encode('utf-8')).decode('ascii')
        elif blob.file_path:
            try:
                with open(blob.file_path, 'rb') as f:
                    data = base64.b64encode(f.read()).decode('ascii')
            except (FileNotFoundError, OSError):
                data = ''
        else:
            data = ''
        objects.append({
            'hash': blob.sha,
            'type': 'blob',
            'data': data,
        })

    return Response(
        {
            'branch': branch_name,
            'commits': result_commits,
            'objects': objects,
            'head': branch.commit_sha,
        },
        status=status.HTTP_200_OK
    )
