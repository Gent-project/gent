from rest_framework import serializers
from django.contrib.auth.password_validation import validate_password
from .models import User, Repository, Commit
import hashlib
import secrets


class UserRegistrationSerializer(serializers.ModelSerializer):
    """Serializer for user registration."""
    password = serializers.CharField(
        write_only=True,
        required=True,
        validators=[validate_password]
    )
    password_confirm = serializers.CharField(
        write_only=True,
        required=True
    )

    class Meta:
        model = User
        fields = ['email', 'password', 'password_confirm', 'first_name', 'last_name']
        extra_kwargs = {
            'email': {'required': True},
            'first_name': {'required': False},
            'last_name': {'required': False},
        }

    def validate(self, attrs):
        """Validate that passwords match."""
        if attrs['password'] != attrs['password_confirm']:
            raise serializers.ValidationError({
                'password': 'Password fields did not match.'
            })
        return attrs

    def create(self, validated_data):
        """Create a new user."""
        validated_data.pop('password_confirm')
        user = User.objects.create_user(
            email=validated_data['email'],
            password=validated_data['password'],
            first_name=validated_data.get('first_name', ''),
            last_name=validated_data.get('last_name', ''),
        )
        return user


class UserSerializer(serializers.ModelSerializer):
    """Serializer for user profile."""
    class Meta:
        model = User
        fields = ['id', 'email', 'first_name', 'last_name', 'date_joined', 'is_active']
        read_only_fields = ['id', 'email', 'date_joined', 'is_active']


class UserProfileUpdateSerializer(serializers.ModelSerializer):
    """Serializer for updating user profile."""
    class Meta:
        model = User
        fields = ['first_name', 'last_name']


class RepositorySerializer(serializers.ModelSerializer):
    """Serializer for Repository model."""
    owner_email = serializers.EmailField(source='owner.email', read_only=True)
    commit_count = serializers.SerializerMethodField()

    class Meta:
        model = Repository
        fields = ['id', 'name', 'description', 'owner', 'owner_email', 'is_private', 'commit_count', 'created_at', 'updated_at']
        read_only_fields = ['id', 'owner', 'created_at', 'updated_at']

    def get_commit_count(self, obj):
        """Get total number of commits in the repository."""
        return obj.commits.count()


class RepositoryCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating a repository."""
    class Meta:
        model = Repository
        fields = ['name', 'description', 'is_private']


class CommitSerializer(serializers.ModelSerializer):
    """Serializer for Commit model."""
    author_email = serializers.EmailField(source='author.email', read_only=True)
    repository_name = serializers.CharField(source='repository.name', read_only=True)

    class Meta:
        model = Commit
        fields = ['id', 'hash', 'message', 'parent_hash', 'author', 'author_email', 'repository', 'repository_name', 'created_at']
        read_only_fields = ['id', 'hash', 'author', 'created_at']


class CommitCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating a commit."""
    class Meta:
        model = Commit
        fields = ['message', 'parent_hash']

    def validate(self, attrs):
        """Generate a unique hash for the commit."""
        # Generate a unique hash based on message, timestamp, and random data
        hash_input = f"{attrs['message']}{secrets.token_hex(16)}"
        attrs['hash'] = hashlib.sha1(hash_input.encode()).hexdigest()
        return attrs
