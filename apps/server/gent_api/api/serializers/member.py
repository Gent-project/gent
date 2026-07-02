from rest_framework import serializers
from api.models import RepositoryMember, RepositoryMemberRole, User


def serialize_member_row(*, user, role, created_at):
    """Build one member-list row for owner or collaborator."""
    return {
        'user_id': user.id,
        'email': user.email,
        'username': user.username,
        'first_name': user.first_name,
        'display_name': user.get_full_name(),
        'role': role,
        'created_at': created_at,
    }


class RepositoryMemberSerializer(serializers.ModelSerializer):
    """Serializer for repository member records."""
    user_id = serializers.IntegerField(source='user.id', read_only=True)
    email = serializers.EmailField(source='user.email', read_only=True)
    username = serializers.CharField(source='user.username', read_only=True)
    first_name = serializers.CharField(source='user.first_name', read_only=True)
    display_name = serializers.CharField(source='user.get_full_name', read_only=True)

    class Meta:
        model = RepositoryMember
        fields = [
            'user_id',
            'email',
            'username',
            'first_name',
            'display_name',
            'role',
            'created_at',
        ]
        read_only_fields = fields

    def to_representation(self, instance):
        return serialize_member_row(
            user=instance.user,
            role=instance.role,
            created_at=instance.created_at,
        )

    @classmethod
    def serialize_owner(cls, repository):
        """Serialize the repository owner in the same shape as members."""
        return serialize_member_row(
            user=repository.owner,
            role='owner',
            created_at=repository.created_at,
        )

    @classmethod
    def list_for_repository(cls, repository, members):
        """Build a unified member list with the owner first."""
        return [cls.serialize_owner(repository)] + [
            serialize_member_row(
                user=member.user,
                role=member.role,
                created_at=member.created_at,
            )
            for member in members
        ]


class RepositoryMemberAddSerializer(serializers.Serializer):
    """Serializer for adding a repository member."""
    email = serializers.EmailField(required=True)
    role = serializers.ChoiceField(choices=RepositoryMemberRole.choices, required=True)

    def validate_email(self, value):
        if not User.objects.filter(email=value).exists():
            raise serializers.ValidationError('No user registered with this email.')
        return value
