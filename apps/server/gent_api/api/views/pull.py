import base64
from django.shortcuts import get_object_or_404
from rest_framework import status, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from drf_spectacular.utils import extend_schema
from drf_spectacular.types import OpenApiTypes
from api.models import Commit, Tree, Blob, Branch
from api.utils import get_repository_or_404


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

    commits_newest_first = []
    visited = set()
    current_sha = commit_sha
    while current_sha and current_sha not in visited:
        if current_sha == since:
            break
        try:
            commit = Commit.objects.get(repository=repository, sha=current_sha)
        except Commit.DoesNotExist:
            break
        commits_newest_first.append(commit)
        visited.add(current_sha)
        parents = commit.parent_shas or []
        current_sha = parents[0] if parents else None

    commits_oldest_first = list(reversed(commits_newest_first))

    result_commits = []
    blob_hashes = set()

    for commit in commits_oldest_first:
        parents = commit.parent_shas or []
        parent = parents[0] if len(parents) > 0 else None
        merge_parent = parents[1] if len(parents) > 1 else None

        try:
            tree = Tree.objects.get(repository=repository, sha=commit.tree_sha)
            raw_entries = tree.entries or []
        except Tree.DoesNotExist:
            raw_entries = []

        tree_entries = []
        for entry in raw_entries:
            tree_entries.append({
                'mode': entry.get('mode'),
                'name': entry.get('name'),
                'hash': entry.get('sha'),
                'type': entry.get('type'),
            })
            if entry.get('type') == 'blob' and entry.get('sha'):
                blob_hashes.add(entry['sha'])

        files = []
        for entry in raw_entries:
            if entry.get('sha'):
                files.append({
                    'path': entry.get('name'),
                    'hash': entry.get('sha'),
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
        if blob.content:
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
