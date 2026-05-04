from rest_framework import serializers
from .branch import BranchCreateSerializer


class PushBlobSerializer(serializers.Serializer):
    """Serializer for a blob in a push pack."""
    sha = serializers.CharField(max_length=40, required=True)
    size = serializers.IntegerField(required=True)
    content = serializers.CharField(required=True)
    encoding = serializers.ChoiceField(
        choices=['utf-8', 'base64'],
        default='utf-8'
    )


class PushTreeEntrySerializer(serializers.Serializer):
    """Serializer for a tree entry in a push pack."""
    type = serializers.ChoiceField(choices=['blob', 'tree'])
    mode = serializers.CharField(required=True)
    name = serializers.CharField(required=True)
    sha = serializers.CharField(max_length=40, required=True)


class PushTreeSerializer(serializers.Serializer):
    """Serializer for a tree in a push pack."""
    sha = serializers.CharField(max_length=40, required=True)
    entries = PushTreeEntrySerializer(many=True, required=True)


class PushCommitSerializer(serializers.Serializer):
    """Serializer for a commit in a push pack."""
    sha = serializers.CharField(max_length=40, required=True)
    message = serializers.CharField(required=True)
    tree_sha = serializers.CharField(max_length=40, required=True)
    parent_shas = serializers.ListField(
        child=serializers.CharField(max_length=40),
        required=False,
        default=list
    )
    author_name = serializers.CharField(required=True)
    author_email = serializers.EmailField(required=True)
    committed_at = serializers.DateTimeField(required=True)


class BranchUpdateSerializer(serializers.Serializer):
    """Serializer for a branch update in a push request."""
    name = serializers.CharField(max_length=255, required=True)
    commit_sha = serializers.CharField(max_length=40, required=True)


class PushPackSerializer(serializers.Serializer):
    """Serializer for the push request body."""
    pack = serializers.DictField(required=True)
    branch_updates = BranchUpdateSerializer(many=True, required=False, default=list)

    def validate_pack(self, value):
        if 'commits' not in value:
            raise serializers.ValidationError("Pack must contain 'commits' list.")
        if 'trees' not in value:
            raise serializers.ValidationError("Pack must contain 'trees' list.")
        if 'blobs' not in value:
            raise serializers.ValidationError("Pack must contain 'blobs' list.")
        return value
