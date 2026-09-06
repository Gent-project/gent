import hashlib

from django.test import TestCase
from rest_framework.test import APIClient

from api.models import PersonalAccessToken, Repository, User


class GitTokenAPITests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(email='owner@example.com', username='owner')
        self.other = User.objects.create_user(email='other@example.com', username='other')
        self.repository = Repository.objects.create(owner=self.user, name='canonical', object_format='sha256')
        self.client = APIClient()
        self.client.force_authenticate(self.user)

    def test_create_lists_without_secret_and_revokes_token(self):
        response = self.client.post('/api/auth/git-tokens/', {
            'name': 'Git Graph', 'repository_id': self.repository.pk,
            'can_write': True, 'expires_days': 30,
        }, format='json')
        self.assertEqual(response.status_code, 201)
        secret = response.data['token']
        token = PersonalAccessToken.objects.get(pk=response.data['id'])
        self.assertEqual(token.digest, hashlib.sha256(secret.encode()).hexdigest())
        self.assertNotEqual(token.digest, secret)

        listing = self.client.get('/api/auth/git-tokens/')
        self.assertEqual(listing.status_code, 200)
        self.assertNotIn('token', listing.data[0])
        self.assertEqual(listing.data[0]['repository_id'], self.repository.pk)

        deleted = self.client.delete(f'/api/auth/git-tokens/{token.pk}/')
        self.assertEqual(deleted.status_code, 204)
        self.assertFalse(PersonalAccessToken.objects.exists())

    def test_cannot_issue_repository_token_without_access(self):
        foreign = Repository.objects.create(owner=self.other, name='private', is_private=True, object_format='sha256')
        response = self.client.post('/api/auth/git-tokens/', {
            'name': 'invalid', 'repository_id': foreign.pk, 'can_write': True,
        }, format='json')
        self.assertEqual(response.status_code, 403)
        self.assertFalse(PersonalAccessToken.objects.exists())

    def test_repository_api_defaults_to_canonical_format(self):
        response = self.client.post('/api/repos/create/', {'name': 'new-project'}, format='json')
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['repository']['object_format'], 'sha256')
        self.assertEqual(Repository.objects.get(name='new-project').object_format, 'sha256')
