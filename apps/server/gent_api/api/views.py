from rest_framework import status, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from drf_spectacular.utils import extend_schema, OpenApiExample
from drf_spectacular.types import OpenApiTypes
from django.contrib.auth import authenticate
from .models import User, Repository, Commit
from .serializers import (
    UserRegistrationSerializer,
    UserSerializer,
    UserProfileUpdateSerializer,
    RepositorySerializer,
    RepositoryCreateSerializer,
    CommitSerializer,
    CommitCreateSerializer
)
import logging
from .metrics import (
    track_registration,
    track_login,
    track_logout,
    track_repository_creation,
    track_commit_creation,
    track_repository_deletion
)

# Logger for API events
logger = logging.getLogger('api')


@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def api_root(request):
    """
    API root endpoint
    """
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
    """
    Register a new user.

    POST /api/auth/register/
    Body: {
        "email": "user@example.com",
        "password": "securepassword",
        "password_confirm": "securepassword",
        "first_name": "John",
        "last_name": "Doe"
    }
    """
    serializer = UserRegistrationSerializer(data=request.data)
    if serializer.is_valid():
        user = serializer.save()
        refresh = RefreshToken.for_user(user)

        # Track metrics and log success
        track_registration(success=True)
        logger.info(f"User registered successfully: {user.email}")

        return Response({
            'message': 'User registered successfully',
            'user': UserSerializer(user).data,
            'tokens': {
                'refresh': str(refresh),
                'access': str(refresh.access_token),
            }
        }, status=status.HTTP_201_CREATED)

    # Track failed registration
    track_registration(success=False)
    logger.warning(f"Registration failed: {serializer.errors}")
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
    """
    Login a user and return JWT tokens.

    POST /api/auth/login/
    Body: {
        "email": "user@example.com",
        "password": "securepassword"
    }
    """
    email = request.data.get('email')
    password = request.data.get('password')

    if not email or not password:
        return Response(
            {'error': 'Email and password are required'},
            status=status.HTTP_400_BAD_REQUEST
        )

    user = authenticate(request, username=email, password=password)

    if user is None:
        # Track failed login
        track_login(status='failure')
        logger.warning(f"Failed login attempt for email: {email}")
        return Response(
            {'error': 'Invalid email or password'},
            status=status.HTTP_401_UNAUTHORIZED
        )

    if not user.is_active:
        # Track disabled account login attempt
        track_login(status='disabled')
        logger.warning(f"Login attempt for disabled account: {user.email}")
        return Response(
            {'error': 'User account is disabled'},
            status=status.HTTP_401_UNAUTHORIZED
        )

    # Track successful login
    track_login(status='success')
    logger.info(f"User logged in successfully: {user.email}")

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
    """
    Logout a user by blacklisting the refresh token.

    POST /api/auth/logout/
    Headers: {
        "Authorization": "Bearer <access_token>"
    }
    Body: {
        "refresh": "<refresh_token>"
    }
    """
    try:
        refresh_token = request.data.get('refresh')
        if refresh_token:
            token = RefreshToken(refresh_token)
            token.blacklist()

            # Track successful logout
            track_logout(success=True)
            logger.info(f"User logged out successfully: {request.user.email}")

            return Response(
                {'message': 'Logout successful'},
                status=status.HTTP_200_OK
            )

        # Track failed logout (missing token)
        track_logout(success=False)
        logger.warning("Logout failed: refresh token missing")
        return Response(
            {'error': 'Refresh token is required'},
            status=status.HTTP_400_BAD_REQUEST
        )
    except Exception as e:
        # Track failed logout (invalid token)
        track_logout(success=False)
        logger.error(f"Logout failed: {str(e)}")
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
    """
    Get or update user profile.
    
    GET /api/auth/profile/ - Get current user profile
    PUT /api/auth/profile/ - Update user profile (full update)
    PATCH /api/auth/profile/ - Update user profile (partial update)
    Headers: {
        "Authorization": "Bearer <access_token>"
    }
    """
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

            # Log profile update
            logger.info(f"Profile updated successfully for user: {request.user.email}")

            return Response({
                'message': 'Profile updated successfully',
                'user': user_serializer.data
            }, status=status.HTTP_200_OK)

        # Log failed profile update
        logger.warning(f"Profile update failed for user {request.user.email}: {serializer.errors}")
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def health_check(request):
    """
    Health check endpoint for monitoring systems.

    GET /api/health/
    Returns: {
        "status": "healthy" | "unhealthy",
        "database": "connected" | "error: <message>"
    }
    """
    from django.db import connection
    from django.http import JsonResponse

    health_status = {
        'status': 'healthy',
        'database': 'unknown'
    }

    # Check database connectivity
    try:
        connection.ensure_connection()
        health_status['database'] = 'connected'
    except Exception as e:
        health_status['status'] = 'unhealthy'
        health_status['database'] = f'error: {str(e)}'
        logger.error(f"Health check failed - database error: {str(e)}")
        return JsonResponse(health_status, status=503)

    logger.debug("Health check passed")
    return JsonResponse(health_status, status=200)


