import shutil
from rest_framework import status, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from drf_spectacular.utils import extend_schema
from drf_spectacular.types import OpenApiTypes
from ..models import Repository, Branch
from ..serializers import RepositorySerializer, RepositoryCreateSerializer
from ..utils import get_repository_or_404
from ..permissions import IsRepositoryOwnerByParams


@extend_schema(
    responses={200: RepositorySerializer(many=True)},
    summary='List repositories',
    description='List all repositories owned by the authenticated user.'
)
@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def repository_list(request):
    """List user's repositories."""
    repositories = Repository.objects.filter(owner=request.user)
    serializer = RepositorySerializer(repositories, many=True)
    return Response(serializer.data, status=status.HTTP_200_OK)


@extend_schema(
    request=RepositoryCreateSerializer,
    responses={201: RepositorySerializer, 400: OpenApiTypes.OBJECT},
    summary='Create repository',
    description='Create a new repository for the authenticated user.'
)
@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def repository_create(request):
    """Create a new repository."""
    serializer = RepositoryCreateSerializer(data=request.data)

    if serializer.is_valid():
        if Repository.objects.filter(
            owner=request.user,
            name=serializer.validated_data['name']
        ).exists():
            return Response(
                {'error': 'Repository with this name already exists.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        repository = Repository.objects.create(
            owner=request.user,
            **serializer.validated_data
        )

        Branch.objects.create(
            repository=repository,
            name=repository.default_branch,
            commit_sha='0' * 40
        )

        return Response(
            {
                'message': 'Repository created successfully',
                'repository': RepositorySerializer(repository).data
            },
            status=status.HTTP_201_CREATED
        )

    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@extend_schema(
    responses={200: RepositorySerializer},
    summary='Get repository details',
    description='Get details of a specific repository.'
)
@api_view(['GET', 'PATCH'])
@permission_classes([permissions.IsAuthenticated, IsRepositoryOwnerByParams])
def repository_detail(request, owner_id, repo_name):
    """Get or update repository details."""
    repository = get_repository_or_404(owner_id, repo_name, request.user)

    if request.method == 'GET':
        serializer = RepositorySerializer(repository)
        return Response(serializer.data, status=status.HTTP_200_OK)

    elif request.method == 'PATCH':
        if repository.owner != request.user:
            return Response(
                {'error': 'Only the repository owner can update it.'},
                status=status.HTTP_403_FORBIDDEN
            )

        serializer = RepositorySerializer(
            repository,
            data=request.data,
            partial=True
        )

        if serializer.is_valid():
            serializer.save()
            return Response(
                {
                    'message': 'Repository updated successfully',
                    'repository': serializer.data
                },
                status=status.HTTP_200_OK
            )

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@extend_schema(
    responses={200: OpenApiTypes.OBJECT},
    summary='Delete repository',
    description='Delete a repository. Only the owner can delete.'
)
@api_view(['DELETE'])
@permission_classes([permissions.IsAuthenticated, IsRepositoryOwnerByParams])
def repository_delete(request, owner_id, repo_name):
    """Delete a repository."""
    repository = get_repository_or_404(owner_id, repo_name, request.user)

    if repository.owner != request.user:
        return Response(
            {'error': 'Only the repository owner can delete it.'},
            status=status.HTTP_403_FORBIDDEN
        )

    storage_path = repository.get_storage_path()
    if storage_path.exists():
        shutil.rmtree(storage_path)

    repository.delete()

    return Response(
        {'message': 'Repository deleted successfully'},
        status=status.HTTP_200_OK
    )
