"""Anonymous discovery: repository search, user search, and public profiles.

Access control lives in ``api.services.repository_access``; these views only
decide *visibility* of rows. A repository is discoverable when it is public, or
when the caller already owns it or collaborates on it.
"""
from django.db.models import Case, Count, IntegerField, Prefetch, Q, When
from rest_framework import permissions, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
from drf_spectacular.utils import extend_schema, OpenApiParameter
from drf_spectacular.types import OpenApiTypes

from api.models import Repository, RepositoryMember, User
from api.serializers import PublicRepositorySerializer, PublicUserSerializer

REPO_SORTS = ('best', 'updated', 'newest', 'name')


def visible_repositories(user):
    """Repositories the caller may discover: public plus their own."""
    visibility = Q(is_private=False)
    if user is not None and user.is_authenticated:
        visibility |= Q(owner=user) | Q(members__user=user)
    queryset = Repository.objects.filter(visibility).distinct().select_related('owner')
    if user is not None and user.is_authenticated:
        # Lets RepositorySerializer.get_role read _user_membership without N+1.
        queryset = queryset.prefetch_related(
            Prefetch(
                'members',
                queryset=RepositoryMember.objects.filter(user=user),
                to_attr='_user_membership',
            )
        )
    return queryset


def apply_repo_query(queryset, query):
    """Filter by a free-text query, honouring the ``owner/name`` qualifier."""
    if not query:
        return queryset
    if '/' in query:
        owner_part, _, name_part = query.partition('/')
        owner_part, name_part = owner_part.strip(), name_part.strip()
        if owner_part:
            queryset = queryset.filter(owner__username__iexact=owner_part)
        if name_part:
            queryset = queryset.filter(name__icontains=name_part)
        return queryset
    return queryset.filter(
        Q(name__icontains=query)
        | Q(description__icontains=query)
        | Q(owner__username__icontains=query)
    )


def order_repositories(queryset, sort, query):
    """Order results. ``best`` ranks exact then prefix name matches first."""
    if sort == 'name':
        return queryset.order_by('name', 'owner__username')
    if sort == 'newest':
        return queryset.order_by('-created_at')
    if sort == 'updated':
        return queryset.order_by('-updated_at')
    if not query or '/' in query:
        return queryset.order_by('-updated_at')
    return queryset.annotate(
        match_rank=Case(
            When(name__iexact=query, then=0),
            When(name__istartswith=query, then=1),
            When(name__icontains=query, then=2),
            default=3,
            output_field=IntegerField(),
        )
    ).order_by('match_rank', '-updated_at')


def paginated(request, queryset, serializer_class):
    """Return a ``{count, next, previous, results}`` response."""
    paginator = PageNumberPagination()
    page = paginator.paginate_queryset(queryset, request)
    serializer = serializer_class(page, many=True, context={'request': request})
    return paginator.get_paginated_response(serializer.data)


@extend_schema(
    parameters=[
        OpenApiParameter('q', OpenApiTypes.STR, description='Free text, or "owner/name".'),
        OpenApiParameter('sort', OpenApiTypes.STR, enum=list(REPO_SORTS)),
    ],
    responses={200: PublicRepositorySerializer(many=True)},
    summary='Search repositories',
    description=(
        'Search public repositories. Authenticated callers also match their own '
        'private repositories and those they collaborate on. Paginated.'
    ),
)
@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def repository_search(request):
    """Search discoverable repositories."""
    query = request.GET.get('q', '').strip()
    sort = request.GET.get('sort', 'best')
    if sort not in REPO_SORTS:
        sort = 'best'

    queryset = apply_repo_query(visible_repositories(request.user), query)
    queryset = order_repositories(queryset, sort, query)
    return paginated(request, queryset, PublicRepositorySerializer)


@extend_schema(
    parameters=[OpenApiParameter('q', OpenApiTypes.STR)],
    responses={200: PublicUserSerializer(many=True)},
    summary='Search users',
    description='Search active users by username or name. Emails are never matched or returned.',
)
@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def user_search(request):
    """Search users by public identity."""
    query = request.GET.get('q', '').strip()
    queryset = User.objects.filter(is_active=True)
    if query:
        queryset = queryset.filter(
            Q(username__icontains=query)
            | Q(first_name__icontains=query)
            | Q(last_name__icontains=query)
        )
    queryset = queryset.annotate(
        public_repo_count=Count(
            'repositories',
            filter=Q(repositories__is_private=False),
            distinct=True,
        ),
        match_rank=Case(
            When(username__iexact=query, then=0),
            When(username__istartswith=query, then=1),
            default=2,
            output_field=IntegerField(),
        ),
    ).order_by('match_rank', '-public_repo_count', 'username')
    return paginated(request, queryset, PublicUserSerializer)


@extend_schema(
    responses={200: OpenApiTypes.OBJECT, 404: OpenApiTypes.OBJECT},
    summary='Public user profile',
    description='Public profile for a user plus the repositories the caller may see.',
)
@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def public_user_detail(request, owner_ref):
    """Return a user's public profile and their visible repositories."""
    user = User.objects.resolve_public_ref(owner_ref)
    if not user.is_active:
        return Response({'error': 'User not found.'}, status=status.HTTP_404_NOT_FOUND)

    user.public_repo_count = Repository.objects.filter(
        owner=user,
        is_private=False,
    ).count()
    repositories = visible_repositories(request.user).filter(owner=user).order_by('-updated_at')

    return Response(
        {
            'user': PublicUserSerializer(user, context={'request': request}).data,
            'repositories': PublicRepositorySerializer(
                repositories,
                many=True,
                context={'request': request},
            ).data,
        },
        status=status.HTTP_200_OK,
    )
