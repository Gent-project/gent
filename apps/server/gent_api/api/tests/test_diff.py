from django.urls import reverse
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from api.models import User, Repository, Branch, Commit, Tree, Blob


class CommitDiffAPITestCase(TestCase):
    """Tests for the server-side commit diff endpoint."""

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            email='diff@example.com', password='testpass123',
            first_name='Diff', last_name='User',
        )
        self.token = str(RefreshToken.for_user(self.user).access_token)
        self.repo = Repository.objects.create(owner=self.user, name='diff-repo')
        Branch.objects.create(repository=self.repo, name='main', commit_sha='0' * 64)

        # Blobs
        Blob.objects.create(repository=self.repo, sha='blob_hello',
                            content='hello\nworld\n', size=12)
        Blob.objects.create(repository=self.repo, sha='blob_hi',
                            content='hello\nthere\n', size=12)
        Blob.objects.create(repository=self.repo, sha='blob_new',
                            content='brand new file\n', size=15)

        # Trees: t0 has app.js(hello/world); t1 changes app.js + adds new.txt
        Tree.objects.create(repository=self.repo, sha='t0', entries=[
            {'mode': '100644', 'type': 'blob', 'name': 'app.js', 'sha': 'blob_hello'},
        ])
        Tree.objects.create(repository=self.repo, sha='t1', entries=[
            {'mode': '100644', 'type': 'blob', 'name': 'app.js', 'sha': 'blob_hi'},
            {'mode': '100644', 'type': 'blob', 'name': 'new.txt', 'sha': 'blob_new'},
        ])

        self.parent_sha = '1' * 64
        self.child_sha = '2' * 64
        Commit.objects.create(
            repository=self.repo, sha=self.parent_sha, author=self.user,
            message='initial', tree_sha='t0', parent_shas=[],
            author_name='Diff User', author_email='diff@example.com',
            committed_at='2024-01-01T00:00:00Z',
        )
        Commit.objects.create(
            repository=self.repo, sha=self.child_sha, author=self.user,
            message='change app.js + add new.txt', tree_sha='t1',
            parent_shas=[self.parent_sha],
            author_name='Diff User', author_email='diff@example.com',
            committed_at='2024-01-02T00:00:00Z',
        )

    def _auth(self):
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.token}')

    def _url(self, sha):
        return reverse('commit-diff', kwargs={
            'owner_id': self.user.id, 'repo_name': 'diff-repo', 'sha': sha,
        })

    def test_diff_against_parent(self):
        self._auth()
        response = self.client.get(self._url(self.child_sha))
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        data = response.data
        self.assertEqual(data['parent_sha'], self.parent_sha)
        # Files are sorted by path: app.js (modified) then new.txt (added)
        files = {f['path']: f for f in data['files']}
        self.assertEqual(set(files), {'app.js', 'new.txt'})

        app = files['app.js']
        self.assertEqual(app['status'], 'modified')
        self.assertEqual(app['additions'], 1)   # +there
        self.assertEqual(app['deletions'], 1)   # -world
        self.assertFalse(app['binary'])
        kinds = [ln['kind'] for ln in app['lines']]
        self.assertIn('hunk', kinds)
        self.assertIn('add', kinds)
        self.assertIn('del', kinds)
        added_text = [ln['text'] for ln in app['lines'] if ln['kind'] == 'add']
        deleted_text = [ln['text'] for ln in app['lines'] if ln['kind'] == 'del']
        self.assertIn('there', added_text)
        self.assertIn('world', deleted_text)

        new = files['new.txt']
        self.assertEqual(new['status'], 'added')
        self.assertEqual(new['additions'], 1)
        self.assertEqual(new['deletions'], 0)

        # Totals
        self.assertEqual(data['additions'], 2)
        self.assertEqual(data['deletions'], 1)

    def test_first_commit_is_all_added(self):
        self._auth()
        response = self.client.get(self._url(self.parent_sha))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.data
        self.assertIsNone(data['parent_sha'])
        self.assertEqual(len(data['files']), 1)
        app = data['files'][0]
        self.assertEqual(app['path'], 'app.js')
        self.assertEqual(app['status'], 'added')
        self.assertEqual(app['additions'], 2)   # hello + world
        self.assertEqual(app['deletions'], 0)

    def test_requires_authentication(self):
        response = self.client.get(self._url(self.child_sha))
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_unknown_commit_returns_404(self):
        self._auth()
        response = self.client.get(self._url('9' * 64))
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
