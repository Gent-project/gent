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
        self.branch = Branch.objects.create(repository=self.repo, name='main', commit_sha='0' * 40)
        self.tree = Tree.objects.create(repository=self.repo, sha='tree123', entries=[])

    def test_create_commit(self):
        url = reverse('commit-create', kwargs={'owner_id': self.user.id, 'repo_name': 'test-repo'})
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.token}')
        data = {
            'message': 'Initial commit',
            'tree_sha': 'tree123',
            'parent_shas': [],
            'branch': 'main'
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(Commit.objects.filter(repository=self.repo).exists())

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
        url = reverse('commit-list', kwargs={'owner_id': self.user.id, 'repo_name': 'test-repo'})
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.token}')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)

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
            'owner_id': self.user.id,
            'repo_name': 'test-repo',
            'sha': 'abc123'
        })
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.token}')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['sha'], 'abc123')
