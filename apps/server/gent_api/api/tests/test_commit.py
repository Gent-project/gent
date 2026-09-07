from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken
from django.test import TestCase
from api.models import User, Repository, Branch, Commit, Tree


class CommitAPITestCase(TestCase):
    """Test cases for commit APIs."""

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            email='user@example.com',
            password='testpass123',
            first_name='Test',
            last_name='User'
        )
        refresh = RefreshToken.for_user(self.user)
        self.token = str(refresh.access_token)
        self.repo = Repository.objects.create(owner=self.user, name='test-repo')
        self.branch = Branch.objects.create(repository=self.repo, name='main', commit_sha='0' * 64)
        self.tree = Tree.objects.create(repository=self.repo, sha='tree123', entries=[])

    def test_create_commit(self):
        url = reverse('commit-create', kwargs={'owner_ref': self.user.id, 'repo_name': 'test-repo'})
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.token}')
        commit_sha = 'a' * 64
        data = {
            'sha': commit_sha,
            'message': 'Initial commit',
            'tree_sha': 'tree123',
            'parent_shas': [],
            'branch': 'main'
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(Commit.objects.filter(repository=self.repo, sha=commit_sha).exists())
        self.assertEqual(response.data['commit']['sha'], commit_sha)
        self.branch.refresh_from_db()
        self.assertEqual(self.branch.commit_sha, commit_sha)

    def test_create_commit_rejects_invalid_sha(self):
        url = reverse('commit-create', kwargs={'owner_ref': self.user.id, 'repo_name': 'test-repo'})
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.token}')
        data = {
            'sha': 'not-a-valid-sha',
            'message': 'Initial commit',
            'tree_sha': 'tree123',
            'parent_shas': [],
            'branch': 'main'
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(
            response.data['error'],
            'Commit SHA must be a valid 64-character hexadecimal string.'
        )

    def test_create_commit_rejects_duplicate_sha(self):
        commit_sha = 'b' * 64
        Commit.objects.create(
            repository=self.repo,
            sha=commit_sha,
            author=self.user,
            message='Existing commit',
            tree_sha='tree123',
            author_name='Test User',
            author_email='user@example.com',
            committed_at='2024-01-01T00:00:00Z'
        )

        url = reverse('commit-create', kwargs={'owner_ref': self.user.id, 'repo_name': 'test-repo'})
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.token}')
        data = {
            'sha': commit_sha,
            'message': 'Duplicate commit',
            'tree_sha': 'tree123',
            'parent_shas': [],
            'branch': 'main'
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data['error'], 'Commit with this SHA already exists.')

    def test_list_commits(self):
        Commit.objects.create(
            repository=self.repo,
            sha='abc123',
            author=self.user,
            message='Test commit',
            tree_sha='tree123',
            author_name='Test User',
            author_email='user@example.com',
            committed_at='2024-01-01T00:00:00Z'
        )
        url = reverse('commit-list', kwargs={'owner_ref': self.user.id, 'repo_name': 'test-repo'})
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.token}')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)

    def test_list_commits_filters_to_branch_history(self):
        base = Commit.objects.create(
            repository=self.repo,
            sha='base',
            author=self.user,
            message='Base commit',
            tree_sha='tree123',
            parent_shas=[],
            author_name='Test User',
            author_email='user@example.com',
            committed_at='2024-01-01T00:00:00Z'
        )
        branch_commit = Commit.objects.create(
            repository=self.repo,
            sha='branch-head',
            author=self.user,
            message='Branch commit',
            tree_sha='tree123',
            parent_shas=[base.sha],
            author_name='Test User',
            author_email='user@example.com',
            committed_at='2024-01-02T00:00:00Z'
        )
        Commit.objects.create(
            repository=self.repo,
            sha='unreachable',
            author=self.user,
            message='Unreachable commit',
            tree_sha='tree123',
            parent_shas=[base.sha],
            author_name='Test User',
            author_email='user@example.com',
            committed_at='2024-01-03T00:00:00Z'
        )
        self.branch.commit_sha = branch_commit.sha
        self.branch.save()

        url = reverse('commit-list', kwargs={'owner_ref': self.user.id, 'repo_name': 'test-repo'})
        response = self.client.get(url, {'branch': 'main'})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            [commit['sha'] for commit in response.data],
            ['branch-head', 'base'],
        )

    def test_list_commits_rejects_unknown_branch(self):
        url = reverse('commit-list', kwargs={'owner_ref': self.user.id, 'repo_name': 'test-repo'})
        response = self.client.get(url, {'branch': 'missing'})

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_get_commit_detail(self):
        commit = Commit.objects.create(
            repository=self.repo,
            sha='abc123',
            author=self.user,
            message='Test commit',
            tree_sha='tree123',
            author_name='Test User',
            author_email='user@example.com',
            committed_at='2024-01-01T00:00:00Z'
        )
        url = reverse('commit-detail', kwargs={
            'owner_ref': self.user.id,
            'repo_name': 'test-repo',
            'sha': 'abc123'
        })
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.token}')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['sha'], 'abc123')
