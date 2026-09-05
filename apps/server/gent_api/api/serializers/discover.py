"""Serializers for anonymous discovery endpoints.

These never expose email addresses: search and public profiles are readable by
unauthenticated visitors, so anything published here is effectively public.
Note that ``User.get_full_name`` falls back to the email address, so it must
not be used here.
"""
from rest_framework import serializers

from api.models import User
from api.serializers.repository import RepositorySerializer


class PublicRepositorySerializer(RepositorySerializer):
    """Repository fields safe for anonymous callers (no ``owner_email``).

    ``owner_name`` is overridden because the inherited field maps to
    ``User.get_full_name``, which falls back to the email address.
    """
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
        """Full name when set, else the username. Never the email address."""
        return f'{obj.owner.first_name} {obj.owner.last_name}'.strip() or obj.owner.username


class PublicUserSerializer(serializers.ModelSerializer):
    """Public identity for a user. Never includes the email address."""
    public_repo_count = serializers.IntegerField(read_only=True, default=0)
    display_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id',
            'username',
            'first_name',
            'last_name',
            'display_name',
            'date_joined',
            'public_repo_count',
        ]
        read_only_fields = fields

    def get_display_name(self, obj):
        """Full name when set, else the username. Never the email address."""
        return f'{obj.first_name} {obj.last_name}'.strip() or obj.username
