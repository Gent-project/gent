from rest_framework import status, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from drf_spectacular.utils import extend_schema, OpenApiExample
from drf_spectacular.types import OpenApiTypes
from django.contrib.auth import authenticate
from api.serializers import (
    UserRegistrationSerializer,
    UserSerializer,
    UserProfileUpdateSerializer,
)


@extend_schema(
    responses={200: OpenApiTypes.OBJECT},
    summary='API Root',
    description='Returns a welcome message and lists all available API endpoints.'
)
@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def api_root(request):
    """API root endpoint"""
    return Response({
        'message': 'Welcome to Gent API',
        'endpoints': {
            'auth': {
                'register': '/api/auth/register/',
                'login': '/api/auth/login/',
                'logout': '/api/auth/logout/',
                'profile': '/api/auth/profile/',
                'token_refresh': '/api/auth/token/refresh/',
            },
            'repositories': {
                'list': '/api/repos/',
                'create': '/api/repos/create/',
                'detail': '/api/repos/{owner_id}/{repo_name}/',
                'delete': '/api/repos/{owner_id}/{repo_name}/delete/',
            },
            'branches': {
                'list': '/api/repos/{owner_id}/{repo_name}/branches/',
                'create': '/api/repos/{owner_id}/{repo_name}/branches/create/',
                'detail': '/api/repos/{owner_id}/{repo_name}/branches/{branch_name}/',
            },
            'commits': {
                'list': '/api/repos/{owner_id}/{repo_name}/commits/',
                'create': '/api/repos/{owner_id}/{repo_name}/commits/create/',
                'detail': '/api/repos/{owner_id}/{repo_name}/commits/{sha}/',
            },
            'objects': {
                'tree_create': '/api/repos/{owner_id}/{repo_name}/tree/create/',
                'tree': '/api/repos/{owner_id}/{repo_name}/tree/{sha}/',
                'blob_create': '/api/repos/{owner_id}/{repo_name}/blob/create/',
                'blob': '/api/repos/{owner_id}/{repo_name}/blob/{sha}/',
            },
            'documentation': {
                'swagger': '/api/docs/',
                'redoc': '/api/redoc/',
                'schema': '/api/schema/',
            },
            'admin': '/admin/',
        }
    })


@extend_schema(
    request=UserRegistrationSerializer,
    responses={201: UserSerializer, 400: OpenApiTypes.OBJECT},
    examples=[
        OpenApiExample(
            'Registration Example',
            value={
                'email': 'user@example.com',
                'password': 'securepassword123',
                'password_confirm': 'securepassword123',
                'first_name': 'John',
                'last_name': 'Doe'
            },
            request_only=True
        )
    ],
    summary='Register a new user',
    description='Create a new user account with email and password authentication.'
)
@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def register(request):
    """Register a new user."""
    serializer = UserRegistrationSerializer(data=request.data)
    if serializer.is_valid():
        user = serializer.save()
        refresh = RefreshToken.for_user(user)
        return Response({
            'message': 'User registered successfully',
            'user': UserSerializer(user).data,
            'tokens': {
                'refresh': str(refresh),
                'access': str(refresh.access_token),
            }
        }, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@extend_schema(
    request={
        'application/json': {
            'type': 'object',
            'properties': {
                'email': {'type': 'string', 'format': 'email'},
                'password': {'type': 'string', 'format': 'password'}
            },
            'required': ['email', 'password']
        }
    },
    responses={200: OpenApiTypes.OBJECT, 401: OpenApiTypes.OBJECT},
    examples=[
        OpenApiExample(
            'Login Example',
            value={
                'email': 'user@example.com',
                'password': 'securepassword123'
            },
            request_only=True
        )
    ],
    summary='Login user',
    description='Authenticate a user and return JWT access and refresh tokens.'
)
@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def login(request):
    """Login a user and return JWT tokens."""
    email = request.data.get('email')
    password = request.data.get('password')

    if not email or not password:
        return Response(
            {'error': 'Email and password are required'},
            status=status.HTTP_400_BAD_REQUEST
        )

    user = authenticate(request, username=email, password=password)

    if user is None:
        return Response(
            {'error': 'Invalid email or password'},
            status=status.HTTP_401_UNAUTHORIZED
        )

    if not user.is_active:
        return Response(
            {'error': 'User account is disabled'},
            status=status.HTTP_401_UNAUTHORIZED
        )

    refresh = RefreshToken.for_user(user)
    return Response({
        'message': 'Login successful',
        'user': UserSerializer(user).data,
        'tokens': {
            'refresh': str(refresh),
            'access': str(refresh.access_token),
        }
    }, status=status.HTTP_200_OK)


@extend_schema(
    request={
        'application/json': {
            'type': 'object',
            'properties': {
                'refresh': {'type': 'string'}
            },
            'required': ['refresh']
        }
    },
    responses={200: OpenApiTypes.OBJECT, 400: OpenApiTypes.OBJECT},
    summary='Logout user',
    description='Logout a user by blacklisting their refresh token. Requires authentication.'
)
@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def logout(request):
    """Logout a user by blacklisting the refresh token."""
    try:
        refresh_token = request.data.get('refresh')
        if refresh_token:
            token = RefreshToken(refresh_token)
            token.blacklist()
            return Response(
                {'message': 'Logout successful'},
                status=status.HTTP_200_OK
            )
        return Response(
            {'error': 'Refresh token is required'},
            status=status.HTTP_400_BAD_REQUEST
        )
    except Exception:
        return Response(
            {'error': 'Invalid token'},
            status=status.HTTP_400_BAD_REQUEST
        )


@extend_schema(
    methods=['GET'],
    responses={200: UserSerializer},
    summary='Get user profile',
    description='Retrieve the current authenticated user\'s profile information.'
)
@extend_schema(
    methods=['PUT', 'PATCH'],
    request=UserProfileUpdateSerializer,
    responses={200: UserSerializer, 400: OpenApiTypes.OBJECT},
    summary='Update user profile',
    description='Update the current authenticated user\'s profile. Use PUT for full update, PATCH for partial update.'
)
@api_view(['GET', 'PUT', 'PATCH'])
@permission_classes([permissions.IsAuthenticated])
def profile(request):
    """Get or update user profile."""
    if request.method == 'GET':
        serializer = UserSerializer(request.user)
        return Response(serializer.data, status=status.HTTP_200_OK)

    elif request.method in ['PUT', 'PATCH']:
        serializer = UserProfileUpdateSerializer(
            request.user,
            data=request.data,
            partial=request.method == 'PATCH'
        )
        if serializer.is_valid():
            serializer.save()
            user_serializer = UserSerializer(request.user)
            return Response({
                'message': 'Profile updated successfully',
                'user': user_serializer.data
            }, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
