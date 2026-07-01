from django.contrib.auth.models import AnonymousUser
from django.test import TestCase
from api.models import User, Repository, RepositoryMember, RepositoryMemberRole
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

    def test_user_can_read_public_repo_unauthenticated_denied(self):
        self.assertFalse(user_can_read_repo(self.anonymous, self.public_repo))

    def test_user_can_write_owner(self):
        self.assertTrue(user_can_write_repo(self.owner, self.private_repo))

    def test_user_can_write_read_member_denied(self):
        self.assertFalse(user_can_write_repo(self.member, self.private_repo))

    def test_user_can_manage_owner_only(self):
        self.assertTrue(user_can_manage_repo(self.owner, self.private_repo))
        self.assertFalse(user_can_manage_repo(self.member, self.private_repo))
