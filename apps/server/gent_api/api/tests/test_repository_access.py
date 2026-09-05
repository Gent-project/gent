from django.contrib.auth.models import AnonymousUser
from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken
from api.models import User, Repository, Branch, RepositoryMember, RepositoryMemberRole
from api.services.repository_access import (
    get_user_repo_role,
    user_can_read_repo,
    user_can_write_repo,
    user_can_manage_repo,
)


class RepositoryAccessServiceTestCase(TestCase):
    """Unit tests for repository access helpers."""

    def setUp(self):
        self.owner = User.objects.create_user(
            email='owner@example.com',
            password='testpass123',
        )
        self.member = User.objects.create_user(
            email='member@example.com',
            password='testpass123',
        )
        self.outsider = User.objects.create_user(
            email='outsider@example.com',
            password='testpass123',
        )
        self.anonymous = AnonymousUser()
        self.private_repo = Repository.objects.create(
            owner=self.owner,
            name='private-repo',
            is_private=True,
        )
        self.public_repo = Repository.objects.create(
            owner=self.owner,
            name='public-repo',
            is_private=False,
        )
        RepositoryMember.objects.create(
            repository=self.private_repo,
            user=self.member,
            role=RepositoryMemberRole.READ,
            added_by=self.owner,
        )

    def test_get_user_repo_role_owner(self):
        self.assertEqual(get_user_repo_role(self.owner, self.private_repo), 'owner')

    def test_get_user_repo_role_member(self):
        self.assertEqual(
            get_user_repo_role(self.member, self.private_repo),
            RepositoryMemberRole.READ,
        )

    def test_get_user_repo_role_outsider(self):
        self.assertIsNone(get_user_repo_role(self.outsider, self.private_repo))

    def test_get_user_repo_role_unauthenticated(self):
        self.assertIsNone(get_user_repo_role(self.anonymous, self.public_repo))

    def test_user_can_read_private_repo_member(self):
        self.assertTrue(user_can_read_repo(self.member, self.private_repo))

    def test_user_can_read_private_repo_outsider_denied(self):
        self.assertFalse(user_can_read_repo(self.outsider, self.private_repo))

    def test_user_can_read_public_repo_authenticated(self):
        self.assertTrue(user_can_read_repo(self.outsider, self.public_repo))

    def test_user_can_read_public_repo_unauthenticated(self):
        self.assertTrue(user_can_read_repo(self.anonymous, self.public_repo))

    def test_user_can_read_private_repo_unauthenticated_denied(self):
        self.assertFalse(user_can_read_repo(self.anonymous, self.private_repo))

    def test_user_can_write_owner(self):
        self.assertTrue(user_can_write_repo(self.owner, self.private_repo))

    def test_user_can_write_read_member_denied(self):
        self.assertFalse(user_can_write_repo(self.member, self.private_repo))

    def test_user_can_manage_owner_only(self):
        self.assertTrue(user_can_manage_repo(self.owner, self.private_repo))
        self.assertFalse(user_can_manage_repo(self.member, self.private_repo))


class AnonymousPublicRepositoryAccessTestCase(TestCase):
    """View-level tests for anonymous read access to public repositories."""

    def setUp(self):
        self.client = APIClient()
        self.owner = User.objects.create_user(
            email='public-owner@example.com',
            password='testpass123',
        )
        self.outsider = User.objects.create_user(
            email='public-outsider@example.com',
            password='testpass123',
        )
        self.outsider_token = str(RefreshToken.for_user(self.outsider).access_token)

        self.public_repo = Repository.objects.create(
            owner=self.owner,
            name='open-repo',
            is_private=False,
        )
        self.private_repo = Repository.objects.create(
            owner=self.owner,
            name='closed-repo',
            is_private=True,
        )
        for repo in (self.public_repo, self.private_repo):
            Branch.objects.create(
                repository=repo,
                name='main',
                commit_sha='0' * 64,
            )

    def _url(self, name, repo, **kwargs):
        return reverse(
            name,
            kwargs={
                'owner_ref': self.owner.id,
                'repo_name': repo.name,
                **kwargs,
            },
        )

    def _read_urls(self, repo):
        return [
            self._url('repository-detail', repo),
            self._url('branch-list', repo),
            self._url('branch-detail', repo, branch_name='main'),
            self._url('commit-list', repo),
            self._url('tag-list', repo),
            self._url('clone', repo),
        ]

    def test_anonymous_can_read_public_repository(self):
        for url in self._read_urls(self.public_repo):
            with self.subTest(url=url):
                response = self.client.get(url)
                self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_anonymous_pull_public_repository(self):
        response = self.client.get(
            self._url('pull', self.public_repo),
            {'branch': 'main'},
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_anonymous_public_repository_role_is_null(self):
        response = self.client.get(self._url('repository-detail', self.public_repo))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIsNone(response.data['role'])

    def test_anonymous_cannot_read_private_repository(self):
        for url in self._read_urls(self.private_repo):
            with self.subTest(url=url):
                response = self.client.get(url)
                self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_anonymous_cannot_write_public_repository(self):
        cases = [
            ('patch', self._url('repository-detail', self.public_repo), {'description': 'x'}),
            ('patch', self._url('branch-detail', self.public_repo, branch_name='main'),
             {'commit_sha': '1' * 64}),
            ('delete', self._url('branch-detail', self.public_repo, branch_name='dev'), None),
            ('post', self._url('branch-create', self.public_repo), {'name': 'dev'}),
            ('post', self._url('commit-create', self.public_repo), {}),
            ('post', self._url('tag-create', self.public_repo), {}),
            ('post', self._url('push', self.public_repo), {}),
        ]
        for method, url, payload in cases:
            with self.subTest(method=method, url=url):
                request = getattr(self.client, method)
                response = request(url, payload, format='json') if payload is not None \
                    else request(url)
                self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_anonymous_cannot_list_public_repository_members(self):
        response = self.client.get(self._url('member-list', self.public_repo))
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_anonymous_cannot_list_repositories(self):
        response = self.client.get(reverse('repository-list'))
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_authenticated_non_member_can_read_public_repository(self):
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.outsider_token}')
        for url in self._read_urls(self.public_repo):
            with self.subTest(url=url):
                response = self.client.get(url)
                self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_authenticated_non_member_private_repository_still_403(self):
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.outsider_token}')
        response = self.client.get(self._url('repository-detail', self.private_repo))
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
