import re
from rest_framework import serializers
from django.contrib.auth.password_validation import validate_password
from .models import User, Repository, Branch, Commit, Tree, Blob


class UserRegistrationSerializer(serializers.ModelSerializer):
    """Serializer for user registration."""
    password = serializers.CharField(
        write_only=True,
        required=True,
        validators=[validate_password]
    )
    password_confirm = serializers.CharField(
        write_only=True,
        required=True
    )

    class Meta:
        model = User
        fields = ['email', 'password', 'password_confirm', 'first_name', 'last_name']
        extra_kwargs = {
            'email': {'required': True},
            'first_name': {'required': False},
            'last_name': {'required': False},
        }

    def validate(self, attrs):
        """Validate that passwords match."""
        if attrs['password'] != attrs['password_confirm']:
            raise serializers.ValidationError({
                'password': 'Password fields did not match.'
            })
        return attrs

    def create(self, validated_data):
        """Create a new user."""
        validated_data.pop('password_confirm')
        user = User.objects.create_user(
            email=validated_data['email'],
            password=validated_data['password'],
            first_name=validated_data.get('first_name', ''),
            last_name=validated_data.get('last_name', ''),
        )
        return user


class UserSerializer(serializers.ModelSerializer):
    """Serializer for user profile."""
    class Meta:
        model = User
        fields = ['id', 'email', 'first_name', 'last_name', 'date_joined', 'is_active']
        read_only_fields = ['id', 'email', 'date_joined', 'is_active']


class UserProfileUpdateSerializer(serializers.ModelSerializer):
    """Serializer for updating user profile."""
    class Meta:
        model = User
        fields = ['first_name', 'last_name']


class RepositorySerializer(serializers.ModelSerializer):
    """Serializer for repository model."""
    owner_email = serializers.EmailField(source='owner.email', read_only=True)
    owner_id = serializers.IntegerField(source='owner.id', read_only=True)

    class Meta:
        model = Repository
        fields = [
            'id', 'owner_id', 'owner_email', 'name', 'description',
            'is_private', 'default_branch', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'owner_id', 'owner_email', 'created_at', 'updated_at']


class RepositoryCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating a repository."""
    class Meta:
        model = Repository
        fields = ['name', 'description', 'is_private', 'default_branch']
        extra_kwargs = {
            'description': {'required': False},
            'is_private': {'required': False},
            'default_branch': {'required': False},
        }

    def validate_name(self, value):
        """Validate repository name."""
        if not value or len(value) < 1:
            raise serializers.ValidationError("Repository name is required.")
        if not re.match(r'^[a-zA-Z0-9_-]+$', value):
            raise serializers.ValidationError(
                "Repository name can only contain letters, numbers, dashes, and underscores."
            )
        return value


class BranchSerializer(serializers.ModelSerializer):
    """Serializer for branch model."""
    repository_name = serializers.CharField(source='repository.name', read_only=True)

    class Meta:
        model = Branch
        fields = ['id', 'repository_name', 'name', 'commit_sha', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']


class BranchCreateSerializer(serializers.Serializer):
    """Serializer for creating a branch."""
    name = serializers.CharField(max_length=255, required=True)
    commit_sha = serializers.CharField(max_length=40, required=True)


class CommitSerializer(serializers.ModelSerializer):
    """Serializer for commit model."""
    repository_name = serializers.CharField(source='repository.name', read_only=True)
    author_email_user = serializers.EmailField(source='author.email', read_only=True)

    class Meta:
        model = Commit
        fields = [
            'id', 'repository_name', 'sha', 'author_email_user',
            'author_name', 'author_email', 'message', 'tree_sha',
            'parent_shas', 'committed_at', 'created_at'
        ]
        read_only_fields = ['id', 'sha', 'created_at']


class CommitCreateSerializer(serializers.Serializer):
    """Serializer for creating a commit."""
    message = serializers.CharField(required=True)
    tree_sha = serializers.CharField(max_length=40, required=True)
    parent_shas = serializers.ListField(
        child=serializers.CharField(max_length=40),
        required=False,
        default=list
    )
    author_name = serializers.CharField(required=False)
    author_email = serializers.EmailField(required=False)
    branch = serializers.CharField(required=False)


class TreeSerializer(serializers.ModelSerializer):
    """Serializer for tree model."""
    class Meta:
        model = Tree
        fields = ['id', 'sha', 'entries', 'created_at']
        read_only_fields = ['id', 'created_at']


class TreeCreateSerializer(serializers.Serializer):
    """Serializer for creating a tree."""
    entries = serializers.ListField(required=True)

    def validate_entries(self, value):
        """Validate tree entries format."""
        for entry in value:
            if not all(k in entry for k in ['type', 'mode', 'name', 'sha']):
                raise serializers.ValidationError(
                    "Each entry must have 'type', 'mode', 'name', and 'sha' fields."
                )
        return value


class BlobSerializer(serializers.ModelSerializer):
    """Serializer for blob model."""
    class Meta:
        model = Blob
        fields = ['id', 'sha', 'size', 'content', 'created_at']
        read_only_fields = ['id', 'sha', 'size', 'created_at']


class BlobCreateSerializer(serializers.Serializer):
    """Serializer for creating a blob."""
    content = serializers.CharField(required=True)
    encoding = serializers.ChoiceField(
        choices=['utf-8', 'base64'],
        default='utf-8'
    )
