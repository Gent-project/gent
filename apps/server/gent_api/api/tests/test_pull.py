import base64
import os
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken
from django.test import TestCase
from api.models import User, Repository, Branch, Commit, Tree, Blob


class PullAPITestCase(TestCase):
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
        self.pull_url = reverse('pull', kwargs={'owner_id': self.user.id, 'repo_name': 'test-repo'})

    def test_pull_empty_branch(self):
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.token}')
        response = self.client.get(self.pull_url, {'branch': 'main'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['branch'], 'main')
        self.assertEqual(response.data['commits'], [])
        self.assertEqual(response.data['objects'], [])
        self.assertIsNone(response.data['head'])

    def test_pull_full_history(self):
        blob = Blob.objects.create(
            repository=self.repo,
            sha='blob123',
            size=13,
            content='Hello, World!'
        )
        tree = Tree.objects.create(
            repository=self.repo,
            sha='tree123',
            entries=[
                {'type': 'blob', 'mode': '100644', 'name': 'README.md', 'sha': 'blob123'}
            ]
        )
        commit = Commit.objects.create(
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

        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.token}')
        response = self.client.get(self.pull_url, {'branch': 'main'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['head'], 'commit123')
        self.assertEqual(len(response.data['commits']), 1)
        c = response.data['commits'][0]
        self.assertEqual(c['hash'], 'commit123')
        self.assertEqual(c['parent'], None)
        self.assertEqual(c['mergeParent'], None)
        self.assertEqual(c['treeHash'], 'tree123')
        self.assertEqual(c['tree'], [
            {'mode': '100644', 'name': 'README.md', 'hash': 'blob123', 'type': 'blob'}
        ])
        self.assertEqual(c['files'], [
            {'path': 'README.md', 'hash': 'blob123'}
        ])
        self.assertEqual(c['stats'], {})

        self.assertEqual(len(response.data['objects']), 1)
        obj = response.data['objects'][0]
        self.assertEqual(obj['hash'], 'blob123')
        self.assertEqual(obj['type'], 'blob')
        self.assertEqual(obj['data'], base64.b64encode(b'Hello, World!').decode('ascii'))

    def test_pull_with_since(self):
        tree1 = Tree.objects.create(repository=self.repo, sha='tree1', entries=[])
        commit1 = Commit.objects.create(
            repository=self.repo,
            sha='commit1',
            author=self.user,
            message='First',
            tree_sha='tree1',
            parent_shas=[],
            author_name='A',
            author_email='a@a.com',
            committed_at='2024-01-10T00:00:00Z'
        )
        tree2 = Tree.objects.create(repository=self.repo, sha='tree2', entries=[])
        commit2 = Commit.objects.create(
            repository=self.repo,
            sha='commit2',
            author=self.user,
            message='Second',
            tree_sha='tree2',
            parent_shas=['commit1'],
            author_name='A',
            author_email='a@a.com',
            committed_at='2024-01-11T00:00:00Z'
        )
        branch = Branch.objects.get(repository=self.repo, name='main')
        branch.commit_sha = 'commit2'
        branch.save()

        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.token}')
        response = self.client.get(self.pull_url, {'branch': 'main', 'since': 'commit1'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['commits']), 1)
        self.assertEqual(response.data['commits'][0]['hash'], 'commit2')

    def test_pull_since_not_in_history(self):
        tree1 = Tree.objects.create(repository=self.repo, sha='tree1', entries=[])
        commit1 = Commit.objects.create(
            repository=self.repo,
            sha='commit1',
            author=self.user,
            message='First',
            tree_sha='tree1',
            parent_shas=[],
            author_name='A',
            author_email='a@a.com',
            committed_at='2024-01-10T00:00:00Z'
        )
        branch = Branch.objects.get(repository=self.repo, name='main')
        branch.commit_sha = 'commit1'
        branch.save()

        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.token}')
        response = self.client.get(self.pull_url, {'branch': 'main', 'since': 'nonexistent'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['commits']), 1)

    def test_pull_missing_branch(self):
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.token}')
        response = self.client.get(self.pull_url, {'branch': 'no-branch'})
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_pull_unauthorized(self):
        self.repo.is_private = True
        self.repo.save(update_fields=['is_private'])
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.other_token}')
        response = self.client.get(self.pull_url, {'branch': 'main'})
        # private repo, other user -> 403 from get_repository_or_404
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_pull_large_blob_from_file(self):
        large_content = b'x' * (1024 * 1024 + 1)
        blob_sha = 'largeblob123'
        # simulate saved blob via util
        from api.utils import save_blob_content
        blob_data = save_blob_content(self.repo, blob_sha, base64.b64encode(large_content).decode('utf-8'), 'base64')
        blob = Blob.objects.create(
            repository=self.repo,
            sha=blob_sha,
            size=blob_data['size'],
            content=blob_data['content'],
            file_path=blob_data['file_path']
        )
        tree = Tree.objects.create(
            repository=self.repo,
            sha='tree123',
            entries=[
                {'type': 'blob', 'mode': '100644', 'name': 'large.bin', 'sha': blob_sha}
            ]
        )
        commit = Commit.objects.create(
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
        response = self.client.get(self.pull_url, {'branch': 'main'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['objects']), 1)
        obj = response.data['objects'][0]
        self.assertEqual(obj['hash'], blob_sha)
        self.assertEqual(obj['data'], base64.b64encode(large_content).decode('ascii'))

    def test_pull_flattens_nested_trees_for_cli(self):
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
        response = self.client.get(self.pull_url, {'branch': 'main'})

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

    def test_pull_includes_merge_parent_history(self):
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
        response = self.client.get(self.pull_url, {'branch': 'main', 'since': 'base-commit'})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            [commit['hash'] for commit in response.data['commits']],
            ['main-commit', 'side-commit', 'merge-commit']
        )
        self.assertEqual(response.data['commits'][-1]['mergeParent'], 'side-commit')
