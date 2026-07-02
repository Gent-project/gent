import re

from django.core.exceptions import ValidationError

USERNAME_PATTERN = re.compile(r'^[a-z0-9_-]+$')


def normalize_username(value: str) -> str:
    """Lowercase and strip a username value."""
    return value.strip().lower()


def sanitize_email_local_part(email: str) -> str:
    """Extract and sanitize the email local-part for username generation."""
    local_part = email.split('@')[0]
    return re.sub(r'[^a-zA-Z0-9_-]', '', local_part).lower()


def ensure_non_numeric_base(base: str) -> str:
    """Ensure username base is non-empty and not all digits."""
    if not base:
        return 'user'
    if base.isdigit():
        return f'user-{base}'
    return base


def validate_username(value: str) -> str:
    """Normalize and validate an explicit username."""
    normalized = normalize_username(value)
    if not normalized:
        raise ValidationError('Username is required.')
    if not USERNAME_PATTERN.match(normalized):
        raise ValidationError(
            'Username may only contain letters, numbers, underscores, and dashes.'
        )
    if normalized.isdigit():
        raise ValidationError('Username cannot be all digits.')
    return normalized


def generate_unique_username(email: str, *, exists) -> str:
    """Generate a unique lowercase username from an email address."""
    base = ensure_non_numeric_base(sanitize_email_local_part(email))
    candidate = base
    suffix = 2
    while exists(candidate):
        candidate = f'{base}-{suffix}'
        suffix += 1
    return candidate


# Migration 0007_user_username duplicates this algorithm as a frozen snapshot.
# Do not import this module from data migrations — replay on fresh DBs must
# preserve historical backfill semantics even if runtime rules evolve.
