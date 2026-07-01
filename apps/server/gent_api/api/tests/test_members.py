from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken
from django.test import TestCase
from api.models import User, Repository, Branch, RepositoryMember, RepositoryMemberRole


class MemberAPITestCase(TestCase):
    """Test cases for repository member APIs."""

    def setUp(self):
        self.client = APIClient()
        self.owner = User.objects.create_user(
            email='owner@example.com',
            password='testpass123',
        )
        self.write_member = User.objects.create_user(
            email='writer@example.com',
            password='testpass123',
        )
        self.read_member = User.objects.create_user(
            email='reader@example.com',
            password='testpass123',
        )
        self.outsider = User.objects.create_user(
            email='outsider@example.com',
            password='testpass123',
        )
        self.new_user = User.objects.create_user(
            email='newuser@example.com',
            password='testpass123',
        )

        self.repo = Repository.objects.create(
            owner=self.owner,
            name='team-repo',
            is_private=True,
        )
        Branch.objects.create(repository=self.repo, name='main', commit_sha='0' * 64)
        RepositoryMember.objects.create(
            repository=self.repo,
            user=self.write_member,
            role=RepositoryMemberRole.WRITE,
            added_by=self.owner,
        )
        RepositoryMember.objects.create(
            repository=self.repo,
            user=self.read_member,
            role=RepositoryMemberRole.READ,
            added_by=self.owner,
        )

        self.members_url = reverse(
            'member-list',
            kwargs={'owner_id': self.owner.id, 'repo_name': 'team-repo'},
        )

    def _token_for(self, user):
        return str(RefreshToken.for_user(user).access_token)

    def test_list_members_owner(self):
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self._token_for(self.owner)}')
        response = self.client.get(self.members_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 3)
        roles = {entry['email']: entry['role'] for entry in response.data}
        self.assertEqual(roles['owner@example.com'], 'owner')
        self.assertEqual(roles['writer@example.com'], RepositoryMemberRole.WRITE)
        self.assertEqual(roles['reader@example.com'], RepositoryMemberRole.READ)

    def test_list_members_read_access(self):
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self._token_for(self.read_member)}')
        response = self.client.get(self.members_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_list_members_outsider_denied(self):
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self._token_for(self.outsider)}')
        response = self.client.get(self.members_url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_add_member_owner_success(self):
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self._token_for(self.owner)}')
        response = self.client.post(
            self.members_url,
            {'email': 'newuser@example.com', 'role': RepositoryMemberRole.READ},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(
            RepositoryMember.objects.filter(
                repository=self.repo,
                user=self.new_user,
            ).exists()
        )

    def test_add_member_write_member_denied(self):
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self._token_for(self.write_member)}')
        response = self.client.post(
            self.members_url,
            {'email': 'newuser@example.com', 'role': RepositoryMemberRole.READ},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_add_member_unknown_email(self):
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self._token_for(self.owner)}')
        response = self.client.post(
            self.members_url,
            {'email': 'missing@example.com', 'role': RepositoryMemberRole.READ},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('email', response.data)

    def test_add_member_duplicate(self):
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self._token_for(self.owner)}')
        response = self.client.post(
            self.members_url,
            {'email': 'writer@example.com', 'role': RepositoryMemberRole.READ},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_add_member_owner_email(self):
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self._token_for(self.owner)}')
        response = self.client.post(
            self.members_url,
            {'email': 'owner@example.com', 'role': RepositoryMemberRole.READ},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_remove_member_owner_success(self):
        remove_url = reverse(
            'member-remove',
            kwargs={
                'owner_id': self.owner.id,
                'repo_name': 'team-repo',
                'user_id': self.read_member.id,
            },
        )
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self._token_for(self.owner)}')
        response = self.client.delete(remove_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(
            RepositoryMember.objects.filter(
                repository=self.repo,
                user=self.read_member,
            ).exists()
        )

    def test_remove_member_write_member_denied(self):
        remove_url = reverse(
            'member-remove',
            kwargs={
                'owner_id': self.owner.id,
                'repo_name': 'team-repo',
                'user_id': self.read_member.id,
            },
        )
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self._token_for(self.write_member)}')
        response = self.client.delete(remove_url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_remove_owner_denied(self):
        remove_url = reverse(
            'member-remove',
            kwargs={
                'owner_id': self.owner.id,
                'repo_name': 'team-repo',
                'user_id': self.owner.id,
            },
        )
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self._token_for(self.owner)}')
        response = self.client.delete(remove_url)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
