from django.shortcuts import get_object_or_404
from rest_framework import status, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from drf_spectacular.utils import extend_schema
from drf_spectacular.types import OpenApiTypes
from api.models import Branch, Commit
from api.serializers import BranchSerializer, BranchCreateSerializer, BranchPatchSerializer
from api.utils import get_repository_or_404
from api.permissions import IsRepositoryOwnerByParams


@extend_schema(
    responses={200: BranchSerializer(many=True)},
    summary='List branches',
    description='List all branches in a repository.'
)
@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def branch_list(request, owner_id, repo_name):
    """List branches in a repository."""
    repository = get_repository_or_404(owner_id, repo_name, request.user)
    branches = Branch.objects.filter(repository=repository)
    serializer = BranchSerializer(branches, many=True)
    return Response(serializer.data, status=status.HTTP_200_OK)


@extend_schema(
    request=BranchCreateSerializer,
    responses={201: BranchSerializer, 400: OpenApiTypes.OBJECT},
    summary='Create branch',
    description='Create a new branch in a repository.'
)
@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated, IsRepositoryOwnerByParams])
def branch_create(request, owner_id, repo_name):
    """Create a new branch."""
    repository = get_repository_or_404(owner_id, repo_name, request.user)

    if repository.owner != request.user:
        return Response(
            {'error': 'Only the repository owner can create branches.'},
            status=status.HTTP_403_FORBIDDEN
        )

    serializer = BranchCreateSerializer(data=request.data)

    if serializer.is_valid():
        if Branch.objects.filter(
            repository=repository,
            name=serializer.validated_data['name']
        ).exists():
            return Response(
                {'error': 'Branch with this name already exists.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        branch = Branch.objects.create(
            repository=repository,
            **serializer.validated_data
        )

        return Response(
            {
                'message': 'Branch created successfully',
                'branch': BranchSerializer(branch).data
            },
            status=status.HTTP_201_CREATED
        )

    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@extend_schema(
    methods=['GET'],
    responses={200: BranchSerializer},
    summary='Get branch details',
    description='Get details of a specific branch.'
)
@extend_schema(
    methods=['PATCH'],
    request=BranchPatchSerializer,
    responses={200: BranchSerializer, 400: OpenApiTypes.OBJECT, 403: OpenApiTypes.OBJECT},
    summary='Update branch pointer',
    description='Move branch to a new commit SHA. Only the repository owner can update.'
)
@extend_schema(
    methods=['DELETE'],
    responses={200: OpenApiTypes.OBJECT, 400: OpenApiTypes.OBJECT, 403: OpenApiTypes.OBJECT},
    summary='Delete branch',
    description='Delete a branch. Cannot delete the default branch. Only the repository owner can delete.'
)
@api_view(['GET', 'PATCH', 'DELETE'])
@permission_classes([permissions.IsAuthenticated])
def branch_detail(request, owner_id, repo_name, branch_name):
    """Get, update, or delete branch details."""
    repository = get_repository_or_404(owner_id, repo_name, request.user)
    branch = get_object_or_404(Branch, repository=repository, name=branch_name)

    if request.method == 'GET':
        serializer = BranchSerializer(branch)
        return Response(serializer.data, status=status.HTTP_200_OK)

    elif request.method == 'PATCH':
        if repository.owner != request.user:
            return Response(
                {'error': 'Only the repository owner can update branches.'},
                status=status.HTTP_403_FORBIDDEN
            )

        serializer = BranchPatchSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        commit_sha = serializer.validated_data['commit_sha']
        if not Commit.objects.filter(repository=repository, sha=commit_sha).exists():
            return Response(
                {'error': f'Commit {commit_sha} does not exist.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        branch.commit_sha = commit_sha
        branch.save()
        return Response(BranchSerializer(branch).data, status=status.HTTP_200_OK)

    elif request.method == 'DELETE':
        if repository.owner != request.user:
            return Response(
                {'error': 'Only the repository owner can delete branches.'},
                status=status.HTTP_403_FORBIDDEN
            )

        if branch.name == repository.default_branch:
            return Response(
                {'error': 'Cannot delete the default branch.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        branch.delete()
        return Response(
            {'message': 'Branch deleted successfully'},
            status=status.HTTP_200_OK
        )



