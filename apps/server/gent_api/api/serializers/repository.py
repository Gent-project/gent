import re
from rest_framework import serializers
from api.models import Repository, User
from api.services.repository_access import get_user_repo_role


class RepositorySerializer(serializers.ModelSerializer):
    """Serializer for repository model."""
    owner_email = serializers.EmailField(source='owner.email', read_only=True)
    owner_id = serializers.IntegerField(source='owner.id', read_only=True)
    owner_username = serializers.CharField(source='owner.username', read_only=True)
    owner_name = serializers.CharField(source='owner.get_full_name', read_only=True)
    role = serializers.SerializerMethodField()

    class Meta:
        model = Repository
        fields = [
            'id', 'owner_id', 'owner_email', 'owner_username', 'owner_name',
            'name', 'description',
            'is_private', 'default_branch', 'object_format', 'role', 'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'owner_id', 'owner_email', 'owner_username', 'owner_name',
            'object_format', 'role', 'created_at', 'updated_at'
        ]

    def get_role(self, obj):
        request = self.context.get('request')
        if request is None or not request.user.is_authenticated:
            return None
        return get_user_repo_role(request.user, obj)


class PublicRepositorySerializer(RepositorySerializer):
    """Repository fields safe for callers without repository membership."""
    owner_name = serializers.SerializerMethodField()

    class Meta(RepositorySerializer.Meta):
        fields = [
            field for field in RepositorySerializer.Meta.fields
            if field != 'owner_email'
        ]
        read_only_fields = [
            field for field in RepositorySerializer.Meta.read_only_fields
            if field != 'owner_email'
        ]

    def get_owner_name(self, obj):
        return f'{obj.owner.first_name} {obj.owner.last_name}'.strip() or obj.owner.username


class PublicUserSerializer(serializers.ModelSerializer):
    """Public identity. Email is never matched or returned."""
    public_repo_count = serializers.IntegerField(read_only=True, default=0)
    display_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id', 'username', 'first_name', 'last_name', 'display_name',
            'date_joined', 'public_repo_count',
        ]
        read_only_fields = fields

    def get_display_name(self, obj):
        return f'{obj.first_name} {obj.last_name}'.strip() or obj.username


class RepositoryCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating a repository."""
    object_format = serializers.ChoiceField(choices=('legacy', 'sha256'), default='sha256')
    class Meta:
        model = Repository
        fields = ['name', 'description', 'is_private', 'default_branch', 'object_format']
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
