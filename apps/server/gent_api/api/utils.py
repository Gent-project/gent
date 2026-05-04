import hashlib
import base64
from pathlib import Path
from django.conf import settings


def calculate_sha1(content):
    """Calculate SHA-1 hash of content."""
    if isinstance(content, str):
        content = content.encode('utf-8')
    return hashlib.sha1(content).hexdigest()


def get_repository_or_404(owner_id, repo_name, user):
    """Get repository or 404, checking permissions."""
    from django.shortcuts import get_object_or_404
    from django.core.exceptions import PermissionDenied
    from .models import Repository

    repository = get_object_or_404(
        Repository,
        owner_id=owner_id,
        name=repo_name
    )

    if repository.is_private and repository.owner != user:
        raise PermissionDenied("You don't have access to this repository.")

    return repository


def save_blob_content(repository, sha, content, encoding='utf-8'):
    """Save blob content to filesystem or database."""
    if encoding == 'base64':
        content_bytes = base64.b64decode(content)
    else:
        content_bytes = content.encode('utf-8')

    size = len(content_bytes)

    if size <= settings.REPO_SMALL_FILE_THRESHOLD:
        return {'content': content, 'file_path': '', 'size': size}
    else:
        storage_path = repository.get_storage_path() / 'objects' / 'blobs' / sha[:2]
        storage_path.mkdir(parents=True, exist_ok=True)
        file_path = storage_path / f"{sha[2:]}.blob"

        with open(file_path, 'wb') as f:
            f.write(content_bytes)

        return {'content': None, 'file_path': str(file_path), 'size': size}
