import hashlib
import base64
import shutil
from pathlib import Path
from datetime import datetime
from rest_framework import status, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from drf_spectacular.utils import extend_schema, OpenApiExample
from drf_spectacular.types import OpenApiTypes
from django.contrib.auth import authenticate
from django.shortcuts import get_object_or_404
from django.conf import settings
from django.core.exceptions import PermissionDenied
from django.utils import timezone
from .models import User, Repository, Branch, Commit, Tree, Blob
from .serializers import (
    UserRegistrationSerializer,
    UserSerializer,
    UserProfileUpdateSerializer,
    RepositorySerializer,
    RepositoryCreateSerializer,
    BranchSerializer,
    BranchCreateSerializer,
    CommitSerializer,
    CommitCreateSerializer,
    TreeSerializer,
    TreeCreateSerializer,
    BlobSerializer,
    BlobCreateSerializer
)
from .permissions import IsRepositoryOwnerByParams


@extend_schema(
    responses={200: OpenApiTypes.OBJECT},
    summary='API Root',
    description='Returns a welcome message and lists all available API endpoints.'
)
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
            return Response(
                {'message': 'Logout successful'},
                status=status.HTTP_200_OK
            )
        return Response(
            {'error': 'Refresh token is required'},
            status=status.HTTP_400_BAD_REQUEST
        )
    except Exception as e:
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
            return Response({
                'message': 'Profile updated successfully',
                'user': user_serializer.data
            }, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


# Helper functions

def calculate_sha1(content):
    """Calculate SHA-1 hash of content."""
    if isinstance(content, str):
        content = content.encode('utf-8')
    return hashlib.sha1(content).hexdigest()


def get_repository_or_404(owner_id, repo_name, user):
    """Get repository or 404, checking permissions."""
    repository = get_object_or_404(
        Repository,
        owner_id=owner_id,
        name=repo_name
    )

    if repository.is_private and repository.owner != user:
        raise PermissionDenied("You don't have access to this repository.")

    return repository


def save_blob_content(repository, sha, content, encoding='utf-8'):
    """Save blob content to filesystem or database."""
    if encoding == 'base64':
        content_bytes = base64.b64decode(content)
    else:
        content_bytes = content.encode('utf-8')

    size = len(content_bytes)

    if size <= settings.REPO_SMALL_FILE_THRESHOLD:
        return {'content': content, 'file_path': '', 'size': size}
    else:
        storage_path = repository.get_storage_path() / 'objects' / 'blobs' / sha[:2]
        storage_path.mkdir(parents=True, exist_ok=True)
        file_path = storage_path / f"{sha[2:]}.blob"

        with open(file_path, 'wb') as f:
            f.write(content_bytes)

        return {'content': None, 'file_path': str(file_path), 'size': size}


# Repository views

@extend_schema(
    responses={200: RepositorySerializer(many=True)},
    summary='List repositories',
    description='List all repositories owned by the authenticated user.'
)
@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def repository_list(request):
    """List user's repositories."""
    repositories = Repository.objects.filter(owner=request.user)
    serializer = RepositorySerializer(repositories, many=True)
    return Response(serializer.data, status=status.HTTP_200_OK)


@extend_schema(
    request=RepositoryCreateSerializer,
    responses={201: RepositorySerializer, 400: OpenApiTypes.OBJECT},
    summary='Create repository',
    description='Create a new repository for the authenticated user.'
)
@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def repository_create(request):
    """Create a new repository."""
    serializer = RepositoryCreateSerializer(data=request.data)

    if serializer.is_valid():
        if Repository.objects.filter(
            owner=request.user,
            name=serializer.validated_data['name']
        ).exists():
            return Response(
                {'error': 'Repository with this name already exists.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        repository = Repository.objects.create(
            owner=request.user,
            **serializer.validated_data
        )

        Branch.objects.create(
            repository=repository,
            name=repository.default_branch,
            commit_sha='0' * 40
        )

        return Response(
            {
                'message': 'Repository created successfully',
                'repository': RepositorySerializer(repository).data
            },
            status=status.HTTP_201_CREATED
        )

    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@extend_schema(
    responses={200: RepositorySerializer},
    summary='Get repository details',
    description='Get details of a specific repository.'
)
@api_view(['GET', 'PATCH'])
@permission_classes([permissions.IsAuthenticated, IsRepositoryOwnerByParams])
def repository_detail(request, owner_id, repo_name):
    """Get or update repository details."""
    repository = get_repository_or_404(owner_id, repo_name, request.user)

    if request.method == 'GET':
        serializer = RepositorySerializer(repository)
        return Response(serializer.data, status=status.HTTP_200_OK)

    elif request.method == 'PATCH':
        if repository.owner != request.user:
            return Response(
                {'error': 'Only the repository owner can update it.'},
                status=status.HTTP_403_FORBIDDEN
            )

        serializer = RepositorySerializer(
            repository,
            data=request.data,
            partial=True
        )

        if serializer.is_valid():
            serializer.save()
            return Response(
                {
                    'message': 'Repository updated successfully',
                    'repository': serializer.data
                },
                status=status.HTTP_200_OK
            )

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@extend_schema(
    responses={200: OpenApiTypes.OBJECT},
    summary='Delete repository',
    description='Delete a repository. Only the owner can delete.'
)
@api_view(['DELETE'])
@permission_classes([permissions.IsAuthenticated, IsRepositoryOwnerByParams])
def repository_delete(request, owner_id, repo_name):
    """Delete a repository."""
    repository = get_repository_or_404(owner_id, repo_name, request.user)

    if repository.owner != request.user:
        return Response(
            {'error': 'Only the repository owner can delete it.'},
            status=status.HTTP_403_FORBIDDEN
        )

    storage_path = repository.get_storage_path()
    if storage_path.exists():
        shutil.rmtree(storage_path)

    repository.delete()

    return Response(
        {'message': 'Repository deleted successfully'},
        status=status.HTTP_200_OK
    )
# Branch views

@extend_schema(
    responses={200: BranchSerializer(many=True)},
    summary='List branches',
    description='List all branches in a repository.'
)
@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def branch_list(request, owner_id, repo_name):
    """List branches in a repository."""
    repository = get_repository_or_404(owner_id, repo_name, request.user)
    branches = Branch.objects.filter(repository=repository)
    serializer = BranchSerializer(branches, many=True)
    return Response(serializer.data, status=status.HTTP_200_OK)


@extend_schema(
    request=BranchCreateSerializer,
    responses={201: BranchSerializer, 400: OpenApiTypes.OBJECT},
    summary='Create branch',
    description='Create a new branch in a repository.'
)
@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated, IsRepositoryOwnerByParams])
def branch_create(request, owner_id, repo_name):
    """Create a new branch."""
    repository = get_repository_or_404(owner_id, repo_name, request.user)

    if repository.owner != request.user:
        return Response(
            {'error': 'Only the repository owner can create branches.'},
            status=status.HTTP_403_FORBIDDEN
        )

    serializer = BranchCreateSerializer(data=request.data)

    if serializer.is_valid():
        if Branch.objects.filter(
            repository=repository,
            name=serializer.validated_data['name']
        ).exists():
            return Response(
                {'error': 'Branch with this name already exists.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        branch = Branch.objects.create(
            repository=repository,
            **serializer.validated_data
        )

        return Response(
            {
                'message': 'Branch created successfully',
                'branch': BranchSerializer(branch).data
            },
            status=status.HTTP_201_CREATED
        )

    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@extend_schema(
    responses={200: BranchSerializer},
    summary='Get branch details',
    description='Get details of a specific branch.'
)
@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def branch_detail(request, owner_id, repo_name, branch_name):
    """Get branch details."""
    repository = get_repository_or_404(owner_id, repo_name, request.user)
    branch = get_object_or_404(Branch, repository=repository, name=branch_name)
    serializer = BranchSerializer(branch)
    return Response(serializer.data, status=status.HTTP_200_OK)


# Commit views

@extend_schema(
    responses={200: CommitSerializer(many=True)},
    summary='List commits',
    description='List all commits in a repository.'
)
@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def commit_list(request, owner_id, repo_name):
    """List commits in a repository."""
    repository = get_repository_or_404(owner_id, repo_name, request.user)
    commits = Commit.objects.filter(repository=repository)
    serializer = CommitSerializer(commits, many=True)
    return Response(serializer.data, status=status.HTTP_200_OK)


@extend_schema(
    request=CommitCreateSerializer,
    responses={201: CommitSerializer, 400: OpenApiTypes.OBJECT},
    summary='Create commit',
    description='Create a new commit in a repository.'
)
@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated, IsRepositoryOwnerByParams])
def commit_create(request, owner_id, repo_name):
    """Create a new commit."""
    repository = get_repository_or_404(owner_id, repo_name, request.user)

    if repository.owner != request.user:
        return Response(
            {'error': 'Only the repository owner can create commits.'},
            status=status.HTTP_403_FORBIDDEN
        )

    serializer = CommitCreateSerializer(data=request.data)

    if serializer.is_valid():
        tree_sha = serializer.validated_data['tree_sha']
        if not Tree.objects.filter(repository=repository, sha=tree_sha).exists():
            return Response(
                {'error': f'Tree {tree_sha} does not exist.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        commit_content = f"tree {tree_sha}\n"
        for parent_sha in serializer.validated_data.get('parent_shas', []):
            commit_content += f"parent {parent_sha}\n"

        commit_content += f"author {serializer.validated_data.get('author_name', request.user.get_full_name())}\n"
        commit_content += f"{serializer.validated_data['message']}\n"

        sha = calculate_sha1(commit_content)

        if Commit.objects.filter(sha=sha).exists():
            return Response(
                {'error': 'Commit with this SHA already exists.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        commit = Commit.objects.create(
            repository=repository,
            sha=sha,
            author=request.user,
            message=serializer.validated_data['message'],
            tree_sha=tree_sha,
            parent_shas=serializer.validated_data.get('parent_shas', []),
            author_name=serializer.validated_data.get('author_name', request.user.get_full_name()),
            author_email=serializer.validated_data.get('author_email', request.user.email),
            committed_at=timezone.now()
        )

        branch_name = serializer.validated_data.get('branch')
        if branch_name:
            branch = Branch.objects.filter(repository=repository, name=branch_name).first()
            if branch:
                branch.commit_sha = sha
                branch.save()

        return Response(
            {
                'message': 'Commit created successfully',
                'commit': CommitSerializer(commit).data
            },
            status=status.HTTP_201_CREATED
        )

    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@extend_schema(
    responses={200: CommitSerializer},
    summary='Get commit details',
    description='Get details of a specific commit.'
)
@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def commit_detail(request, owner_id, repo_name, sha):
    """Get commit details."""
    repository = get_repository_or_404(owner_id, repo_name, request.user)
    commit = get_object_or_404(Commit, repository=repository, sha=sha)
    serializer = CommitSerializer(commit)
    return Response(serializer.data, status=status.HTTP_200_OK)


# Tree and Blob views

@extend_schema(
    request=TreeCreateSerializer,
    responses={201: TreeSerializer, 400: OpenApiTypes.OBJECT},
    summary='Create tree',
    description='Create a new tree object in a repository.'
)
@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated, IsRepositoryOwnerByParams])
def tree_create(request, owner_id, repo_name):
    """Create a new tree."""
    repository = get_repository_or_404(owner_id, repo_name, request.user)

    if repository.owner != request.user:
        return Response(
            {'error': 'Only the repository owner can create trees.'},
            status=status.HTTP_403_FORBIDDEN
        )

    serializer = TreeCreateSerializer(data=request.data)

    if serializer.is_valid():
        entries = serializer.validated_data['entries']

        tree_content = ""
        for entry in entries:
            tree_content += f"{entry['mode']} {entry['type']} {entry['sha']}\t{entry['name']}\n"

        sha = calculate_sha1(tree_content)

        tree, created = Tree.objects.get_or_create(
            repository=repository,
            sha=sha,
            defaults={'entries': entries}
        )

        return Response(
            {
                'message': 'Tree created successfully' if created else 'Tree already exists',
                'tree': TreeSerializer(tree).data
            },
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK
        )

    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@extend_schema(
    responses={200: TreeSerializer},
    summary='Get tree',
    description='Get a tree object by SHA.'
)
@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def tree_detail(request, owner_id, repo_name, sha):
    """Get tree details."""
    repository = get_repository_or_404(owner_id, repo_name, request.user)
    tree = get_object_or_404(Tree, repository=repository, sha=sha)
    serializer = TreeSerializer(tree)
    return Response(serializer.data, status=status.HTTP_200_OK)


@extend_schema(
    request=BlobCreateSerializer,
    responses={201: BlobSerializer, 400: OpenApiTypes.OBJECT},
    summary='Create blob',
    description='Create a new blob object (file content) in a repository.'
)
@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated, IsRepositoryOwnerByParams])
def blob_create(request, owner_id, repo_name):
    """Create a new blob."""
    repository = get_repository_or_404(owner_id, repo_name, request.user)

    if repository.owner != request.user:
        return Response(
            {'error': 'Only the repository owner can create blobs.'},
            status=status.HTTP_403_FORBIDDEN
        )

    serializer = BlobCreateSerializer(data=request.data)

    if serializer.is_valid():
        content = serializer.validated_data['content']
        encoding = serializer.validated_data.get('encoding', 'utf-8')

        sha = calculate_sha1(content)

        blob_data = save_blob_content(repository, sha, content, encoding)

        blob, created = Blob.objects.get_or_create(
            repository=repository,
            sha=sha,
            defaults=blob_data
        )

        return Response(
            {
                'message': 'Blob created successfully' if created else 'Blob already exists',
                'blob': BlobSerializer(blob).data
            },
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK
        )

    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@extend_schema(
    responses={200: BlobSerializer},
    summary='Get blob',
    description='Get a blob object by SHA.'
)
@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def blob_detail(request, owner_id, repo_name, sha):
    """Get blob details."""
    repository = get_repository_or_404(owner_id, repo_name, request.user)
    blob = get_object_or_404(Blob, repository=repository, sha=sha)

    if blob.file_path and not blob.content:
        with open(blob.file_path, 'rb') as f:
            content = f.read().decode('utf-8', errors='replace')
            blob.content = content

    serializer = BlobSerializer(blob)
    return Response(serializer.data, status=status.HTTP_200_OK)
