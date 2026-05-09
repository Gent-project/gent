from rest_framework import serializers
from api.models import Tree, Blob


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
