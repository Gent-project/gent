from django.shortcuts import get_object_or_404
from rest_framework import status, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from drf_spectacular.utils import extend_schema
from drf_spectacular.types import OpenApiTypes
from ..models import Tree, Blob
from ..serializers import TreeSerializer, TreeCreateSerializer, BlobSerializer, BlobCreateSerializer
from ..utils import calculate_sha1, save_blob_content, get_repository_or_404
from ..permissions import IsRepositoryOwnerByParams


@extend_schema(
    request=TreeCreateSerializer,
    responses={201: TreeSerializer, 400: OpenApiTypes.OBJECT},
    summary='Create tree',
    description='Create a new tree object in a repository.'
)
@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated, IsRepositoryOwnerByParams])
def tree_create(request, owner_id, repo_name):
    """Create a new tree."""
    repository = get_repository_or_404(owner_id, repo_name, request.user)

    if repository.owner != request.user:
        return Response(
            {'error': 'Only the repository owner can create trees.'},
            status=status.HTTP_403_FORBIDDEN
        )

    serializer = TreeCreateSerializer(data=request.data)

    if serializer.is_valid():
        entries = serializer.validated_data['entries']

        tree_content = ""
        for entry in entries:
            tree_content += f"{entry['mode']} {entry['type']} {entry['sha']}\t{entry['name']}\n"

        sha = calculate_sha1(tree_content)

        tree, created = Tree.objects.get_or_create(
            repository=repository,
            sha=sha,
            defaults={'entries': entries}
        )

        return Response(
            {
                'message': 'Tree created successfully' if created else 'Tree already exists',
                'tree': TreeSerializer(tree).data
            },
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK
        )

    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@extend_schema(
    responses={200: TreeSerializer},
    summary='Get tree',
    description='Get a tree object by SHA.'
)
@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def tree_detail(request, owner_id, repo_name, sha):
    """Get tree details."""
    repository = get_repository_or_404(owner_id, repo_name, request.user)
    tree = get_object_or_404(Tree, repository=repository, sha=sha)
    serializer = TreeSerializer(tree)
    return Response(serializer.data, status=status.HTTP_200_OK)


@extend_schema(
    request=BlobCreateSerializer,
    responses={201: BlobSerializer, 400: OpenApiTypes.OBJECT},
    summary='Create blob',
    description='Create a new blob object (file content) in a repository.'
)
@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated, IsRepositoryOwnerByParams])
def blob_create(request, owner_id, repo_name):
    """Create a new blob."""
    repository = get_repository_or_404(owner_id, repo_name, request.user)

    if repository.owner != request.user:
        return Response(
            {'error': 'Only the repository owner can create blobs.'},
            status=status.HTTP_403_FORBIDDEN
        )

    serializer = BlobCreateSerializer(data=request.data)

    if serializer.is_valid():
        content = serializer.validated_data['content']
        encoding = serializer.validated_data.get('encoding', 'utf-8')

        sha = calculate_sha1(content)

        blob_data = save_blob_content(repository, sha, content, encoding)

        blob, created = Blob.objects.get_or_create(
            repository=repository,
            sha=sha,
            defaults=blob_data
        )

        return Response(
            {
                'message': 'Blob created successfully' if created else 'Blob already exists',
                'blob': BlobSerializer(blob).data
            },
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK
        )

    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@extend_schema(
    responses={200: BlobSerializer},
    summary='Get blob',
    description='Get a blob object by SHA.'
)
@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def blob_detail(request, owner_id, repo_name, sha):
    """Get blob details."""
    repository = get_repository_or_404(owner_id, repo_name, request.user)
    blob = get_object_or_404(Blob, repository=repository, sha=sha)

    if blob.file_path and not blob.content:
        with open(blob.file_path, 'rb') as f:
            content = f.read().decode('utf-8', errors='replace')
            blob.content = content

    serializer = BlobSerializer(blob)
    return Response(serializer.data, status=status.HTTP_200_OK)
