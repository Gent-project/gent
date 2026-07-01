from django.shortcuts import get_object_or_404
from rest_framework import status, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from drf_spectacular.utils import extend_schema
from drf_spectacular.types import OpenApiTypes
from api.models import Branch
from api.utils import get_repository_or_404
from api.services.repository_export import (
    build_commits_and_blob_hashes,
    build_tree_entries_map,
    collect_commits_since,
    encode_blob_objects,
)


PULL_DESCRIPTION = (
    'Return commits and objects for a branch since a given commit hash. '
    'Commits are ordered oldest-first along the branch ancestry from HEAD '
    'back to the since commit (topological post-order), not by timestamp.'
)


@extend_schema(
    responses={200: OpenApiTypes.OBJECT, 404: OpenApiTypes.OBJECT},
    summary='Pull commits and objects',
    description=PULL_DESCRIPTION,
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

    commits_oldest_first = collect_commits_since(repository, commit_sha, since)
    tree_entries_map = build_tree_entries_map(repository)
    result_commits, blob_hashes = build_commits_and_blob_hashes(
        commits_oldest_first,
        tree_entries_map,
    )

    return Response(
        {
            'branch': branch_name,
            'commits': result_commits,
            'objects': encode_blob_objects(repository, blob_hashes),
            'head': branch.commit_sha,
        },
        status=status.HTTP_200_OK
    )
