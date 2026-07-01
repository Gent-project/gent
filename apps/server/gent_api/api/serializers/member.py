from rest_framework import serializers
from api.models import RepositoryMember, RepositoryMemberRole, User


class RepositoryMemberSerializer(serializers.ModelSerializer):
    """Serializer for repository member records."""
    user_id = serializers.IntegerField(source='user.id', read_only=True)
    email = serializers.EmailField(source='user.email', read_only=True)

    class Meta:
        model = RepositoryMember
        fields = ['user_id', 'email', 'role', 'created_at']
        read_only_fields = ['user_id', 'email', 'created_at']

    @classmethod
    def serialize_owner(cls, repository):
        """Serialize the repository owner in the same shape as members."""
        return {
            'user_id': repository.owner_id,
            'email': repository.owner.email,
            'role': 'owner',
            'created_at': repository.created_at,
        }

    @classmethod
    def list_for_repository(cls, repository, members):
        """Build a unified member list with the owner first."""
        return [cls.serialize_owner(repository)] + cls(members, many=True).data


class RepositoryMemberAddSerializer(serializers.Serializer):
    """Serializer for adding a repository member."""
    email = serializers.EmailField(required=True)
    role = serializers.ChoiceField(choices=RepositoryMemberRole.choices, required=True)

    def validate_email(self, value):
        if not User.objects.filter(email=value).exists():
            raise serializers.ValidationError('No user registered with this email.')
        return value
