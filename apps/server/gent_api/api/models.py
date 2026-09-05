from django.db import models
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.conf import settings
from pathlib import Path

from api.username_utils import generate_unique_username, validate_username


class UserManager(BaseUserManager):
    """Custom user manager where email is the unique identifier."""

    def resolve_public_ref(self, owner_ref):
        """Resolve a public owner reference (numeric user id or username).

        Usernames are never all-digit, so ``owner_ref.isdigit()`` unambiguously
        selects lookup by primary key.
        """
        if owner_ref.isdigit():
            return get_object_or_404(self.model, pk=int(owner_ref))
        return get_object_or_404(self.model, username=owner_ref.lower())
    
    def create_user(self, email, password=None, **extra_fields):
        """Create and save a regular user with the given email and password."""
        if not email:
            raise ValueError('The Email field must be set')
        email = self.normalize_email(email)

        username = extra_fields.pop('username', None)
        if username:
            extra_fields['username'] = validate_username(username)
        else:
            extra_fields['username'] = generate_unique_username(
                email,
                exists=lambda candidate: self.model.objects.filter(
                    username=candidate,
                ).exists(),
            )

        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        """Create and save a superuser with the given email and password."""
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('is_active', True)

        if extra_fields.get('is_staff') is not True:
            raise ValueError('Superuser must have is_staff=True.')
        if extra_fields.get('is_superuser') is not True:
            raise ValueError('Superuser must have is_superuser=True.')

        return self.create_user(email, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    """Custom user model that uses email as login and username for public identity."""
    email = models.EmailField(unique=True, max_length=255)
    username = models.CharField(max_length=150, unique=True)
    first_name = models.CharField(max_length=150, blank=True)
    last_name = models.CharField(max_length=150, blank=True)
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    date_joined = models.DateTimeField(default=timezone.now)

    objects = UserManager()

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = []

    class Meta:
        verbose_name = 'user'
        verbose_name_plural = 'users'

    def __str__(self):
        return self.email

    def get_full_name(self):
        """Return the full name of the user."""
        return f'{self.first_name} {self.last_name}'.strip() or self.email

    def get_short_name(self):
        """Return the short name for the user."""
        return self.first_name or self.email


class Repository(models.Model):
    """User's Git repository."""
    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name='repositories')
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    is_private = models.BooleanField(default=False)
    default_branch = models.CharField(max_length=255, default='main')
    object_format = models.CharField(max_length=10, default='legacy', choices=[('legacy', 'Legacy'), ('sha256', 'SHA-256')])
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ['owner', 'name']
        ordering = ['-created_at']
        verbose_name = 'repository'
        verbose_name_plural = 'repositories'
        indexes = [
            models.Index(fields=['is_private', '-updated_at']),
            models.Index(fields=['name']),
        ]

    def __str__(self):
        return f"{self.owner.email}/{self.name}"

    def get_storage_path(self):
        """Return filesystem path for this repository."""
        return Path(settings.MEDIA_ROOT) / 'repos' / str(self.owner.id) / str(self.id)


class RepositoryMemberRole(models.TextChoices):
    WRITE = 'write', 'Write'
    READ = 'read', 'Read'


class RepositoryMember(models.Model):
    """Collaborator membership for a repository."""
    repository = models.ForeignKey(
        Repository,
        on_delete=models.CASCADE,
        related_name='members',
    )
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='repository_memberships',
    )
    role = models.CharField(max_length=10, choices=RepositoryMemberRole.choices)
    added_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='+',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ['repository', 'user']
        verbose_name = 'repository member'
        verbose_name_plural = 'repository members'

    def __str__(self):
        return f'{self.user.email} ({self.role}) on {self.repository}'


class Branch(models.Model):
    """Repository branch."""
    repository = models.ForeignKey(Repository, on_delete=models.CASCADE, related_name='branches')
    name = models.CharField(max_length=255)
    commit_sha = models.CharField(max_length=64)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ['repository', 'name']
        ordering = ['name']
        verbose_name = 'branch'
        verbose_name_plural = 'branches'

    def __str__(self):
        return f"{self.repository.owner.email}/{self.repository.name}:{self.name}"