# Repository endpoints

@extend_schema(
    methods=['GET'],
    responses={200: RepositorySerializer(many=True)},
    summary='List repositories',
    description='Get a list of all repositories owned by the authenticated user.'
)
@extend_schema(
    methods=['POST'],
    request=RepositoryCreateSerializer,
    responses={201: RepositorySerializer, 400: OpenApiTypes.OBJECT},
    summary='Create repository',
    description='Create a new repository for the authenticated user.'
)
@api_view(['GET', 'POST'])
@permission_classes([permissions.IsAuthenticated])
def repository_list(request):
    """
    List all repositories for the authenticated user or create a new one.
    """
    if request.method == 'GET':
        repositories = Repository.objects.filter(owner=request.user)
        serializer = RepositorySerializer(repositories, many=True)
        logger.info(f"User {request.user.email} retrieved {repositories.count()} repositories")
        return Response(serializer.data, status=status.HTTP_200_OK)

    elif request.method == 'POST':
        serializer = RepositoryCreateSerializer(data=request.data)
        if serializer.is_valid():
            repository = serializer.save(owner=request.user)
            track_repository_creation(success=True)
            logger.info(f"Repository created: {repository.name} by {request.user.email}")
            return Response(
                RepositorySerializer(repository).data,
                status=status.HTTP_201_CREATED
            )

        track_repository_creation(success=False)
        logger.warning(f"Repository creation failed for {request.user.email}: {serializer.errors}")
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@extend_schema(
    methods=['GET'],
    responses={200: RepositorySerializer, 404: OpenApiTypes.OBJECT},
    summary='Get repository',
    description='Get details of a specific repository.'
)
@extend_schema(
    methods=['PUT', 'PATCH'],
    request=RepositoryCreateSerializer,
    responses={200: RepositorySerializer, 400: OpenApiTypes.OBJECT, 404: OpenApiTypes.OBJECT},
    summary='Update repository',
    description='Update a repository. Only the owner can update their repository.'
)
@extend_schema(
    methods=['DELETE'],
    responses={204: None, 404: OpenApiTypes.OBJECT},
    summary='Delete repository',
    description='Delete a repository. Only the owner can delete their repository.'
)
@api_view(['GET', 'PUT', 'PATCH', 'DELETE'])
@permission_classes([permissions.IsAuthenticated])
def repository_detail(request, pk):
    """
    Retrieve, update, or delete a repository.
    """
    try:
        repository = Repository.objects.get(pk=pk, owner=request.user)
    except Repository.DoesNotExist:
        logger.warning(f"Repository {pk} not found for user {request.user.email}")
        return Response(
            {'error': 'Repository not found'},
            status=status.HTTP_404_NOT_FOUND
        )

    if request.method == 'GET':
        serializer = RepositorySerializer(repository)
        logger.info(f"Repository {repository.name} retrieved by {request.user.email}")
        return Response(serializer.data, status=status.HTTP_200_OK)

    elif request.method in ['PUT', 'PATCH']:
        serializer = RepositoryCreateSerializer(
            repository,
            data=request.data,
            partial=request.method == 'PATCH'
        )
        if serializer.is_valid():
            serializer.save()
            logger.info(f"Repository {repository.name} updated by {request.user.email}")
            return Response(
                RepositorySerializer(repository).data,
                status=status.HTTP_200_OK
            )

        logger.warning(f"Repository update failed for {repository.name}: {serializer.errors}")
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    elif request.method == 'DELETE':
        repository_name = repository.name
        repository.delete()
        track_repository_deletion(success=True)
        logger.info(f"Repository {repository_name} deleted by {request.user.email}")
        return Response(status=status.HTTP_204_NO_CONTENT)


