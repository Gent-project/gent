from rest_framework import status, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from drf_spectacular.utils import extend_schema
from drf_spectacular.types import OpenApiTypes
from django.db import transaction
from ..models import Commit, Tree, Blob, Branch, Tag
from ..serializers import (
    PushPackSerializer,
    PushCommitSerializer,
    PushTreeSerializer,
    PushBlobSerializer,
    BranchUpdateSerializer,
    BranchSerializer,
)
from ..utils import save_blob_content, get_repository_or_404
from ..permissions import IsRepositoryOwnerByParams


@extend_schema(
    request=PushPackSerializer,
    responses={201: OpenApiTypes.OBJECT, 400: OpenApiTypes.OBJECT, 403: OpenApiTypes.OBJECT},
    summary='Push pack',
    description='Receive a pack of commits, trees, and blobs, update branches atomically.'
)
@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated, IsRepositoryOwnerByParams])
def push(request, owner_id, repo_name):
    """Push a pack of objects and update branches."""
    repository = get_repository_or_404(owner_id, repo_name, request.user)

    if repository.owner != request.user:
        return Response(
            {'error': 'Only the repository owner can push.'},
            status=status.HTTP_403_FORBIDDEN
        )

    serializer = PushPackSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    pack = serializer.validated_data['pack']
    branch_updates = serializer.validated_data.get('branch_updates', [])
    tags = request.data.get('tags', {})

    commits_data = pack.get('commits', [])
    trees_data = pack.get('trees', [])
    blobs_data = pack.get('blobs', [])

    commits_serializer = PushCommitSerializer(data=commits_data, many=True)
    trees_serializer = PushTreeSerializer(data=trees_data, many=True)
    blobs_serializer = PushBlobSerializer(data=blobs_data, many=True)
    branch_updates_serializer = BranchUpdateSerializer(data=branch_updates, many=True)

    if not commits_serializer.is_valid():
        return Response(
            {'error': 'Invalid commits', 'details': commits_serializer.errors},
            status=status.HTTP_400_BAD_REQUEST
        )
    if not trees_serializer.is_valid():
        return Response(
            {'error': 'Invalid trees', 'details': trees_serializer.errors},
            status=status.HTTP_400_BAD_REQUEST
        )
    if not blobs_serializer.is_valid():
        return Response(
            {'error': 'Invalid blobs', 'details': blobs_serializer.errors},
            status=status.HTTP_400_BAD_REQUEST
        )
    if not branch_updates_serializer.is_valid():
        return Response(
            {'error': 'Invalid branch_updates', 'details': branch_updates_serializer.errors},
            status=status.HTTP_400_BAD_REQUEST
        )

    commits = commits_serializer.validated_data
    trees = trees_serializer.validated_data
    blobs = blobs_serializer.validated_data
    branch_updates = branch_updates_serializer.validated_data

    pack_blob_shas = {b['sha'] for b in blobs}
    pack_tree_shas = {t['sha'] for t in trees}
    pack_commit_shas = {c['sha'] for c in commits}

    existing_blob_shas = set(
        Blob.objects.filter(repository=repository).values_list('sha', flat=True)
    )
    existing_tree_shas = set(
        Tree.objects.filter(repository=repository).values_list('sha', flat=True)
    )
    existing_commit_shas = set(
        Commit.objects.filter(sha__in=pack_commit_shas).values_list('sha', flat=True)
    )

    for tree in trees:
        for entry in tree['entries']:
            entry_sha = entry['sha']
            entry_type = entry['type']
            if entry_type == 'blob':
                if entry_sha not in pack_blob_shas and entry_sha not in existing_blob_shas:
                    return Response(
                        {'error': f"Tree {tree['sha']} references missing blob {entry_sha}"},
                        status=status.HTTP_400_BAD_REQUEST
                    )
            elif entry_type == 'tree':
                if entry_sha not in pack_tree_shas and entry_sha not in existing_tree_shas:
                    return Response(
                        {'error': f"Tree {tree['sha']} references missing tree {entry_sha}"},
                        status=status.HTTP_400_BAD_REQUEST
                    )

    for commit in commits:
        tree_sha = commit['tree_sha']
        if tree_sha not in pack_tree_shas and not Tree.objects.filter(repository=repository, sha=tree_sha).exists():
            return Response(
                {'error': f"Commit {commit['sha']} references missing tree {tree_sha}"},
                status=status.HTTP_400_BAD_REQUEST
            )

        for parent_sha in commit.get('parent_shas', []):
            if parent_sha not in pack_commit_shas and not Commit.objects.filter(sha=parent_sha).exists():
                return Response(
                    {'error': f"Commit {commit['sha']} references missing parent {parent_sha}"},
                    status=status.HTTP_400_BAD_REQUEST
                )

    for tag_name, tag_data in tags.items():
        tag_commit_sha = tag_data.get('hash')
        if not tag_commit_sha:
            return Response(
                {'error': f"Tag '{tag_name}' missing commit hash."},
                status=status.HTTP_400_BAD_REQUEST
            )
        if tag_commit_sha not in pack_commit_shas and not Commit.objects.filter(repository=repository, sha=tag_commit_sha).exists():
            return Response(
                {'error': f"Tag '{tag_name}' references missing commit {tag_commit_sha}."},
                status=status.HTTP_400_BAD_REQUEST
            )

    with transaction.atomic():
        commits_created = 0
        trees_created = 0
        blobs_created = 0
        branches_updated = 0

        for blob in blobs:
            if blob['sha'] in existing_blob_shas:
                continue
            blob_data = save_blob_content(repository, blob['sha'], blob['content'], blob['encoding'])
            Blob.objects.create(
                repository=repository,
                sha=blob['sha'],
                size=blob_data['size'],
                content=blob_data['content'],
                file_path=blob_data['file_path']
            )
            blobs_created += 1
            existing_blob_shas.add(blob['sha'])

        for tree in trees:
            if tree['sha'] in existing_tree_shas:
                continue
            Tree.objects.create(
                repository=repository,
                sha=tree['sha'],
                entries=tree['entries']
            )
            trees_created += 1
            existing_tree_shas.add(tree['sha'])

        for commit in commits:
            if commit['sha'] in existing_commit_shas:
                continue
            Commit.objects.create(
                repository=repository,
                sha=commit['sha'],
                author=request.user,
                message=commit['message'],
                tree_sha=commit['tree_sha'],
                parent_shas=commit.get('parent_shas', []),
                author_name=commit['author_name'],
                author_email=commit['author_email'],
                committed_at=commit['committed_at']
            )
            commits_created += 1
            existing_commit_shas.add(commit['sha'])

        for update in branch_updates:
            branch, created = Branch.objects.get_or_create(
                repository=repository,
                name=update['name'],
                defaults={'commit_sha': update['commit_sha']}
            )
            if not created:
                branch.commit_sha = update['commit_sha']
                branch.save()
            branches_updated += 1

        tags_created = 0
        for tag_name, tag_data in tags.items():
            defaults = {
                'commit_sha': tag_data.get('hash'),
                'message': tag_data.get('message', ''),
                'annotated': tag_data.get('annotated', False),
                'tagger_name': tag_data.get('tagger', {}).get('name', ''),
                'tagger_email': tag_data.get('tagger', {}).get('email', ''),
            }
            tag_obj, created = Tag.objects.update_or_create(
                repository=repository,
                name=tag_name,
                defaults=defaults
            )
            if created:
                tags_created += 1

    return Response(
        {
            'message': 'Push successful',
            'commits_created': commits_created,
            'trees_created': trees_created,
            'blobs_created': blobs_created,
            'branches_updated': branches_updated,
            'tags_created': tags_created
        },
        status=status.HTTP_201_CREATED
    )
