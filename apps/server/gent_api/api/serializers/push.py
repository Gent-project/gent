import base64
import binascii

from rest_framework import serializers
from .branch import BranchCreateSerializer


class PushBlobSerializer(serializers.Serializer):
    """Serializer for a blob in a push pack."""
    sha = serializers.CharField(max_length=64, required=True)
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
    sha = serializers.CharField(max_length=64, required=True)


class PushTreeSerializer(serializers.Serializer):
    """Serializer for a tree in a push pack."""
    sha = serializers.CharField(max_length=64, required=True)
    entries = PushTreeEntrySerializer(many=True, required=True)


class PushCommitSerializer(serializers.Serializer):
    """Serializer for a commit in a push pack."""
    sha = serializers.CharField(max_length=64, required=True)
    message = serializers.CharField(required=True)
    tree_sha = serializers.CharField(max_length=64, required=True)
    parent_shas = serializers.ListField(
        child=serializers.CharField(max_length=64),
        required=False,
        default=list
    )
    author_name = serializers.CharField(required=True)
    author_email = serializers.EmailField(required=True)
    committed_at = serializers.DateTimeField(required=True)


class BranchUpdateSerializer(serializers.Serializer):
    """Serializer for a branch update in a push request."""
    name = serializers.CharField(max_length=255, required=True)
    commit_sha = serializers.CharField(max_length=64, required=True)


class PushPackSerializer(serializers.Serializer):
    """Serializer for the push request body."""
    pack = serializers.DictField(required=True)
    branch_updates = BranchUpdateSerializer(many=True, required=False, default=list)
    tags = serializers.DictField(required=False, default=dict)

    def validate_pack(self, value):
        if 'commits' not in value:
            raise serializers.ValidationError("Pack must contain 'commits' list.")
        if 'trees' not in value:
            raise serializers.ValidationError("Pack must contain 'trees' list.")
        if 'blobs' not in value:
            raise serializers.ValidationError("Pack must contain 'blobs' list.")
        return value


class CliPushAuthorSerializer(serializers.Serializer):
    """Serializer for commit author data from the CLI push payload."""
    name = serializers.CharField(required=True)
    email = serializers.EmailField(required=True)


class CliPushFileSerializer(serializers.Serializer):
    """Serializer for legacy file entries in the CLI push payload."""
    path = serializers.CharField(required=True)
    hash = serializers.CharField(max_length=64, required=True)


class CliPushTreeEntrySerializer(serializers.Serializer):
    """Serializer for tree entries in the CLI push payload."""
    mode = serializers.CharField(required=False, allow_blank=True)
    name = serializers.CharField(required=False)
    path = serializers.CharField(required=False)
    hash = serializers.CharField(max_length=64, required=False)
    sha = serializers.CharField(max_length=64, required=False)
    type = serializers.ChoiceField(choices=['blob', 'tree'], required=False)

    def validate(self, attrs):
        name = attrs.get('name') or attrs.get('path')
        sha = attrs.get('hash') or attrs.get('sha')
        entry_type = attrs.get('type', 'blob')
        mode = attrs.get('mode') or ('040000' if entry_type == 'tree' else '100644')

        if not name:
            raise serializers.ValidationError("Tree entries must include a name or path.")
        if not sha:
            raise serializers.ValidationError("Tree entries must include a hash or sha.")

        attrs['name'] = name
        attrs['sha'] = sha
        attrs['type'] = entry_type
        attrs['mode'] = mode
        return attrs


