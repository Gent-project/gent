from rest_framework import serializers
from ..models import Tag


class TagSerializer(serializers.ModelSerializer):
    """Serializer for tag model."""
    repository_name = serializers.CharField(source='repository.name', read_only=True)

    class Meta:
        model = Tag
        fields = [
            'id',
            'repository',
            'repository_name',
            'name',
            'commit_sha',
            'message',
            'annotated',
            'tagger_name',
            'tagger_email',
            'created_at',
        ]
        read_only_fields = ['id', 'repository', 'repository_name', 'created_at']


class TagCreateSerializer(serializers.Serializer):
    """Serializer for creating a tag."""
    name = serializers.CharField(max_length=255, required=True)
    commit_sha = serializers.CharField(max_length=40, required=True)
    message = serializers.CharField(required=False, allow_blank=True)
    annotated = serializers.BooleanField(required=False, default=False)
    tagger_name = serializers.CharField(required=False, allow_blank=True)
    tagger_email = serializers.EmailField(required=False, allow_blank=True)
