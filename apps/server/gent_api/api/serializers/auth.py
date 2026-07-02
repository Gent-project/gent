from rest_framework import serializers
from django.contrib.auth.password_validation import validate_password
from django.contrib.auth.tokens import PasswordResetTokenGenerator
from django.core.exceptions import ValidationError as DjangoValidationError
from django.utils.encoding import force_str
from django.utils.http import urlsafe_base64_decode
from api.models import User
from api.username_utils import validate_username as validate_username_value


def _normalize_username_for_api(value):
    """Validate username format and return normalized value, or None if blank."""
    if value is None or not str(value).strip():
        return None
    try:
        return validate_username_value(value)
    except DjangoValidationError as exc:
        raise serializers.ValidationError(exc.messages) from exc


def _ensure_username_available(normalized, *, exclude_user=None):
    queryset = User.objects.filter(username=normalized)
    if exclude_user is not None:
        queryset = queryset.exclude(pk=exclude_user.pk)
    if queryset.exists():
        raise serializers.ValidationError('This username is already taken.')


class OptionalUsernameField(serializers.CharField):
    """Optional username input with shared format and uniqueness checks."""

    def __init__(self, **kwargs):
        kwargs.setdefault('required', False)
        kwargs.setdefault('allow_blank', True)
        super().__init__(**kwargs)

    def to_internal_value(self, data):
        if data is None or (isinstance(data, str) and not data.strip()):
            return None
        normalized = _normalize_username_for_api(data)
        exclude_user = self.parent.instance if getattr(self.parent, 'instance', None) else None
        _ensure_username_available(normalized, exclude_user=exclude_user)
        return normalized


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
    username = OptionalUsernameField()

    class Meta:
        model = User
        fields = [
            'email',
            'username',
            'password',
            'password_confirm',
            'first_name',
            'last_name',
        ]
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
        username = validated_data.pop('username', None)
        user = User.objects.create_user(
            email=validated_data['email'],
            password=validated_data['password'],
            first_name=validated_data.get('first_name', ''),
            last_name=validated_data.get('last_name', ''),
            **({'username': username} if username else {}),
        )
        return user


class UserSerializer(serializers.ModelSerializer):
    """Serializer for user profile."""
    class Meta:
        model = User
        fields = [
            'id',
            'email',
            'username',
            'first_name',
            'last_name',
            'date_joined',
            'is_active',
        ]
        read_only_fields = ['id', 'email', 'date_joined', 'is_active']


class UserProfileUpdateSerializer(serializers.ModelSerializer):
    """Serializer for updating user profile."""
    username = OptionalUsernameField()

    class Meta:
        model = User
        fields = ['first_name', 'last_name', 'username']

    def validate(self, attrs):
        if not attrs.get('username'):
            attrs.pop('username', None)
        return attrs


class PasswordChangeSerializer(serializers.Serializer):
    """Serializer for changing an authenticated user's password."""
    current_password = serializers.CharField(write_only=True, required=True)
    new_password = serializers.CharField(write_only=True, required=True)
    new_password_confirm = serializers.CharField(write_only=True, required=True)

    def validate_current_password(self, value):
        user = self.context['request'].user
        if not user.check_password(value):
            raise serializers.ValidationError('Current password is incorrect.')
        return value

    def validate_new_password(self, value):
        validate_password(value, user=self.context['request'].user)
        return value

    def validate(self, attrs):
        if attrs['new_password'] != attrs['new_password_confirm']:
            raise serializers.ValidationError({
                'new_password': 'Password fields did not match.'
            })
        return attrs

    def save(self):
        user = self.context['request'].user
        user.set_password(self.validated_data['new_password'])
        user.save()
        return user


class PasswordResetRequestSerializer(serializers.Serializer):
    """Serializer for requesting a password reset email."""
    email = serializers.EmailField(required=True)


class PasswordResetConfirmSerializer(serializers.Serializer):
    """Serializer for confirming a password reset with a signed token."""
    uid = serializers.CharField(required=True)
    token = serializers.CharField(required=True)
    new_password = serializers.CharField(write_only=True, required=True)
    new_password_confirm = serializers.CharField(write_only=True, required=True)

    def validate(self, attrs):
        if attrs['new_password'] != attrs['new_password_confirm']:
            raise serializers.ValidationError({
                'new_password': 'Password fields did not match.'
            })

        try:
            uid = force_str(urlsafe_base64_decode(attrs['uid']))
            user = User.objects.get(pk=uid)
        except (TypeError, ValueError, OverflowError, User.DoesNotExist):
            raise serializers.ValidationError({
                'token': 'Invalid or expired reset token.'
            }) from None

        token_generator = PasswordResetTokenGenerator()
        if not token_generator.check_token(user, attrs['token']):
            raise serializers.ValidationError({
                'token': 'Invalid or expired reset token.'
            })

        try:
            validate_password(attrs['new_password'], user=user)
        except DjangoValidationError as exc:
            raise serializers.ValidationError({
                'new_password': list(exc.messages)
            }) from exc

        attrs['user'] = user
        return attrs

    def save(self):
        user = self.validated_data['user']
        user.set_password(self.validated_data['new_password'])
        user.save()
        return user
