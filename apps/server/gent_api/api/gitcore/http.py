"""Exact smart-HTTP endpoints with repository-scoped token authentication."""
import base64
import binascii
import hashlib
from django.http import HttpResponse, JsonResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.contrib.auth.models import AnonymousUser
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework.exceptions import APIException
from api.models import PersonalAccessToken, Repository, User
from api.services.repository_access import user_can_read_repo, user_can_write_repo
from .objects import GitError
from .pack import MAX_BYTES
from . import protocol


def token_valid(token, repository, write):
    return (token.user.is_active and (not token.repository_id or token.repository_id == repository.pk)
            and (not write or token.can_write) and (not token.expires_at or token.expires_at > timezone.now()))


def authenticate(request, repository, write):
    header = request.headers.get('Authorization', '')
    if header.startswith('Basic '):
        try:
            username, secret = base64.b64decode(header[6:], validate=True).decode().split(':', 1)
        except (ValueError, UnicodeError, binascii.Error):
            raise GitError('invalid Basic credentials') from None
        token = PersonalAccessToken.objects.select_related('user').filter(
            digest=hashlib.sha256(secret.encode()).hexdigest()).first()
        if not token or username not in (token.user.username, token.user.email) or not token_valid(token, repository, write):
            raise GitError('invalid or expired token')
        return token.user, lambda repo: any(token_valid(t, repo, write) for t in
            PersonalAccessToken.objects.select_related('user').filter(pk=token.pk))
    if header.startswith('Bearer '):
        result = JWTAuthentication().authenticate(request)
        if not result:
            raise GitError('invalid Bearer credentials')
        return result[0], None
    if header:
        raise GitError('unsupported authentication scheme')
    return AnonymousUser(), None


@csrf_exempt
def smart_http(request, owner_ref, repo_name, endpoint):
    migration_info = endpoint == 'gent-migration'
    service = 'git-upload-pack' if migration_info else (request.GET.get('service') if endpoint == 'info/refs' else endpoint)
    if service not in ('git-upload-pack', 'git-receive-pack'):
        return HttpResponse('unsupported service', status=400)
    if request.method != ('GET' if endpoint == 'info/refs' or migration_info else 'POST'):
        return HttpResponse(status=405)
    owner = User.objects.resolve_public_ref(owner_ref)
    repository = get_object_or_404(Repository, owner=owner, name=repo_name)
    write = service == 'git-receive-pack'
    try:
        user, authorize = authenticate(request, repository, write)
    except (GitError, APIException):
        response = HttpResponse('authentication required', status=401)
        response['WWW-Authenticate'] = 'Basic realm="Gent"'
        return response
    permitted = user_can_write_repo(user, repository) if write else user_can_read_repo(user, repository)
    if not permitted:
        response = HttpResponse('authentication required' if not user.is_authenticated else 'permission denied',
                                status=401 if not user.is_authenticated else 403)
        if not user.is_authenticated:
            response['WWW-Authenticate'] = 'Basic realm="Gent"'
        return response
    if migration_info:
        from api.models import GitMigrationMap
        from .store import public_refs
        response = JsonResponse({'format': 'gent-migration-1', 'object_format': repository.object_format,
            'mapping': dict(GitMigrationMap.objects.filter(repository=repository).values_list('old_oid', 'new_oid')),
            'refs': public_refs(repository)})
        response['Cache-Control'] = 'no-store'
        return response
    if repository.object_format != 'sha256':
        return HttpResponse('legacy repository requires coordinated migration', status=409)
    try:
        if endpoint == 'info/refs':
            body = protocol.advertisement(repository, service)
            suffix = 'advertisement'
        else:
            if request.content_type != f'application/x-{service}-request':
                return HttpResponse('incorrect protocol content type', status=415)
            data = request.read(MAX_BYTES + 1)
            if len(data) > MAX_BYTES:
                return HttpResponse('transfer too large', status=413)
            body = protocol.receive(repository, user, data, authorize) if write else protocol.upload(repository, data)
            suffix = 'result'
    except (GitError, UnicodeError, ValueError) as error:
        body, suffix = protocol.pkt('ERR ' + str(error) + '\n'), 'result'
    response = HttpResponse(body, content_type=f'application/x-{service}-{suffix}')
    response['Cache-Control'] = 'no-cache, max-age=0, must-revalidate'
    return response