class CliPushCommitSerializer(serializers.Serializer):
    """Serializer for commits in the CLI push payload."""
    hash = serializers.CharField(max_length=64, required=True)
    message = serializers.CharField(required=True)
    author = CliPushAuthorSerializer(required=True)
    timestamp = serializers.DateTimeField(required=True)
    parent = serializers.CharField(max_length=64, required=False, allow_null=True)
    mergeParent = serializers.CharField(max_length=64, required=False, allow_null=True)
    treeHash = serializers.CharField(max_length=64, required=True)
    tree = CliPushTreeEntrySerializer(many=True, required=False, default=list)
    files = CliPushFileSerializer(many=True, required=False, default=list)
    stats = serializers.DictField(required=False, default=dict)

    def validate(self, attrs):
        normalized_tree = []
        if attrs.get('tree'):
            for entry in attrs['tree']:
                normalized_tree.append({
                    'type': entry['type'],
                    'mode': entry['mode'],
                    'name': entry['name'],
                    'sha': entry['sha'],
                })
        else:
            for file_entry in attrs.get('files', []):
                normalized_tree.append({
                    'type': 'blob',
                    'mode': '100644',
                    'name': file_entry['path'],
                    'sha': file_entry['hash'],
                })

        parent_shas = []
        for parent_sha in [attrs.get('parent'), attrs.get('mergeParent')]:
            if parent_sha:
                parent_shas.append(parent_sha)

        attrs['normalized_tree'] = normalized_tree
        attrs['parent_shas'] = parent_shas
        return attrs


class CliPushObjectSerializer(serializers.Serializer):
    """Serializer for objects in the CLI push payload."""
    hash = serializers.CharField(max_length=64, required=True)
    type = serializers.ChoiceField(choices=['blob'], required=True)
    data = serializers.CharField(required=True)

    def validate(self, attrs):
        try:
            decoded = base64.b64decode(attrs['data'], validate=True)
        except (binascii.Error, ValueError, TypeError):
            raise serializers.ValidationError("Object data must be valid base64.") from None

        attrs['size'] = len(decoded)
        return attrs


class PushRequestSerializer(serializers.Serializer):
    """Serializer for both canonical and CLI push payloads."""
    pack = serializers.DictField(required=False)
    branch_updates = BranchUpdateSerializer(many=True, required=False, default=list)
    tags = serializers.DictField(required=False, default=dict)

    branch = serializers.CharField(required=False)
    force = serializers.BooleanField(required=False, default=False)
    commits = CliPushCommitSerializer(many=True, required=False, default=list)
    objects = CliPushObjectSerializer(many=True, required=False, default=list)

    def validate_pack(self, value):
        if 'commits' not in value:
            raise serializers.ValidationError("Pack must contain 'commits' list.")
        if 'trees' not in value:
            raise serializers.ValidationError("Pack must contain 'trees' list.")
        if 'blobs' not in value:
            raise serializers.ValidationError("Pack must contain 'blobs' list.")
        return value

    def validate(self, attrs):
        pack = attrs.get('pack')
        if pack is not None:
            attrs.setdefault('branch_updates', [])
            attrs.setdefault('tags', {})
            return attrs

        branch = attrs.get('branch')
        commits = attrs.get('commits', [])
        objects = attrs.get('objects', [])

        if not branch and not commits and not objects:
            raise serializers.ValidationError(
                "Push request must include either 'pack' or CLI push fields."
            )

        if not branch:
            raise serializers.ValidationError(
                {'branch': "This field is required for CLI push payloads."}
            )

        trees_by_sha = {}
        for commit in commits:
            tree_sha = commit['treeHash']
            normalized_tree = commit['normalized_tree']
            existing_tree = trees_by_sha.get(tree_sha)
            if existing_tree and existing_tree['entries'] != normalized_tree:
                raise serializers.ValidationError(
                    {'commits': [f"Conflicting tree entries for treeHash {tree_sha}."]}
                )

            trees_by_sha[tree_sha] = {
                'sha': tree_sha,
                'entries': normalized_tree,
            }

        attrs['pack'] = {
            'commits': [
                {
                    'sha': commit['hash'],
                    'message': commit['message'],
                    'tree_sha': commit['treeHash'],
                    'parent_shas': commit['parent_shas'],
                    'author_name': commit['author']['name'],
                    'author_email': commit['author']['email'],
                    'committed_at': commit['timestamp'],
                }
                for commit in commits
            ],
            'trees': list(trees_by_sha.values()),
            'blobs': [
                {
                    'sha': obj['hash'],
                    'size': obj['size'],
                    'content': obj['data'],
                    'encoding': 'base64',
                }
                for obj in objects
            ],
        }
        attrs['branch_updates'] = (
            [{'name': branch, 'commit_sha': commits[-1]['hash']}]
            if commits else []
        )
        attrs['tags'] = attrs.get('tags', {})
        return attrs
