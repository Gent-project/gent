from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken
from django.test import TestCase
from api.models import User, Repository, Tree, Blob


class BlobAndTreeAPITestCase(TestCase):
    """Test cases for blob and tree APIs."""

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            email='user@example.com',
            password='testpass123'
        )
        refresh = RefreshToken.for_user(self.user)
        self.token = str(refresh.access_token)
        self.repo = Repository.objects.create(owner=self.user, name='test-repo')

    def test_create_blob(self):
        url = reverse('blob-create', kwargs={'owner_id': self.user.id, 'repo_name': 'test-repo'})
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.token}')
        data = {'content': 'Hello, World!', 'encoding': 'utf-8'}
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(Blob.objects.filter(repository=self.repo).exists())

    def test_get_blob_detail(self):
        blob = Blob.objects.create(
            repository=self.repo,
            sha='blob123',
            size=13,
            content='Hello, World!'
        )
        url = reverse('blob-detail', kwargs={
            'owner_id': self.user.id,
            'repo_name': 'test-repo',
            'sha': 'blob123'
        })
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.token}')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['sha'], 'blob123')

    def test_create_tree(self):
        blob = Blob.objects.create(
            repository=self.repo,
            sha='blob123',
            size=13,
            content='Hello'
        )
        url = reverse('tree-create', kwargs={'owner_id': self.user.id, 'repo_name': 'test-repo'})
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.token}')
        data = {
            'entries': [
                {'type': 'blob', 'mode': '100644', 'name': 'README.md', 'sha': 'blob123'}
            ]
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(Tree.objects.filter(repository=self.repo).exists())

    def test_get_tree_detail(self):
        tree = Tree.objects.create(
            repository=self.repo,
            sha='tree123',
            entries=[{'type': 'blob', 'mode': '100644', 'name': 'file.txt', 'sha': 'blob123'}]
        )
        url = reverse('tree-detail', kwargs={
            'owner_id': self.user.id,
            'repo_name': 'test-repo',
            'sha': 'tree123'
        })
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.token}')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['sha'], 'tree123')
