import re

from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from drf_spectacular.utils import extend_schema
from drf_spectacular.types import OpenApiTypes
from api.models import Commit, Tree, Branch
from api.serializers import CommitSerializer, CommitCreateSerializer
from api.utils import get_repository_or_404
from api.permissions import IsRepositoryOwnerByParams


@extend_schema(
    responses={200: CommitSerializer(many=True)},
    summary='List commits',
    description='List all commits in a repository.'
)
@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def commit_list(request, owner_id, repo_name):
    """List commits in a repository."""
    repository = get_repository_or_404(owner_id, repo_name, request.user)
    commits = Commit.objects.filter(repository=repository)
    serializer = CommitSerializer(commits, many=True)
    return Response(serializer.data, status=status.HTTP_200_OK)


@extend_schema(
    request=CommitCreateSerializer,
    responses={201: CommitSerializer, 400: OpenApiTypes.OBJECT},
    summary='Create commit',
    description='Create a new commit in a repository.'
)
@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated, IsRepositoryOwnerByParams])
def commit_create(request, owner_id, repo_name):
    """Create a new commit."""
    repository = get_repository_or_404(owner_id, repo_name, request.user)

    if repository.owner != request.user:
        return Response(
            {'error': 'Only the repository owner can create commits.'},
            status=status.HTTP_403_FORBIDDEN
        )

    serializer = CommitCreateSerializer(data=request.data)

    if serializer.is_valid():
        sha = serializer.validated_data['sha']
        if not re.fullmatch(r'[0-9a-fA-F]{64}', sha):
            return Response(
                {'error': 'Commit SHA must be a valid 64-character hexadecimal string.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if Commit.objects.filter(sha=sha).exists():
            return Response(
                {'error': 'Commit with this SHA already exists.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        tree_sha = serializer.validated_data['tree_sha']
        if not Tree.objects.filter(repository=repository, sha=tree_sha).exists():
            return Response(
                {'error': f'Tree {tree_sha} does not exist.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        commit = Commit.objects.create(
            repository=repository,
            sha=sha,
            author=request.user,
            message=serializer.validated_data['message'],
            tree_sha=tree_sha,
            parent_shas=serializer.validated_data.get('parent_shas', []),
            author_name=serializer.validated_data.get('author_name', request.user.get_full_name()),
            author_email=serializer.validated_data.get('author_email', request.user.email),
            committed_at=timezone.now()
        )

        branch_name = serializer.validated_data.get('branch')
        if branch_name:
            branch = Branch.objects.filter(repository=repository, name=branch_name).first()
            if branch:
                branch.commit_sha = sha
                branch.save()

        return Response(
            {
                'message': 'Commit created successfully',
                'commit': CommitSerializer(commit).data
            },
            status=status.HTTP_201_CREATED
        )

    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@extend_schema(
    responses={200: CommitSerializer},
    summary='Get commit details',
    description='Get details of a specific commit.'
)
@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def commit_detail(request, owner_id, repo_name, sha):
    """Get commit details."""
    repository = get_repository_or_404(owner_id, repo_name, request.user)
    commit = get_object_or_404(Commit, repository=repository, sha=sha)
    serializer = CommitSerializer(commit)
    return Response(serializer.data, status=status.HTTP_200_OK)
