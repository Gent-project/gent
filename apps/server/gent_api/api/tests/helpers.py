from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken
from api.models import User, Repository, Branch, RepositoryMember, RepositoryMemberRole


class RepositoryAccessTestMixin:
    """Shared setup for repository role-matrix tests."""

    def setUp(self):
        self.client = APIClient()
        self.owner = User.objects.create_user(
            email='owner@example.com',
            password='testpass123',
        )
        self.write_member = User.objects.create_user(
            email='writer@example.com',
            password='testpass123',
        )
        self.read_member = User.objects.create_user(
            email='reader@example.com',
            password='testpass123',
        )
        self.outsider = User.objects.create_user(
            email='outsider@example.com',
            password='testpass123',
        )

        self.repo = Repository.objects.create(
            owner=self.owner,
            name='team-repo',
            is_private=True,
        )
        Branch.objects.create(repository=self.repo, name='main', commit_sha='0' * 64)
        RepositoryMember.objects.create(
            repository=self.repo,
            user=self.write_member,
            role=RepositoryMemberRole.WRITE,
            added_by=self.owner,
        )
        RepositoryMember.objects.create(
            repository=self.repo,
            user=self.read_member,
            role=RepositoryMemberRole.READ,
            added_by=self.owner,
        )

        self.owner_token = str(RefreshToken.for_user(self.owner).access_token)
        self.write_token = str(RefreshToken.for_user(self.write_member).access_token)
        self.read_token = str(RefreshToken.for_user(self.read_member).access_token)
        self.outsider_token = str(RefreshToken.for_user(self.outsider).access_token)

    def _build_push_payload(self):
        return {
            'pack': {
                'commits': [{
                    'sha': 'commit123',
                    'message': 'Member push',
                    'tree_sha': 'tree123',
                    'parent_shas': [],
                    'author_name': 'Writer',
                    'author_email': 'writer@example.com',
                    'committed_at': '2024-01-15T10:30:00Z',
                }],
                'trees': [{
                    'sha': 'tree123',
                    'entries': [],
                }],
                'blobs': [],
            },
            'branch_updates': [{'name': 'main', 'commit_sha': 'commit123'}],
        }
