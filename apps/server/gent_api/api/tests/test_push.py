import base64
import os
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken
from django.test import TestCase
from api.models import User, Repository, Branch, Commit, Tree, Blob
from api.tests.helpers import RepositoryAccessTestMixin


class PushAPITestCase(TestCase):
    """Test cases for push API."""

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            email='user@example.com',
            password='testpass123',
            first_name='Test',
            last_name='User'
        )
        self.other_user = User.objects.create_user(
            email='other@example.com',
            password='testpass123'
        )
        refresh = RefreshToken.for_user(self.user)
        self.token = str(refresh.access_token)
        refresh_other = RefreshToken.for_user(self.other_user)
        self.other_token = str(refresh_other.access_token)

        self.repo = Repository.objects.create(owner=self.user, name='test-repo')
        Branch.objects.create(repository=self.repo, name='main', commit_sha='0' * 64)
        self.push_url = reverse('push', kwargs={'owner_id': self.user.id, 'repo_name': 'test-repo'})

    def _build_pack(self, blobs=None, trees=None, commits=None, branch_updates=None):
        return {
            'pack': {
                'commits': commits or [],
                'trees': trees or [],
                'blobs': blobs or []
            },
            'branch_updates': branch_updates or []
        }

    def _build_cli_payload(self, objects=None, commits=None, branch='main', force=False, tags=None):
        return {
            'branch': branch,
            'force': force,
            'commits': commits or [],
            'objects': objects or [],
            'tags': tags or {}
        }

    def test_push_success(self):
        blobs = [{'sha': 'blob123', 'size': 13, 'content': 'Hello, World!', 'encoding': 'utf-8'}]
        trees = [{
            'sha': 'tree123',
            'entries': [
                {'type': 'blob', 'mode': '100644', 'name': 'README.md', 'sha': 'blob123'}
            ]
        }]
        commits = [{
            'sha': 'commit123',
            'message': 'Initial commit',
            'tree_sha': 'tree123',
            'parent_shas': [],
            'author_name': 'Test User',
            'author_email': 'user@example.com',
            'committed_at': '2024-01-15T10:30:00Z'
        }]
        branch_updates = [{'name': 'main', 'commit_sha': 'commit123'}]
        data = self._build_pack(blobs=blobs, trees=trees, commits=commits, branch_updates=branch_updates)

        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.token}')
        response = self.client.post(self.push_url, data, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['commits_created'], 1)
        self.assertEqual(response.data['trees_created'], 1)
        self.assertEqual(response.data['blobs_created'], 1)
        self.assertEqual(response.data['branches_updated'], 1)

        self.assertTrue(Blob.objects.filter(repository=self.repo, sha='blob123').exists())
        self.assertTrue(Tree.objects.filter(repository=self.repo, sha='tree123').exists())
        self.assertTrue(Commit.objects.filter(sha='commit123').exists())

        branch = Branch.objects.get(repository=self.repo, name='main')
        self.assertEqual(branch.commit_sha, 'commit123')

    def test_push_idempotent(self):
        blobs = [{'sha': 'blob123', 'size': 13, 'content': 'Hello, World!', 'encoding': 'utf-8'}]
        trees = [{
            'sha': 'tree123',
            'entries': [
                {'type': 'blob', 'mode': '100644', 'name': 'README.md', 'sha': 'blob123'}
            ]
        }]
        commits = [{
            'sha': 'commit123',
            'message': 'Initial commit',
            'tree_sha': 'tree123',
            'parent_shas': [],
            'author_name': 'Test User',
            'author_email': 'user@example.com',
            'committed_at': '2024-01-15T10:30:00Z'
        }]
        data = self._build_pack(blobs=blobs, trees=trees, commits=commits)

        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.token}')
        response1 = self.client.post(self.push_url, data, format='json')
        self.assertEqual(response1.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response1.data['blobs_created'], 1)
        self.assertEqual(response1.data['trees_created'], 1)
        self.assertEqual(response1.data['commits_created'], 1)

        response2 = self.client.post(self.push_url, data, format='json')
        self.assertEqual(response2.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response2.data['blobs_created'], 0)
        self.assertEqual(response2.data['trees_created'], 0)
        self.assertEqual(response2.data['commits_created'], 0)

        self.assertEqual(Blob.objects.filter(repository=self.repo, sha='blob123').count(), 1)
        self.assertEqual(Tree.objects.filter(repository=self.repo, sha='tree123').count(), 1)
        self.assertEqual(Commit.objects.filter(sha='commit123').count(), 1)

    def test_push_with_branch_update(self):
        blobs = [{'sha': 'blob123', 'size': 13, 'content': 'Hello, World!', 'encoding': 'utf-8'}]
        trees = [{
            'sha': 'tree123',
            'entries': [
                {'type': 'blob', 'mode': '100644', 'name': 'README.md', 'sha': 'blob123'}
            ]
        }]
        commits = [{
            'sha': 'commit123',
            'message': 'Initial commit',
            'tree_sha': 'tree123',
            'parent_shas': [],
            'author_name': 'Test User',
            'author_email': 'user@example.com',
            'committed_at': '2024-01-15T10:30:00Z'
        }]
        branch_updates = [{'name': 'main', 'commit_sha': 'commit123'}]
        data = self._build_pack(blobs=blobs, trees=trees, commits=commits, branch_updates=branch_updates)

        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.token}')
        response = self.client.post(self.push_url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['branches_updated'], 1)

        branch = Branch.objects.get(repository=self.repo, name='main')
        self.assertEqual(branch.commit_sha, 'commit123')

    def test_push_missing_tree_reference(self):
        commits = [{
            'sha': 'commit123',
            'message': 'Initial commit',
            'tree_sha': 'missing_tree',
            'parent_shas': [],
            'author_name': 'Test User',
            'author_email': 'user@example.com',
            'committed_at': '2024-01-15T10:30:00Z'
        }]
        data = self._build_pack(commits=commits)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.token}')
        response = self.client.post(self.push_url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('missing tree', str(response.data))

    def test_push_missing_parent_reference(self):
        trees = [{'sha': 'tree123', 'entries': []}]
        commits = [{
            'sha': 'commit123',
            'message': 'Second commit',
            'tree_sha': 'tree123',
            'parent_shas': ['missing_parent'],
            'author_name': 'Test User',
            'author_email': 'user@example.com',
            'committed_at': '2024-01-15T10:30:00Z'
        }]
        data = self._build_pack(trees=trees, commits=commits)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.token}')
        response = self.client.post(self.push_url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('missing parent', str(response.data))

    def test_push_unauthorized(self):
        data = self._build_pack()
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.other_token}')
        response = self.client.post(self.push_url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_push_large_base64_blob(self):
        large_content = b'x' * (1024 * 1024 + 1)
        large_content_b64 = base64.b64encode(large_content).decode('utf-8')
        blob_sha = 'largeblob123'

        blobs = [{
            'sha': blob_sha,
            'size': len(large_content),
            'content': large_content_b64,
            'encoding': 'base64'
        }]
        trees = [{
            'sha': 'tree123',
            'entries': [
                {'type': 'blob', 'mode': '100644', 'name': 'large.bin', 'sha': blob_sha}
            ]
        }]
        commits = [{
            'sha': 'commit123',
            'message': 'Add large file',
            'tree_sha': 'tree123',
            'parent_shas': [],
            'author_name': 'Test User',
            'author_email': 'user@example.com',
            'committed_at': '2024-01-15T10:30:00Z'
        }]
        data = self._build_pack(blobs=blobs, trees=trees, commits=commits)

        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.token}')
        response = self.client.post(self.push_url, data, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['blobs_created'], 1)

        blob = Blob.objects.get(repository=self.repo, sha=blob_sha)
        self.assertIsNone(blob.content)
        self.assertTrue(blob.file_path)
        self.assertTrue(os.path.exists(blob.file_path))

        with open(blob.file_path, 'rb') as f:
            stored_content = f.read()
        self.assertEqual(stored_content, large_content)

    def test_push_accepts_cli_payload_shape(self):
        blob_content = b'Hello, World!'
        objects = [{
            'hash': 'blob123',
            'type': 'blob',
            'data': base64.b64encode(blob_content).decode('utf-8')
        }]
        commits = [{
            'hash': 'commit123',
            'message': 'Initial commit',
            'author': {'name': 'Test User', 'email': 'user@example.com'},
            'timestamp': '2024-01-15T10:30:00Z',
            'parent': None,
            'mergeParent': None,
            'treeHash': 'tree123',
            'tree': [
                {'type': 'blob', 'mode': '100644', 'name': 'README.md', 'hash': 'blob123'}
            ],
            'files': [
                {'path': 'README.md', 'hash': 'blob123'}
            ],
            'stats': {'filesChanged': 1, 'insertions': 1, 'deletions': 0}
        }]
        data = self._build_cli_payload(objects=objects, commits=commits)

        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.token}')
        response = self.client.post(self.push_url, data, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['commits_created'], 1)
        self.assertEqual(response.data['trees_created'], 1)
        self.assertEqual(response.data['blobs_created'], 1)
        self.assertEqual(response.data['branches_updated'], 1)

        branch = Branch.objects.get(repository=self.repo, name='main')
        self.assertEqual(branch.commit_sha, 'commit123')

        commit = Commit.objects.get(repository=self.repo, sha='commit123')
        self.assertEqual(commit.tree_sha, 'tree123')
        self.assertEqual(commit.parent_shas, [])
        self.assertEqual(commit.author_name, 'Test User')
        self.assertEqual(commit.author_email, 'user@example.com')

        tree = Tree.objects.get(repository=self.repo, sha='tree123')
        self.assertEqual(tree.entries, [
            {'type': 'blob', 'mode': '100644', 'name': 'README.md', 'sha': 'blob123'}
        ])

        blob = Blob.objects.get(repository=self.repo, sha='blob123')
        self.assertEqual(blob.content, blob_content.decode('utf-8'))
        self.assertEqual(blob.size, len(blob_content))

    def test_push_accepts_cli_parent_shape(self):
        blob_content = b'hello'
        objects = [{
            'hash': 'blob123',
            'type': 'blob',
            'data': base64.b64encode(blob_content).decode('utf-8')
        }]
        commits = [
            {
                'hash': 'commit-base',
                'message': 'Base commit',
                'author': {'name': 'Test User', 'email': 'user@example.com'},
                'timestamp': '2024-01-15T10:30:00Z',
                'parent': None,
                'mergeParent': None,
                'treeHash': 'tree123',
                'tree': [
                    {'type': 'blob', 'mode': '100644', 'name': 'README.md', 'hash': 'blob123'}
                ],
                'files': [{'path': 'README.md', 'hash': 'blob123'}],
                'stats': {}
            },
            {
                'hash': 'commit-child',
                'message': 'Child commit',
                'author': {'name': 'Test User', 'email': 'user@example.com'},
                'timestamp': '2024-01-16T10:30:00Z',
                'parent': 'commit-base',
                'mergeParent': None,
                'treeHash': 'tree123',
                'tree': [
                    {'type': 'blob', 'mode': '100644', 'name': 'README.md', 'hash': 'blob123'}
                ],
                'files': [{'path': 'README.md', 'hash': 'blob123'}],
                'stats': {}
            }
        ]
        data = self._build_cli_payload(objects=objects, commits=commits)

        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.token}')
        response = self.client.post(self.push_url, data, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(
            Commit.objects.get(repository=self.repo, sha='commit-child').parent_shas,
            ['commit-base']
        )


class PushMemberAccessTestCase(RepositoryAccessTestMixin, TestCase):
    """Role-matrix tests for push access."""

    def setUp(self):
        super().setUp()
        self.push_url = reverse(
            'push',
            kwargs={'owner_id': self.owner.id, 'repo_name': 'team-repo'},
        )

    def test_push_owner_success(self):
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.owner_token}')
        response = self.client.post(self.push_url, self._build_push_payload(), format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_push_write_member_success(self):
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.write_token}')
        response = self.client.post(self.push_url, self._build_push_payload(), format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_push_read_member_denied(self):
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.read_token}')
        response = self.client.post(self.push_url, self._build_push_payload(), format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_push_outsider_denied(self):
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.outsider_token}')
        response = self.client.post(self.push_url, self._build_push_payload(), format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
