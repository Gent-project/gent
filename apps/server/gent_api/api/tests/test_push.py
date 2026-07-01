import base64
import os
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken
from django.test import TestCase
from api.models import User, Repository, Branch, Commit, Tree, Blob
from api.tests.helpers import RepositoryAccessTestMixin
from api.utils import hash_blob


HELLO_WORLD_SHA = hash_blob(b'Hello, World!')
HELLO_SHA = hash_blob(b'hello')


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

    def _blob_entry(self, content, encoding='utf-8'):
        if isinstance(content, str):
            content_bytes = content.encode('utf-8')
        else:
            content_bytes = content

        if encoding == 'base64':
            payload = base64.b64encode(content_bytes).decode('utf-8')
        else:
            payload = content_bytes.decode('utf-8')

        return {
            'sha': hash_blob(content_bytes),
            'size': len(content_bytes),
            'content': payload,
            'encoding': encoding,
        }

    def _cli_blob_object(self, content):
        if isinstance(content, str):
            content_bytes = content.encode('utf-8')
        else:
            content_bytes = content

        return {
            'hash': hash_blob(content_bytes),
            'type': 'blob',
            'data': base64.b64encode(content_bytes).decode('utf-8'),
        }

    def test_push_success(self):
        blob_sha = HELLO_WORLD_SHA
        blobs = [self._blob_entry('Hello, World!')]
        trees = [{
            'sha': 'tree123',
            'entries': [
                {'type': 'blob', 'mode': '100644', 'name': 'README.md', 'sha': blob_sha}
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

        self.assertTrue(Blob.objects.filter(repository=self.repo, sha=blob_sha).exists())
        self.assertTrue(Tree.objects.filter(repository=self.repo, sha='tree123').exists())
        self.assertTrue(Commit.objects.filter(sha='commit123').exists())

        branch = Branch.objects.get(repository=self.repo, name='main')
        self.assertEqual(branch.commit_sha, 'commit123')

    def test_push_idempotent(self):
        blob_sha = HELLO_WORLD_SHA
        blobs = [self._blob_entry('Hello, World!')]
        trees = [{
            'sha': 'tree123',
            'entries': [
                {'type': 'blob', 'mode': '100644', 'name': 'README.md', 'sha': blob_sha}
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

        self.assertEqual(Blob.objects.filter(repository=self.repo, sha=blob_sha).count(), 1)
        self.assertEqual(Tree.objects.filter(repository=self.repo, sha='tree123').count(), 1)
        self.assertEqual(Commit.objects.filter(sha='commit123').count(), 1)

    def test_push_with_branch_update(self):
        blob_sha = HELLO_WORLD_SHA
        blobs = [self._blob_entry('Hello, World!')]
        trees = [{
            'sha': 'tree123',
            'entries': [
                {'type': 'blob', 'mode': '100644', 'name': 'README.md', 'sha': blob_sha}
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
        blob_sha = hash_blob(large_content)
        blobs = [self._blob_entry(large_content, encoding='base64')]
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
        blob_sha = HELLO_WORLD_SHA
        objects = [self._cli_blob_object(blob_content)]
        commits = [{
            'hash': 'commit123',
            'message': 'Initial commit',
            'author': {'name': 'Test User', 'email': 'user@example.com'},
            'timestamp': '2024-01-15T10:30:00Z',
            'parent': None,
            'mergeParent': None,
            'treeHash': 'tree123',
            'tree': [
                {'type': 'blob', 'mode': '100644', 'name': 'README.md', 'hash': blob_sha}
            ],
            'files': [
                {'path': 'README.md', 'hash': blob_sha}
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
            {'type': 'blob', 'mode': '100644', 'name': 'README.md', 'sha': blob_sha}
        ])

        blob = Blob.objects.get(repository=self.repo, sha=blob_sha)
        self.assertEqual(blob.content, blob_content.decode('utf-8'))
        self.assertEqual(blob.size, len(blob_content))

    def test_push_accepts_cli_parent_shape(self):
        blob_content = b'hello'
        blob_sha = HELLO_SHA
        objects = [self._cli_blob_object(blob_content)]
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
                    {'type': 'blob', 'mode': '100644', 'name': 'README.md', 'hash': blob_sha}
                ],
                'files': [{'path': 'README.md', 'hash': blob_sha}],
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
                    {'type': 'blob', 'mode': '100644', 'name': 'README.md', 'hash': blob_sha}
                ],
                'files': [{'path': 'README.md', 'hash': blob_sha}],
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

    def test_hash_blob_matches_cli_algorithm(self):
        self.assertEqual(
            hash_blob(b'hello world'),
            'fee53a18d32820613c0527aa79be5cb30173c823a9b448fa4817767cc84c6f03',
        )

    def test_push_rejects_blob_hash_mismatch(self):
        blobs = [self._blob_entry('Hello, World!')]
        wrong_sha = '0' * 64
        blobs[0]['sha'] = wrong_sha
        trees = [{
            'sha': 'tree123',
            'entries': [
                {'type': 'blob', 'mode': '100644', 'name': 'README.md', 'sha': wrong_sha}
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
        response = self.client.post(self.push_url, data, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('content hash mismatch', str(response.data))
        self.assertFalse(Blob.objects.filter(repository=self.repo).exists())

    def test_push_rejects_blob_size_mismatch(self):
        blob_sha = HELLO_WORLD_SHA
        blobs = [self._blob_entry('Hello, World!')]
        blobs[0]['size'] = 999
        trees = [{
            'sha': 'tree123',
            'entries': [
                {'type': 'blob', 'mode': '100644', 'name': 'README.md', 'sha': blob_sha}
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
        response = self.client.post(self.push_url, data, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('size mismatch', str(response.data))
        self.assertFalse(Blob.objects.filter(repository=self.repo).exists())

    def test_push_rejects_invalid_base64_blob(self):
        blob_sha = HELLO_WORLD_SHA
        blobs = [{
            'sha': blob_sha,
            'size': 13,
            'content': 'not-valid-base64!!!',
            'encoding': 'base64',
        }]
        trees = [{
            'sha': 'tree123',
            'entries': [
                {'type': 'blob', 'mode': '100644', 'name': 'README.md', 'sha': blob_sha}
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
        response = self.client.post(self.push_url, data, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('Invalid blob content encoding', str(response.data))
        self.assertFalse(Blob.objects.filter(repository=self.repo).exists())

    def test_push_cli_rejects_blob_hash_mismatch(self):
        blob_content = b'Hello, World!'
        wrong_hash = '0' * 64
        objects = [{
            'hash': wrong_hash,
            'type': 'blob',
            'data': base64.b64encode(blob_content).decode('utf-8'),
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
                {'type': 'blob', 'mode': '100644', 'name': 'README.md', 'hash': wrong_hash}
            ],
            'files': [{'path': 'README.md', 'hash': wrong_hash}],
            'stats': {},
        }]
        data = self._build_cli_payload(objects=objects, commits=commits)

        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.token}')
        response = self.client.post(self.push_url, data, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('content hash mismatch', str(response.data))
        self.assertFalse(Blob.objects.filter(repository=self.repo).exists())

    def test_push_skips_storage_for_existing_blob(self):
        blob_sha = HELLO_WORLD_SHA
        blobs = [self._blob_entry('Hello, World!')]
        trees = [{
            'sha': 'tree123',
            'entries': [
                {'type': 'blob', 'mode': '100644', 'name': 'README.md', 'sha': blob_sha}
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

        response2 = self.client.post(self.push_url, data, format='json')
        self.assertEqual(response2.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response2.data['blobs_created'], 0)
        self.assertEqual(Blob.objects.filter(repository=self.repo, sha=blob_sha).count(), 1)

    def test_push_rejects_tampered_blob_when_sha_already_exists(self):
        blob_sha = HELLO_WORLD_SHA
        blobs = [self._blob_entry('Hello, World!')]
        trees = [{
            'sha': 'tree123',
            'entries': [
                {'type': 'blob', 'mode': '100644', 'name': 'README.md', 'sha': blob_sha}
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

        tampered = self._build_pack(blobs=blobs, trees=trees, commits=commits)
        tampered['pack']['blobs'][0]['content'] = 'tampered content'
        tampered['pack']['blobs'][0]['size'] = len('tampered content')

        response2 = self.client.post(self.push_url, tampered, format='json')
        self.assertEqual(response2.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('content hash mismatch', str(response2.data))
        self.assertEqual(Blob.objects.filter(repository=self.repo, sha=blob_sha).count(), 1)


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