# Commit endpoints

@extend_schema(
    methods=['GET'],
    responses={200: CommitSerializer(many=True)},
    summary='List commits',
    description='Get a list of all commits for a specific repository.'
)
@extend_schema(
    methods=['POST'],
    request=CommitCreateSerializer,
    responses={201: CommitSerializer, 400: OpenApiTypes.OBJECT, 404: OpenApiTypes.OBJECT},
    summary='Create commit',
    description='Create a new commit in the specified repository.'
)
@api_view(['GET', 'POST'])
@permission_classes([permissions.IsAuthenticated])
def commit_list(request, repository_pk):
    """
    List all commits for a repository or create a new one.
    """
    try:
        repository = Repository.objects.get(pk=repository_pk, owner=request.user)
    except Repository.DoesNotExist:
        logger.warning(f"Repository {repository_pk} not found for user {request.user.email}")
        return Response(
            {'error': 'Repository not found'},
            status=status.HTTP_404_NOT_FOUND
        )

    if request.method == 'GET':
        commits = repository.commits.all()
        serializer = CommitSerializer(commits, many=True)
        logger.info(f"User {request.user.email} retrieved {commits.count()} commits from {repository.name}")
        return Response(serializer.data, status=status.HTTP_200_OK)

    elif request.method == 'POST':
        serializer = CommitCreateSerializer(data=request.data)
        if serializer.is_valid():
            commit = serializer.save(
                repository=repository,
                author=request.user
            )
            track_commit_creation(success=True)
            logger.info(f"Commit created: {commit.hash[:7]} in {repository.name} by {request.user.email}")
            return Response(
                CommitSerializer(commit).data,
                status=status.HTTP_201_CREATED
            )

        track_commit_creation(success=False)
        logger.warning(f"Commit creation failed in {repository.name}: {serializer.errors}")
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@extend_schema(
    responses={200: CommitSerializer, 404: OpenApiTypes.OBJECT},
    summary='Get commit',
    description='Get details of a specific commit.'
)
@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def commit_detail(request, repository_pk, pk):
    """
    Retrieve a specific commit.
    """
    try:
        repository = Repository.objects.get(pk=repository_pk, owner=request.user)
        commit = repository.commits.get(pk=pk)
    except Repository.DoesNotExist:
        logger.warning(f"Repository {repository_pk} not found for user {request.user.email}")
        return Response(
            {'error': 'Repository not found'},
            status=status.HTTP_404_NOT_FOUND
        )
    except Commit.DoesNotExist:
        logger.warning(f"Commit {pk} not found in repository {repository_pk}")
        return Response(
            {'error': 'Commit not found'},
            status=status.HTTP_404_NOT_FOUND
        )

    serializer = CommitSerializer(commit)
    logger.info(f"Commit {commit.hash[:7]} retrieved from {repository.name}")
    return Response(serializer.data, status=status.HTTP_200_OK)
