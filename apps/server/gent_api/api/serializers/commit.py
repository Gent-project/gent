from rest_framework import serializers
from ..models import Commit


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