class Commit(models.Model):
    """Git commit object."""
    repository = models.ForeignKey(Repository, on_delete=models.CASCADE, related_name='commits')
    sha = models.CharField(max_length=64, db_index=True)
    author = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='commits')
    message = models.TextField()
    tree_sha = models.CharField(max_length=64)
    parent_shas = models.JSONField(default=list)
    author_name = models.CharField(max_length=255)
    author_email = models.EmailField()
    committed_at = models.DateTimeField()
    author_timestamp = models.BigIntegerField(null=True)
    author_timezone = models.CharField(max_length=5, blank=True)
    committer_name = models.TextField(blank=True)
    committer_email = models.TextField(blank=True)
    committer_timestamp = models.BigIntegerField(null=True)
    committer_timezone = models.CharField(max_length=5, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-committed_at']
        unique_together = ['repository', 'sha']
        verbose_name = 'commit'
        verbose_name_plural = 'commits'
        indexes = [
            models.Index(fields=['repository', 'sha']),
            models.Index(fields=['repository', '-committed_at']),
        ]

    def __str__(self):
        return f"{self.sha[:7]} - {self.message[:50]}"


class Tree(models.Model):
    """Git tree object (directory structure)."""
    repository = models.ForeignKey(Repository, on_delete=models.CASCADE, related_name='trees')
    sha = models.CharField(max_length=64, db_index=True)
    entries = models.JSONField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ['repository', 'sha']
        verbose_name = 'tree'
        verbose_name_plural = 'trees'
        indexes = [
            models.Index(fields=['repository', 'sha']),
        ]

    def __str__(self):
        return f"Tree {self.sha[:7]}"


class Blob(models.Model):
    """Git blob object (file content)."""
    repository = models.ForeignKey(Repository, on_delete=models.CASCADE, related_name='blobs')
    sha = models.CharField(max_length=64, db_index=True)
    size = models.IntegerField()
    content = models.TextField(blank=True, null=True)
    file_path = models.CharField(max_length=500, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ['repository', 'sha']
        verbose_name = 'blob'
        verbose_name_plural = 'blobs'
        indexes = [
            models.Index(fields=['repository', 'sha']),
        ]

    def __str__(self):
        return f"Blob {self.sha[:7]} ({self.size} bytes)"


class Tag(models.Model):
    """Git tag object."""
    repository = models.ForeignKey(Repository, on_delete=models.CASCADE, related_name='tags')
    name = models.CharField(max_length=255)
    commit_sha = models.CharField(max_length=64)
    message = models.TextField(blank=True)
    annotated = models.BooleanField(default=False)
    target_oid = models.CharField(max_length=64, blank=True)
    target_type = models.CharField(max_length=6, blank=True)
    tagger_name = models.CharField(max_length=255, blank=True)
    tagger_email = models.EmailField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ['repository', 'name']
        ordering = ['name']
        verbose_name = 'tag'
        verbose_name_plural = 'tags'

    def __str__(self):
        return f"{self.repository.owner.email}/{self.repository.name}:{self.name}"


class GitObject(models.Model):
    """Canonical uncompressed payload bytes. The ID includes Git framing."""
    repository = models.ForeignKey(Repository, on_delete=models.CASCADE, related_name='git_objects')
    oid = models.CharField(max_length=64)
    type = models.CharField(max_length=6)
    size = models.PositiveBigIntegerField()
    data = models.BinaryField()

    class Meta:
        constraints = [models.UniqueConstraint(fields=['repository', 'oid'], name='git_object_repository_oid')]


class GitRef(models.Model):
    repository = models.ForeignKey(Repository, on_delete=models.CASCADE, related_name='git_refs')
    name = models.CharField(max_length=1024)
    target = models.CharField(max_length=64)

    class Meta:
        constraints = [models.UniqueConstraint(fields=['repository', 'name'], name='git_ref_repository_name')]


class PersonalAccessToken(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='access_tokens')
    name = models.CharField(max_length=100)
    digest = models.CharField(max_length=64, unique=True)
    repository = models.ForeignKey(Repository, null=True, blank=True, on_delete=models.CASCADE)
    can_write = models.BooleanField(default=False)
    expires_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)


class GitMigrationMap(models.Model):
    repository = models.ForeignKey(Repository, on_delete=models.CASCADE, related_name='git_migration_map')
    old_oid = models.CharField(max_length=64)
    new_oid = models.CharField(max_length=64)

    class Meta:
        constraints = [models.UniqueConstraint(fields=['repository', 'old_oid'], name='git_migration_repository_oid')]
