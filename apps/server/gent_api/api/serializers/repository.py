import re
from rest_framework import serializers
from api.models import Repository
from api.services.repository_access import get_user_repo_role


class RepositorySerializer(serializers.ModelSerializer):
    """Serializer for repository model."""
    owner_email = serializers.EmailField(source='owner.email', read_only=True)
    owner_id = serializers.IntegerField(source='owner.id', read_only=True)
    role = serializers.SerializerMethodField()

    class Meta:
        model = Repository
        fields = [
            'id', 'owner_id', 'owner_email', 'name', 'description',
            'is_private', 'default_branch', 'role', 'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'owner_id', 'owner_email', 'role', 'created_at', 'updated_at'
        ]

    def get_role(self, obj):
        request = self.context.get('request')
        if request is None or not request.user.is_authenticated:
            return None
        return get_user_repo_role(request.user, obj)


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
