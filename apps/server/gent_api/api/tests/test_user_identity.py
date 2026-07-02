from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken
from django.test import TestCase
from api.models import User, Repository, Branch, RepositoryMember, RepositoryMemberRole


class UserIdentityTestCase(TestCase):
    """Tests for username generation, validation, and identity fields."""

    def setUp(self):
        self.client = APIClient()
        self.register_url = reverse('register')
        self.profile_url = reverse('profile')

    def _token_for(self, user):
        return str(RefreshToken.for_user(user).access_token)

    def test_create_user_without_username_auto_generates(self):
        user = User.objects.create_user(email='alice@example.com', password='pass12345')
        self.assertEqual(user.username, 'alice')

    def test_create_user_all_digit_email_gets_prefixed_username(self):
        user = User.objects.create_user(email='123@example.com', password='pass12345')
        self.assertEqual(user.username, 'user-123')

    def test_create_user_empty_sanitize_fallback(self):
        user = User.objects.create_user(email='+++@example.com', password='pass12345')
        self.assertEqual(user.username, 'user')

    def test_create_user_collision_dedupes(self):
        User.objects.create_user(email='bob@example.com', password='pass12345')
        second = User.objects.create_user(email='bob@other.com', password='pass12345')
        self.assertEqual(second.username, 'bob-2')

    def test_create_user_explicit_username_normalized(self):
        user = User.objects.create_user(
            email='case@example.com',
            password='pass12345',
            username='Saad',
        )
        self.assertEqual(user.username, 'saad')

    def test_register_without_username_returns_username(self):
        response = self.client.post(
            self.register_url,
            {
                'email': 'newuser@example.com',
                'password': 'testpassword123',
                'password_confirm': 'testpassword123',
            },
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['user']['username'], 'newuser')

    def test_register_rejects_all_digit_username(self):
        response = self.client.post(
            self.register_url,
            {
                'email': 'digits@example.com',
                'password': 'testpassword123',
                'password_confirm': 'testpassword123',
                'username': '12345',
            },
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('username', response.data)

    def test_register_with_custom_username(self):
        response = self.client.post(
            self.register_url,
            {
                'email': 'custom@example.com',
                'password': 'testpassword123',
                'password_confirm': 'testpassword123',
                'username': 'CustomUser',
            },
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['user']['username'], 'customuser')

    def test_profile_patch_username(self):
        user = User.objects.create_user(email='profile@example.com', password='pass12345')
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self._token_for(user)}')
        response = self.client.patch(
            self.profile_url,
            {'username': 'newhandle'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        user.refresh_from_db()
        self.assertEqual(user.username, 'newhandle')

    def test_profile_patch_rejects_all_digit_username(self):
        user = User.objects.create_user(email='reject@example.com', password='pass12345')
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self._token_for(user)}')
        response = self.client.patch(
            self.profile_url,
            {'username': '99999'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('username', response.data)

    def test_profile_patch_rejects_duplicate_username(self):
        User.objects.create_user(
            email='taken@example.com',
            password='pass12345',
            username='taken',
        )
        user = User.objects.create_user(email='other@example.com', password='pass12345')
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self._token_for(user)}')
        response = self.client.patch(
            self.profile_url,
            {'username': 'taken'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('username', response.data)

    def test_profile_patch_blank_username_is_noop(self):
        user = User.objects.create_user(
            email='noop@example.com',
            password='pass12345',
            username='keepme',
        )
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self._token_for(user)}')
        response = self.client.patch(
            self.profile_url,
            {'username': ''},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        user.refresh_from_db()
        self.assertEqual(user.username, 'keepme')

    def test_resolve_public_ref_by_id_and_username(self):
        user = User.objects.create_user(
            email='resolve@example.com',
            password='pass12345',
            username='resolver',
        )
        by_id = User.objects.resolve_public_ref(str(user.id))
        by_name = User.objects.resolve_public_ref('Resolver')
        self.assertEqual(by_id.pk, user.pk)
        self.assertEqual(by_name.pk, user.pk)

    def test_repository_detail_includes_owner_identity(self):
        owner = User.objects.create_user(
            email='owner@example.com',
            password='pass12345',
            first_name='Repo',
            last_name='Owner',
        )
        Repository.objects.create(owner=owner, name='identity-repo')
        url = reverse(
            'repository-detail',
            kwargs={'owner_ref': owner.id, 'repo_name': 'identity-repo'},
        )
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self._token_for(owner)}')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['owner_username'], owner.username)
        self.assertEqual(response.data['owner_name'], 'Repo Owner')

    def test_repository_detail_by_username_url(self):
        owner = User.objects.create_user(
            email='byname@example.com',
            password='pass12345',
            username='byname',
        )
        Repository.objects.create(owner=owner, name='named-repo')
        url = reverse(
            'repository-detail',
            kwargs={'owner_ref': 'byname', 'repo_name': 'named-repo'},
        )
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self._token_for(owner)}')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['name'], 'named-repo')

    def test_repository_detail_by_mixed_case_username(self):
        owner = User.objects.create_user(
            email='mixed@example.com',
            password='pass12345',
            username='mixedcase',
        )
        Repository.objects.create(owner=owner, name='mixed-repo')
        url = reverse(
            'repository-detail',
            kwargs={'owner_ref': 'MixedCase', 'repo_name': 'mixed-repo'},
        )
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self._token_for(owner)}')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_repository_detail_wrong_username_returns_404(self):
        owner = User.objects.create_user(email='missing@example.com', password='pass12345')
        Repository.objects.create(owner=owner, name='missing-repo')
        url = reverse(
            'repository-detail',
            kwargs={'owner_ref': 'nobody', 'repo_name': 'missing-repo'},
        )
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self._token_for(owner)}')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_member_list_includes_display_fields(self):
        owner = User.objects.create_user(
            email='memberowner@example.com',
            password='pass12345',
            first_name='Member',
            last_name='Owner',
        )
        member = User.objects.create_user(
            email='memberuser@example.com',
            password='pass12345',
            first_name='Team',
            last_name='Member',
        )
        repo = Repository.objects.create(owner=owner, name='member-repo', is_private=True)
        Branch.objects.create(repository=repo, name='main', commit_sha='0' * 64)
        RepositoryMember.objects.create(
            repository=repo,
            user=member,
            role=RepositoryMemberRole.READ,
            added_by=owner,
        )
        url = reverse(
            'member-list',
            kwargs={'owner_ref': owner.username, 'repo_name': 'member-repo'},
        )
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self._token_for(owner)}')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        owner_entry = response.data[0]
        member_entry = response.data[1]
        self.assertEqual(owner_entry['username'], owner.username)
        self.assertEqual(owner_entry['display_name'], 'Member Owner')
        self.assertEqual(owner_entry['first_name'], 'Member')
        self.assertEqual(member_entry['username'], member.username)
        self.assertEqual(member_entry['display_name'], 'Team Member')
        self.assertEqual(member_entry['first_name'], 'Team')
