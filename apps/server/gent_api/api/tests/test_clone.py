import base64
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken
from django.test import TestCase
from api.models import User, Repository, Branch, Commit, Tree, Blob, Tag
from api.tests.helpers import RepositoryAccessTestMixin
from api.utils import save_blob_content


class CloneAPITestCase(TestCase):
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
        self.clone_url = reverse(
            'clone',
            kwargs={'owner_id': self.user.id, 'repo_name': 'test-repo'},
        )

    def test_clone_empty_repo(self):
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.token}')
        response = self.client.get(self.clone_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['name'], 'test-repo')
        self.assertEqual(response.data['description'], '')
        self.assertEqual(response.data['currentBranch'], 'main')
        self.assertEqual(response.data['commits'], [])
        self.assertEqual(response.data['objects'], [])
        self.assertEqual(response.data['branches'], {'main': None})
        self.assertEqual(response.data['tags'], {})

    def test_clone_full_history(self):
        Blob.objects.create(
            repository=self.repo,
            sha='blob123',
            size=13,
            content='Hello, World!'
        )
        Tree.objects.create(
            repository=self.repo,
            sha='tree123',
            entries=[
                {'type': 'blob', 'mode': '100644', 'name': 'README.md', 'sha': 'blob123'}
            ]
        )
        Commit.objects.create(
            repository=self.repo,
            sha='commit123',
            author=self.user,
            message='Initial commit',
            tree_sha='tree123',
            parent_shas=[],
            author_name='Test User',
            author_email='user@example.com',
            committed_at='2024-01-15T10:30:00Z'
        )
        branch = Branch.objects.get(repository=self.repo, name='main')
        branch.commit_sha = 'commit123'
        branch.save()
        Tag.objects.create(
            repository=self.repo,
            name='v1.0',
            commit_sha='commit123',
            message='First release',
            annotated=True,
            tagger_name='Test User',
            tagger_email='user@example.com',
        )

        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.token}')
        response = self.client.get(self.clone_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['branches'], {'main': 'commit123'})
        self.assertEqual(len(response.data['commits']), 1)

        commit = response.data['commits'][0]
        self.assertEqual(commit['hash'], 'commit123')
        self.assertEqual(commit['parent'], None)
        self.assertEqual(commit['mergeParent'], None)
        self.assertEqual(commit['treeHash'], 'tree123')
        self.assertEqual(commit['tree'], [
            {'mode': '100644', 'name': 'README.md', 'hash': 'blob123', 'type': 'blob'}
        ])
        self.assertEqual(commit['files'], [
            {'path': 'README.md', 'hash': 'blob123'}
        ])
        self.assertEqual(commit['stats'], {})

        self.assertEqual(len(response.data['objects']), 1)
        obj = response.data['objects'][0]
        self.assertEqual(obj['hash'], 'blob123')
        self.assertEqual(obj['type'], 'blob')
        self.assertEqual(obj['data'], base64.b64encode(b'Hello, World!').decode('ascii'))

        self.assertIn('v1.0', response.data['tags'])
        tag = response.data['tags']['v1.0']
        self.assertEqual(tag['hash'], 'commit123')
        self.assertEqual(tag['message'], 'First release')
        self.assertTrue(tag['annotated'])
        self.assertEqual(tag['tagger']['name'], 'Test User')
        self.assertEqual(tag['tagger']['email'], 'user@example.com')

    def test_clone_flattens_nested_trees(self):
        Blob.objects.create(
            repository=self.repo,
            sha='blob123',
            size=20,
            content='console.log("hi");'
        )
        Tree.objects.create(
            repository=self.repo,
            sha='subtree123',
            entries=[
                {'type': 'blob', 'mode': '100644', 'name': 'app.js', 'sha': 'blob123'}
            ]
        )
        Tree.objects.create(
            repository=self.repo,
            sha='roottree123',
            entries=[
                {'type': 'tree', 'mode': '040000', 'name': 'src', 'sha': 'subtree123'}
            ]
        )
        Commit.objects.create(
            repository=self.repo,
            sha='commit123',
            author=self.user,
            message='Add nested file',
            tree_sha='roottree123',
            parent_shas=[],
            author_name='Test User',
            author_email='user@example.com',
            committed_at='2024-01-15T10:30:00Z'
        )
        branch = Branch.objects.get(repository=self.repo, name='main')
        branch.commit_sha = 'commit123'
        branch.save()

        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.token}')
        response = self.client.get(self.clone_url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        commit = response.data['commits'][0]
        self.assertEqual(commit['tree'], [
            {'mode': '100644', 'name': 'src/app.js', 'hash': 'blob123', 'type': 'blob'}
        ])
        self.assertEqual(commit['files'], [
            {'path': 'src/app.js', 'hash': 'blob123'}
        ])
        self.assertEqual(response.data['objects'], [
            {
                'hash': 'blob123',
                'type': 'blob',
                'data': base64.b64encode(b'console.log("hi");').decode('ascii')
            }
        ])

    def test_clone_includes_merge_parent(self):
        Tree.objects.create(repository=self.repo, sha='tree-base', entries=[])
        Tree.objects.create(repository=self.repo, sha='tree-main', entries=[])
        Tree.objects.create(repository=self.repo, sha='tree-side', entries=[])
        Tree.objects.create(repository=self.repo, sha='tree-merge', entries=[])

        Commit.objects.create(
            repository=self.repo,
            sha='base-commit',
            author=self.user,
            message='Base commit',
            tree_sha='tree-base',
            parent_shas=[],
            author_name='Test User',
            author_email='user@example.com',
            committed_at='2024-01-10T00:00:00Z'
        )
        Commit.objects.create(
            repository=self.repo,
            sha='main-commit',
            author=self.user,
            message='Main branch commit',
            tree_sha='tree-main',
            parent_shas=['base-commit'],
            author_name='Test User',
            author_email='user@example.com',
            committed_at='2024-01-11T00:00:00Z'
        )
        Commit.objects.create(
            repository=self.repo,
            sha='side-commit',
            author=self.user,
            message='Side branch commit',
            tree_sha='tree-side',
            parent_shas=['base-commit'],
            author_name='Test User',
            author_email='user@example.com',
            committed_at='2024-01-12T00:00:00Z'
        )
        Commit.objects.create(
            repository=self.repo,
            sha='merge-commit',
            author=self.user,
            message='Merge branch',
            tree_sha='tree-merge',
            parent_shas=['main-commit', 'side-commit'],
            author_name='Test User',
            author_email='user@example.com',
            committed_at='2024-01-13T00:00:00Z'
        )
        branch = Branch.objects.get(repository=self.repo, name='main')
        branch.commit_sha = 'merge-commit'
        branch.save()

        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.token}')
        response = self.client.get(self.clone_url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            [commit['hash'] for commit in response.data['commits']],
            ['base-commit', 'main-commit', 'side-commit', 'merge-commit']
        )
        merge_commit = response.data['commits'][-1]
        self.assertEqual(merge_commit['mergeParent'], 'side-commit')

    def test_clone_large_blob_from_file(self):
        large_content = b'x' * (1024 * 1024 + 1)
        blob_sha = 'largeblob123'
        blob_data = save_blob_content(
            self.repo,
            blob_sha,
            base64.b64encode(large_content).decode('utf-8'),
            'base64',
        )
        Blob.objects.create(
            repository=self.repo,
            sha=blob_sha,
            size=blob_data['size'],
            content=blob_data['content'],
            file_path=blob_data['file_path']
        )
        Tree.objects.create(
            repository=self.repo,
            sha='tree123',
            entries=[
                {'type': 'blob', 'mode': '100644', 'name': 'large.bin', 'sha': blob_sha}
            ]
        )
        Commit.objects.create(
            repository=self.repo,
            sha='commit123',
            author=self.user,
            message='Add large file',
            tree_sha='tree123',
            parent_shas=[],
            author_name='Test User',
            author_email='user@example.com',
            committed_at='2024-01-15T10:30:00Z'
        )
        branch = Branch.objects.get(repository=self.repo, name='main')
        branch.commit_sha = 'commit123'
        branch.save()

        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.token}')
        response = self.client.get(self.clone_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['objects']), 1)
        obj = response.data['objects'][0]
        self.assertEqual(obj['hash'], blob_sha)
        self.assertEqual(obj['data'], base64.b64encode(large_content).decode('ascii'))

    def test_clone_unauthorized(self):
        self.repo.is_private = True
        self.repo.save(update_fields=['is_private'])
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.other_token}')
        response = self.client.get(self.clone_url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_clone_unauthenticated(self):
        response = self.client.get(self.clone_url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_clone_shared_tree_across_commits(self):
        Blob.objects.create(
            repository=self.repo,
            sha='blob123',
            size=5,
            content='same',
        )
        Tree.objects.create(
            repository=self.repo,
            sha='shared-tree',
            entries=[
                {'type': 'blob', 'mode': '100644', 'name': 'file.txt', 'sha': 'blob123'}
            ],
        )
        Commit.objects.create(
            repository=self.repo,
            sha='commit1',
            author=self.user,
            message='First',
            tree_sha='shared-tree',
            parent_shas=[],
            author_name='Test User',
            author_email='user@example.com',
            committed_at='2024-01-10T00:00:00Z',
        )
        Commit.objects.create(
            repository=self.repo,
            sha='commit2',
            author=self.user,
            message='Second',
            tree_sha='shared-tree',
            parent_shas=['commit1'],
            author_name='Test User',
            author_email='user@example.com',
            committed_at='2024-01-11T00:00:00Z',
        )
        branch = Branch.objects.get(repository=self.repo, name='main')
        branch.commit_sha = 'commit2'
        branch.save()

        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.token}')
        response = self.client.get(self.clone_url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['commits']), 2)
        for commit in response.data['commits']:
            self.assertEqual(commit['treeHash'], 'shared-tree')
            self.assertEqual(commit['tree'], [
                {'mode': '100644', 'name': 'file.txt', 'hash': 'blob123', 'type': 'blob'}
            ])
        self.assertEqual(len(response.data['objects']), 1)


class CloneMemberAccessTestCase(RepositoryAccessTestMixin, TestCase):
    """Role-matrix tests for clone access on private repos."""

    def setUp(self):
        super().setUp()
        self.clone_url = reverse(
            'clone',
            kwargs={'owner_id': self.owner.id, 'repo_name': 'team-repo'},
        )

    def test_clone_owner_success(self):
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.owner_token}')
        response = self.client.get(self.clone_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_clone_write_member_success(self):
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.write_token}')
        response = self.client.get(self.clone_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_clone_read_member_success(self):
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.read_token}')
        response = self.client.get(self.clone_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_clone_outsider_denied(self):
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.outsider_token}')
        response = self.client.get(self.clone_url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
