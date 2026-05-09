from django.urls import reverse
from django.shortcuts import get_object_or_404
from rest_framework.test import APIClient
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken
from django.test import TestCase
from api.models import User, Repository, Branch, Commit, Tree


class BranchAPITestCase(TestCase):
    """Test cases for branch APIs."""

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            email='user@example.com',
            password='testpass123'
        )
        refresh = RefreshToken.for_user(self.user)
        self.token = str(refresh.access_token)

        self.user2 = User.objects.create_user(
            email='user2@example.com',
            password='testpass123'
        )
        refresh2 = RefreshToken.for_user(self.user2)
        self.user2_token = str(refresh2.access_token)

        self.repo = Repository.objects.create(owner=self.user, name='test-repo')
        self.branch = Branch.objects.create(repository=self.repo, name='main', commit_sha='0' * 64)

        self.tree = Tree.objects.create(repository=self.repo, sha='tree123abc', entries=[])
        self.commit = Commit.objects.create(
            repository=self.repo,
            sha='abc123def456789012345678901234567890abcdef0123456789012345678901',
            author=self.user,
            message='Test commit',
            tree_sha='tree123abc',
            author_name='Test User',
            author_email='user@example.com',
            committed_at='2024-01-01T00:00:00Z'
        )

    def test_list_branches(self):
        url = reverse('branch-list', kwargs={'owner_id': self.user.id, 'repo_name': 'test-repo'})
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.token}')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['name'], 'main')

    def test_create_branch(self):
        url = reverse('branch-create', kwargs={'owner_id': self.user.id, 'repo_name': 'test-repo'})
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.token}')
        data = {'name': 'develop', 'commit_sha': 'a' * 64}
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(Branch.objects.filter(repository=self.repo, name='develop').exists())

    def test_get_branch_detail(self):
        url = reverse('branch-detail', kwargs={
            'owner_id': self.user.id,
            'repo_name': 'test-repo',
            'branch_name': 'main'
        })
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.token}')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['name'], 'main')

    def test_update_branch_success(self):
        url = reverse('branch-detail', kwargs={
            'owner_id': self.user.id,
            'repo_name': 'test-repo',
            'branch_name': 'main'
        })
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.token}')
        data = {'commit_sha': self.commit.sha}
        response = self.client.patch(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['commit_sha'], self.commit.sha)
        self.branch.refresh_from_db()
        self.assertEqual(self.branch.commit_sha, self.commit.sha)

    def test_update_branch_nonexistent_commit(self):
        url = reverse('branch-detail', kwargs={
            'owner_id': self.user.id,
            'repo_name': 'test-repo',
            'branch_name': 'main'
        })
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.token}')
        data = {'commit_sha': 'deadbeef00000000000000000000000000000000000000000000000000000000'}
        response = self.client.patch(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('error', response.data)

    def test_update_default_branch(self):
        url = reverse('branch-detail', kwargs={
            'owner_id': self.user.id,
            'repo_name': 'test-repo',
            'branch_name': 'main'
        })
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.token}')
        data = {'commit_sha': self.commit.sha}
        response = self.client.patch(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_update_branch_non_owner(self):
        url = reverse('branch-detail', kwargs={
            'owner_id': self.user.id,
            'repo_name': 'test-repo',
            'branch_name': 'main'
        })
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.user2_token}')
        data = {'commit_sha': self.commit.sha}
        response = self.client.patch(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_delete_branch_success(self):
        branch = Branch.objects.create(repository=self.repo, name='feature', commit_sha='0' * 64)
        url = reverse('branch-detail', kwargs={
            'owner_id': self.user.id,
            'repo_name': 'test-repo',
            'branch_name': 'feature'
        })
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.token}')
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('message', response.data)
        self.assertFalse(Branch.objects.filter(id=branch.id).exists())

    def test_delete_default_branch(self):
        url = reverse('branch-detail', kwargs={
            'owner_id': self.user.id,
            'repo_name': 'test-repo',
            'branch_name': 'main'
        })
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.token}')
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('error', response.data)

    def test_delete_branch_non_owner(self):
        branch = Branch.objects.create(repository=self.repo, name='feature', commit_sha='0' * 64)
        url = reverse('branch-detail', kwargs={
            'owner_id': self.user.id,
            'repo_name': 'test-repo',
            'branch_name': 'feature'
        })
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.user2_token}')
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertTrue(Branch.objects.filter(id=branch.id).exists())


