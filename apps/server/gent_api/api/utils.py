import hashlib
import base64
from pathlib import Path
from django.conf import settings
from django.shortcuts import get_object_or_404
from django.core.exceptions import PermissionDenied
from api.models import Repository
from rest_framework import status
from rest_framework.response import Response

from api.services.repository_access import user_can_read_repo, user_can_write_repo


def calculate_sha256(content):
    """Calculate SHA-256 hash of content."""
    if isinstance(content, str):
        content = content.encode('utf-8')
    return hashlib.sha256(content).hexdigest()


def get_repository_or_404(owner_id, repo_name, user):
    """Get repository or 404, checking permissions."""
    repository = get_object_or_404(
        Repository.objects.select_related('owner'),
        owner_id=owner_id,
        name=repo_name,
    )

    if not user_can_read_repo(user, repository):
        raise PermissionDenied("You don't have access to this repository.")

    return repository


def require_repo_write(user, repository):
    """Return a 403 Response if the user lacks write access, else None."""
    if not user_can_write_repo(user, repository):
        return Response(
            {'error': 'You do not have write access to this repository.'},
            status=status.HTTP_403_FORBIDDEN,
        )
    return None


def save_blob_content(repository, sha, content, encoding='utf-8'):
    """Save blob content to filesystem or database."""
    if encoding == 'base64':
        content_bytes = base64.b64decode(content)
        try:
            decoded_content = content_bytes.decode('utf-8')
        except UnicodeDecodeError:
            decoded_content = None
    else:
        content_bytes = content.encode('utf-8')
        decoded_content = content

    size = len(content_bytes)

    if size <= settings.REPO_SMALL_FILE_THRESHOLD and decoded_content is not None:
        return {'content': decoded_content, 'file_path': '', 'size': size}
    else:
        storage_path = repository.get_storage_path() / 'objects' / 'blobs' / sha[:2]
        storage_path.mkdir(parents=True, exist_ok=True)
        file_path = storage_path / f"{sha[2:]}.blob"

        with open(file_path, 'wb') as f:
            f.write(content_bytes)

        return {'content': None, 'file_path': str(file_path), 'size': size}
