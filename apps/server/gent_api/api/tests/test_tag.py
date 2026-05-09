from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken
from django.test import TestCase
from api.models import User, Repository, Commit, Tree, Tag


class TagAPITestCase(TestCase):
    """Test cases for tag APIs."""

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            email='user@example.com',
            password='testpass123'
        )
        refresh = RefreshToken.for_user(self.user)
        self.token = str(refresh.access_token)

        self.other_user = User.objects.create_user(
            email='other@example.com',
            password='testpass123'
        )
        refresh_other = RefreshToken.for_user(self.other_user)
        self.other_token = str(refresh_other.access_token)

        self.repo = Repository.objects.create(owner=self.user, name='test-repo')
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

    def test_list_tags(self):
        Tag.objects.create(
            repository=self.repo,
            name='v1.0',
            commit_sha=self.commit.sha,
            message='release',
            annotated=True,
            tagger_name='Test User',
            tagger_email='user@example.com'
        )
        url = reverse('tag-list', kwargs={'owner_id': self.user.id, 'repo_name': 'test-repo'})
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.token}')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['name'], 'v1.0')

    def test_create_tag_success(self):
        url = reverse('tag-create', kwargs={'owner_id': self.user.id, 'repo_name': 'test-repo'})
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.token}')
        data = {
            'name': 'v1.0',
            'commit_sha': self.commit.sha,
            'message': 'release',
            'annotated': True,
            'tagger_name': 'Test User',
            'tagger_email': 'user@example.com'
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(Tag.objects.filter(repository=self.repo, name='v1.0').exists())

    def test_create_tag_nonexistent_commit(self):
        url = reverse('tag-create', kwargs={'owner_id': self.user.id, 'repo_name': 'test-repo'})
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.token}')
        data = {
            'name': 'v1.0',
            'commit_sha': 'deadbeef00000000000000000000000000000000000000000000000000000000'
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('error', response.data)

    def test_create_tag_non_owner(self):
        url = reverse('tag-create', kwargs={'owner_id': self.user.id, 'repo_name': 'test-repo'})
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.other_token}')
        data = {
            'name': 'v1.0',
            'commit_sha': self.commit.sha
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_delete_tag_success(self):
        tag = Tag.objects.create(
            repository=self.repo,
            name='v1.0',
            commit_sha=self.commit.sha
        )
        url = reverse('tag-delete', kwargs={
            'owner_id': self.user.id,
            'repo_name': 'test-repo',
            'tag_name': 'v1.0'
        })
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.token}')
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('message', response.data)
        self.assertFalse(Tag.objects.filter(id=tag.id).exists())

    def test_delete_tag_non_owner(self):
        tag = Tag.objects.create(
            repository=self.repo,
            name='v1.0',
            commit_sha=self.commit.sha
        )
        url = reverse('tag-delete', kwargs={
            'owner_id': self.user.id,
            'repo_name': 'test-repo',
            'tag_name': 'v1.0'
        })
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.other_token}')
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertTrue(Tag.objects.filter(id=tag.id).exists())

    def test_push_with_tags(self):
        url = reverse('push', kwargs={'owner_id': self.user.id, 'repo_name': 'test-repo'})
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.token}')
        data = {
            'pack': {
                'commits': [{
                    'sha': 'commit123',
                    'message': 'Initial commit',
                    'tree_sha': 'tree123',
                    'parent_shas': [],
                    'author_name': 'Test User',
                    'author_email': 'user@example.com',
                    'committed_at': '2024-01-15T10:30:00Z'
                }],
                'trees': [{
                    'sha': 'tree123',
                    'entries': []
                }],
                'blobs': []
            },
            'branch_updates': [{'name': 'main', 'commit_sha': 'commit123'}],
            'tags': {
                'v1.0': {
                    'hash': 'commit123',
                    'message': 'release',
                    'annotated': True,
                    'tagger': {'name': 'Test User', 'email': 'user@example.com'}
                }
            }
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['tags_created'], 1)
        tag = Tag.objects.get(repository=self.repo, name='v1.0')
        self.assertEqual(tag.commit_sha, 'commit123')
        self.assertEqual(tag.message, 'release')
        self.assertTrue(tag.annotated)
        self.assertEqual(tag.tagger_name, 'Test User')
        self.assertEqual(tag.tagger_email, 'user@example.com')
