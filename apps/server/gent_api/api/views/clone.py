from rest_framework import permissions, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from drf_spectacular.utils import extend_schema
from drf_spectacular.types import OpenApiTypes
from api.utils import get_repository_or_404
from api.services.repository_export import build_clone_payload


CLONE_DESCRIPTION = (
    'Return all commits, blobs, branches, and tags in one response. '
    'Commits are ordered by committed_at ascending (chronological), '
    'which differs from pull ordering. Clients should rely on parent and '
    'mergeParent links rather than array position.'
)


@extend_schema(
    responses={
        200: OpenApiTypes.OBJECT,
        401: OpenApiTypes.OBJECT,
        403: OpenApiTypes.OBJECT,
        404: OpenApiTypes.OBJECT,
    },
    summary='Clone repository',
    description=CLONE_DESCRIPTION,
)
@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def clone(request, owner_id, repo_name):
    """Export full repository data for clone."""
    repository = get_repository_or_404(owner_id, repo_name, request.user)
    return Response(build_clone_payload(repository), status=status.HTTP_200_OK)
