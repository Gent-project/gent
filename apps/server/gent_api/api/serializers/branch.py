from rest_framework import serializers
from api.models import Branch


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
    commit_sha = serializers.CharField(max_length=64, required=True)


class BranchPatchSerializer(serializers.Serializer):
    """Serializer for updating a branch pointer."""
    commit_sha = serializers.CharField(max_length=64, required=True)



