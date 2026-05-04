from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken
from django.test import TestCase
from api.models import User, Repository, Branch


class RepositoryAPITestCase(TestCase):
    """Test cases for repository APIs."""

    def setUp(self):
        self.client = APIClient()
        self.user1 = User.objects.create_user(
            email='user1@example.com',
            password='testpass123',
            first_name='User',
            last_name='One'
        )
        self.user2 = User.objects.create_user(
            email='user2@example.com',
            password='testpass123'
        )
        refresh = RefreshToken.for_user(self.user1)
        self.user1_token = str(refresh.access_token)
        refresh2 = RefreshToken.for_user(self.user2)
        self.user2_token = str(refresh2.access_token)
        self.repo_list_url = reverse('repository-list')
        self.repo_create_url = reverse('repository-create')

    def test_create_repository_success(self):
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.user1_token}')
        data = {'name': 'test-repo', 'description': 'Test repository', 'is_private': False}
        response = self.client.post(self.repo_create_url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn('repository', response.data)
        self.assertEqual(response.data['repository']['name'], 'test-repo')
        self.assertTrue(Repository.objects.filter(owner=self.user1, name='test-repo').exists())
        repo = Repository.objects.get(owner=self.user1, name='test-repo')
        self.assertTrue(Branch.objects.filter(repository=repo, name='main').exists())

    def test_create_repository_duplicate_name(self):
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.user1_token}')
        data = {'name': 'test-repo', 'description': 'Test'}
        self.client.post(self.repo_create_url, data, format='json')
        response = self.client.post(self.repo_create_url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('error', response.data)

    def test_create_repository_invalid_name(self):
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.user1_token}')
        data = {'name': 'test repo!@#', 'description': 'Test'}
        response = self.client.post(self.repo_create_url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_repository_unauthenticated(self):
        data = {'name': 'test-repo'}
        response = self.client.post(self.repo_create_url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_list_repositories(self):
        Repository.objects.create(owner=self.user1, name='repo1')
        Repository.objects.create(owner=self.user1, name='repo2')
        Repository.objects.create(owner=self.user2, name='repo3')
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.user1_token}')
        response = self.client.get(self.repo_list_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 2)

    def test_get_repository_detail(self):
        repo = Repository.objects.create(owner=self.user1, name='test-repo')
        url = reverse('repository-detail', kwargs={'owner_id': self.user1.id, 'repo_name': 'test-repo'})
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.user1_token}')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['name'], 'test-repo')

    def test_update_repository(self):
        repo = Repository.objects.create(owner=self.user1, name='test-repo')
        url = reverse('repository-detail', kwargs={'owner_id': self.user1.id, 'repo_name': 'test-repo'})
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.user1_token}')
        data = {'description': 'Updated description'}
        response = self.client.patch(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        repo.refresh_from_db()
        self.assertEqual(repo.description, 'Updated description')

    def test_delete_repository(self):
        repo = Repository.objects.create(owner=self.user1, name='test-repo')
        url = reverse('repository-delete', kwargs={'owner_id': self.user1.id, 'repo_name': 'test-repo'})
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.user1_token}')
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(Repository.objects.filter(id=repo.id).exists())
