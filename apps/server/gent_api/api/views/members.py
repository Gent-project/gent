from django.shortcuts import get_object_or_404
from rest_framework import status, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from drf_spectacular.utils import extend_schema
from drf_spectacular.types import OpenApiTypes
from api.models import User, RepositoryMember
from api.serializers.member import (
    RepositoryMemberSerializer,
    RepositoryMemberAddSerializer,
)
from api.utils import get_repository_or_404
from api.services.repository_access import user_can_manage_repo


@extend_schema(
    methods=['GET'],
    responses={200: RepositoryMemberSerializer(many=True)},
    summary='List repository members',
    description='List the repository owner and all members with access.'
)
@extend_schema(
    methods=['POST'],
    request=RepositoryMemberAddSerializer,
    responses={201: RepositoryMemberSerializer, 400: OpenApiTypes.OBJECT, 403: OpenApiTypes.OBJECT},
    summary='Add repository member',
    description='Add a collaborator by email. Only the repository owner can add members.'
)
@api_view(['GET', 'POST'])
@permission_classes([permissions.IsAuthenticated])
def member_list(request, owner_id, repo_name):
    """List or add repository members."""
    repository = get_repository_or_404(owner_id, repo_name, request.user)

    if request.method == 'GET':
        members = RepositoryMember.objects.filter(
            repository=repository
        ).select_related('user')
        member_data = RepositoryMemberSerializer.list_for_repository(repository, members)
        return Response(member_data, status=status.HTTP_200_OK)

    if not user_can_manage_repo(request.user, repository):
        return Response(
            {'error': 'Only the repository owner can manage members.'},
            status=status.HTTP_403_FORBIDDEN,
        )

    serializer = RepositoryMemberAddSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    email = serializer.validated_data['email']
    role = serializer.validated_data['role']
    target_user = User.objects.get(email=email)

    if target_user.id == repository.owner_id:
        return Response(
            {'error': 'The repository owner cannot be added as a member.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if RepositoryMember.objects.filter(repository=repository, user=target_user).exists():
        return Response(
            {'error': 'User is already a member of this repository.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    member = RepositoryMember.objects.create(
        repository=repository,
        user=target_user,
        role=role,
        added_by=request.user,
    )

    return Response(
        {
            'message': 'Member added successfully',
            'member': RepositoryMemberSerializer(member).data,
        },
        status=status.HTTP_201_CREATED,
    )


@extend_schema(
    responses={200: OpenApiTypes.OBJECT, 403: OpenApiTypes.OBJECT, 404: OpenApiTypes.OBJECT},
    summary='Remove repository member',
    description='Remove a collaborator. Only the repository owner can remove members.'
)
@api_view(['DELETE'])
@permission_classes([permissions.IsAuthenticated])
def member_remove(request, owner_id, repo_name, user_id):
    """Remove a repository member."""
    repository = get_repository_or_404(owner_id, repo_name, request.user)

    if not user_can_manage_repo(request.user, repository):
        return Response(
            {'error': 'Only the repository owner can manage members.'},
            status=status.HTTP_403_FORBIDDEN,
        )

    if int(user_id) == repository.owner_id:
        return Response(
            {'error': 'The repository owner cannot be removed via this endpoint.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    member = get_object_or_404(RepositoryMember, repository=repository, user_id=user_id)
    member.delete()

    return Response(
        {'message': 'Member removed successfully'},
        status=status.HTTP_200_OK,
    )
