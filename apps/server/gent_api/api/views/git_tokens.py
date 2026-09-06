import hashlib
import secrets
from datetime import timedelta

from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from api.models import PersonalAccessToken, Repository
from api.services.repository_access import user_can_read_repo, user_can_write_repo


def token_data(token):
    return {
        'id': token.pk,
        'name': token.name,
        'repository_id': token.repository_id,
        'can_write': token.can_write,
        'expires_at': token.expires_at,
        'created_at': token.created_at,
    }


@api_view(['GET', 'POST'])
@permission_classes([permissions.IsAuthenticated])
def git_token_list_create(request):
    if request.method == 'GET':
        tokens = PersonalAccessToken.objects.filter(user=request.user).order_by('-created_at')
        return Response([token_data(token) for token in tokens])

    if PersonalAccessToken.objects.filter(user=request.user).count() >= 50:
        return Response({'error': 'Revoke an existing token before creating another.'}, status=400)
    name = request.data.get('name', '')
    if not isinstance(name, str) or not name.strip() or len(name.strip()) > 100:
        return Response({'error': 'Token name must contain 1 to 100 characters.'}, status=400)
    can_write = request.data.get('can_write', False)
    if not isinstance(can_write, bool):
        return Response({'error': 'can_write must be true or false.'}, status=400)
    repository = None
    repository_id = request.data.get('repository_id')
    if repository_id is not None:
        try:
            repository = Repository.objects.get(pk=repository_id)
        except (Repository.DoesNotExist, TypeError, ValueError):
            return Response({'error': 'Repository not found.'}, status=404)
        allowed = user_can_write_repo(request.user, repository) if can_write else user_can_read_repo(request.user, repository)
        if not allowed:
            return Response({'error': 'You do not have the requested repository access.'}, status=403)
    expires_at = None
    expires_days = request.data.get('expires_days')
    if expires_days is not None:
        try:
            expires_days = int(expires_days)
        except (TypeError, ValueError):
            return Response({'error': 'expires_days must be an integer.'}, status=400)
        if not 1 <= expires_days <= 365:
            return Response({'error': 'expires_days must be between 1 and 365.'}, status=400)
        expires_at = timezone.now() + timedelta(days=expires_days)
    secret = 'gent_' + secrets.token_urlsafe(32)
    token = PersonalAccessToken.objects.create(
        user=request.user,
        name=name.strip(),
        repository=repository,
        can_write=can_write,
        expires_at=expires_at,
        digest=hashlib.sha256(secret.encode()).hexdigest(),
    )
    return Response({**token_data(token), 'username': request.user.username, 'token': secret}, status=status.HTTP_201_CREATED)


@api_view(['DELETE'])
@permission_classes([permissions.IsAuthenticated])
def git_token_delete(request, token_id):
    token = PersonalAccessToken.objects.filter(user=request.user, pk=token_id).first()
    if token is None:
        return Response({'error': 'Token not found.'}, status=404)
    token.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)
