from django.shortcuts import get_object_or_404
from rest_framework import status, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from drf_spectacular.utils import extend_schema
from drf_spectacular.types import OpenApiTypes
from api.models import Tag, Commit
from api.serializers import TagSerializer, TagCreateSerializer
from api.utils import get_repository_or_404
from api.permissions import IsRepositoryOwnerByParams


@extend_schema(
    responses={200: TagSerializer(many=True)},
    summary='List tags',
    description='List all tags in a repository.'
)
@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def tag_list(request, owner_id, repo_name):
    """List tags in a repository."""
    repository = get_repository_or_404(owner_id, repo_name, request.user)
    tags = Tag.objects.filter(repository=repository)
    serializer = TagSerializer(tags, many=True)
    return Response(serializer.data, status=status.HTTP_200_OK)


@extend_schema(
    request=TagCreateSerializer,
    responses={201: TagSerializer, 400: OpenApiTypes.OBJECT, 403: OpenApiTypes.OBJECT},
    summary='Create tag',
    description='Create a new tag in a repository. Only the repository owner can create tags.'
)
@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated, IsRepositoryOwnerByParams])
def tag_create(request, owner_id, repo_name):
    """Create a new tag."""
    repository = get_repository_or_404(owner_id, repo_name, request.user)

    if repository.owner != request.user:
        return Response(
            {'error': 'Only the repository owner can create tags.'},
            status=status.HTTP_403_FORBIDDEN
        )

    serializer = TagCreateSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    commit_sha = serializer.validated_data['commit_sha']
    if not Commit.objects.filter(repository=repository, sha=commit_sha).exists():
        return Response(
            {'error': f'Commit {commit_sha} does not exist.'},
            status=status.HTTP_400_BAD_REQUEST
        )

    tag, created = Tag.objects.update_or_create(
        repository=repository,
        name=serializer.validated_data['name'],
        defaults={
            'commit_sha': commit_sha,
            'message': serializer.validated_data.get('message', ''),
            'annotated': serializer.validated_data.get('annotated', False),
            'tagger_name': serializer.validated_data.get('tagger_name', ''),
            'tagger_email': serializer.validated_data.get('tagger_email', ''),
        }
    )

    status_code = status.HTTP_201_CREATED if created else status.HTTP_200_OK
    return Response(
        {
            'message': 'Tag created successfully',
            'tag': TagSerializer(tag).data
        },
        status=status_code
    )


@extend_schema(
    responses={200: OpenApiTypes.OBJECT, 403: OpenApiTypes.OBJECT},
    summary='Delete tag',
    description='Delete a tag. Only the repository owner can delete tags.'
)
@api_view(['DELETE'])
@permission_classes([permissions.IsAuthenticated, IsRepositoryOwnerByParams])
def tag_delete(request, owner_id, repo_name, tag_name):
    """Delete a tag."""
    repository = get_repository_or_404(owner_id, repo_name, request.user)

    if repository.owner != request.user:
        return Response(
            {'error': 'Only the repository owner can delete tags.'},
            status=status.HTTP_403_FORBIDDEN
        )

    tag = get_object_or_404(Tag, repository=repository, name=tag_name)
    tag.delete()
    return Response(
        {'message': 'Tag deleted successfully'},
        status=status.HTTP_200_OK
    )
