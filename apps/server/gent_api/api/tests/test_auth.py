from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken
from django.test import TestCase, override_settings
from django.contrib.auth.tokens import PasswordResetTokenGenerator
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode
from unittest.mock import patch
from api.models import User


class AuthenticationAPITestCase(TestCase):
    """Test cases for authentication APIs."""

    def setUp(self):
        """Set up test client and test data."""
        self.client = APIClient()
        self.register_url = reverse('register')
        self.login_url = reverse('login')
        self.logout_url = reverse('logout')
        self.profile_url = reverse('profile')
        self.password_change_url = reverse('password_change')
        self.password_reset_url = reverse('password_reset')
        self.password_reset_confirm_url = reverse('password_reset_confirm')
        self.token_refresh_url = reverse('token_refresh')

        self.valid_user_data = {
            'email': 'test@example.com',
            'password': 'testpassword123',
            'password_confirm': 'testpassword123',
            'first_name': 'Test',
            'last_name': 'User'
        }

        self.login_data = {
            'email': 'test@example.com',
            'password': 'testpassword123'
        }

    def test_register_user_success(self):
        response = self.client.post(self.register_url, self.valid_user_data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn('user', response.data)
        self.assertIn('tokens', response.data)
        self.assertEqual(response.data['user']['email'], self.valid_user_data['email'])
        self.assertTrue(User.objects.filter(email=self.valid_user_data['email']).exists())

    def test_register_user_missing_fields(self):
        incomplete_data = {'email': 'test@example.com', 'password': 'testpassword123'}
        response = self.client.post(self.register_url, incomplete_data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_register_user_password_mismatch(self):
        mismatched_data = {
            'email': 'test@example.com',
            'password': 'testpassword123',
            'password_confirm': 'differentpassword123',
            'first_name': 'Test',
            'last_name': 'User'
        }
        response = self.client.post(self.register_url, mismatched_data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('password', response.data)

    def test_register_user_duplicate_email(self):
        self.client.post(self.register_url, self.valid_user_data, format='json')
        response = self.client.post(self.register_url, self.valid_user_data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('email', response.data)

    def test_register_user_invalid_email(self):
        invalid_email_data = {
            'email': 'notanemail',
            'password': 'testpassword123',
            'password_confirm': 'testpassword123',
            'first_name': 'Test',
            'last_name': 'User'
        }
        response = self.client.post(self.register_url, invalid_email_data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_register_user_weak_password(self):
        weak_password_data = {
            'email': 'test@example.com',
            'password': '123',
            'password_confirm': '123',
            'first_name': 'Test',
            'last_name': 'User'
        }
        response = self.client.post(self.register_url, weak_password_data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_login_success(self):
        self.client.post(self.register_url, self.valid_user_data, format='json')
        response = self.client.post(self.login_url, self.login_data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('tokens', response.data)
        self.assertEqual(response.data['user']['email'], self.login_data['email'])

    def test_login_invalid_credentials(self):
        invalid_data = {'email': 'test@example.com', 'password': 'wrongpassword'}
        response = self.client.post(self.login_url, invalid_data, format='json')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertIn('error', response.data)

    def test_login_missing_fields(self):
        incomplete_data = {'email': 'test@example.com'}
        response = self.client.post(self.login_url, incomplete_data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('error', response.data)

    def test_login_nonexistent_user(self):
        nonexistent_data = {'email': 'nonexistent@example.com', 'password': 'testpassword123'}
        response = self.client.post(self.login_url, nonexistent_data, format='json')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertIn('error', response.data)

    def test_login_inactive_user(self):
        user = User.objects.create_user(email='inactive@example.com', password='testpassword123')
        user.is_active = False
        user.save()
        inactive_data = {'email': 'inactive@example.com', 'password': 'testpassword123'}
        response = self.client.post(self.login_url, inactive_data, format='json')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertIn('error', response.data)

    def test_get_profile_authenticated(self):
        self.client.post(self.register_url, self.valid_user_data, format='json')
        login_response = self.client.post(self.login_url, self.login_data, format='json')
        access_token = login_response.data['tokens']['access']
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {access_token}')
        response = self.client.get(self.profile_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['email'], self.valid_user_data['email'])

    def test_get_profile_unauthenticated(self):
        response = self.client.get(self.profile_url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_update_profile_put(self):
        self.client.post(self.register_url, self.valid_user_data, format='json')
        login_response = self.client.post(self.login_url, self.login_data, format='json')
        access_token = login_response.data['tokens']['access']
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {access_token}')
        update_data = {'first_name': 'Updated', 'last_name': 'Name'}
        response = self.client.put(self.profile_url, update_data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['user']['first_name'], 'Updated')

    def test_update_profile_patch(self):
        self.client.post(self.register_url, self.valid_user_data, format='json')
        login_response = self.client.post(self.login_url, self.login_data, format='json')
        access_token = login_response.data['tokens']['access']
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {access_token}')
        update_data = {'first_name': 'PartiallyUpdated'}
        response = self.client.patch(self.profile_url, update_data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['user']['first_name'], 'PartiallyUpdated')

    def test_update_profile_unauthenticated(self):
        update_data = {'first_name': 'Updated'}
        response = self.client.put(self.profile_url, update_data, format='json')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_logout_success(self):
        self.client.post(self.register_url, self.valid_user_data, format='json')
        login_response = self.client.post(self.login_url, self.login_data, format='json')
        access_token = login_response.data['tokens']['access']
        refresh_token = login_response.data['tokens']['refresh']
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {access_token}')
        logout_data = {'refresh': refresh_token}
        response = self.client.post(self.logout_url, logout_data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('message', response.data)

    def test_logout_missing_refresh_token(self):
        self.client.post(self.register_url, self.valid_user_data, format='json')
        login_response = self.client.post(self.login_url, self.login_data, format='json')
        access_token = login_response.data['tokens']['access']
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {access_token}')
        response = self.client.post(self.logout_url, {}, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('error', response.data)

    def test_logout_unauthenticated(self):
        logout_data = {'refresh': 'sometoken'}
        response = self.client.post(self.logout_url, logout_data, format='json')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_token_refresh_success(self):
        self.client.post(self.register_url, self.valid_user_data, format='json')
        login_response = self.client.post(self.login_url, self.login_data, format='json')
        refresh_token = login_response.data['tokens']['refresh']
        refresh_data = {'refresh': refresh_token}
        response = self.client.post(self.token_refresh_url, refresh_data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access', response.data)

    def test_token_refresh_invalid_token(self):
        refresh_data = {'refresh': 'invalidtoken'}
        response = self.client.post(self.token_refresh_url, refresh_data, format='json')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_token_refresh_missing_token(self):
        response = self.client.post(self.token_refresh_url, {}, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_token_refresh_after_logout(self):
        self.client.post(self.register_url, self.valid_user_data, format='json')
        login_response = self.client.post(self.login_url, self.login_data, format='json')
        access_token = login_response.data['tokens']['access']
        refresh_token = login_response.data['tokens']['refresh']
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {access_token}')
        logout_data = {'refresh': refresh_token}
        self.client.post(self.logout_url, logout_data, format='json')
        refresh_data = {'refresh': refresh_token}
        response = self.client.post(self.token_refresh_url, refresh_data, format='json')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def _authenticate(self):
        self.client.post(self.register_url, self.valid_user_data, format='json')
        login_response = self.client.post(self.login_url, self.login_data, format='json')
        access_token = login_response.data['tokens']['access']
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {access_token}')
        return login_response

    def test_password_change_success(self):
        login_response = self._authenticate()
        refresh_token = login_response.data['tokens']['refresh']
        data = {
            'current_password': 'testpassword123',
            'new_password': 'newpassword456',
            'new_password_confirm': 'newpassword456',
        }
        response = self.client.post(self.password_change_url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['message'], 'Password changed successfully')

        refresh_data = {'refresh': refresh_token}
        response = self.client.post(self.token_refresh_url, refresh_data, format='json')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

        self.client.credentials()
        login_response = self.client.post(
            self.login_url,
            {'email': 'test@example.com', 'password': 'newpassword456'},
            format='json',
        )
        self.assertEqual(login_response.status_code, status.HTTP_200_OK)

    def test_password_change_wrong_current_password(self):
        self._authenticate()
        data = {
            'current_password': 'wrongpassword',
            'new_password': 'newpassword456',
            'new_password_confirm': 'newpassword456',
        }
        response = self.client.post(self.password_change_url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertIn('current_password', response.data)

    def test_password_change_weak_new_password(self):
        self._authenticate()
        data = {
            'current_password': 'testpassword123',
            'new_password': '123',
            'new_password_confirm': '123',
        }
        response = self.client.post(self.password_change_url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('new_password', response.data)

    def test_password_change_unauthenticated(self):
        data = {
            'current_password': 'testpassword123',
            'new_password': 'newpassword456',
            'new_password_confirm': 'newpassword456',
        }
        response = self.client.post(self.password_change_url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    @override_settings(RESEND_API_KEY='test-key', FRONTEND_URL='http://localhost:3000')
    @patch('api.services.email.resend.Emails.send')
    def test_password_reset_existing_email(self, mock_send):
        User.objects.create_user(email='reset@example.com', password='testpassword123')
        response = self.client.post(
            self.password_reset_url,
            {'email': 'reset@example.com'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        mock_send.assert_called_once()

    @override_settings(RESEND_API_KEY='test-key', FRONTEND_URL='http://localhost:3000')
    @patch('api.services.email.resend.Emails.send')
    def test_password_reset_unknown_email(self, mock_send):
        response = self.client.post(
            self.password_reset_url,
            {'email': 'unknown@example.com'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        mock_send.assert_not_called()

    @override_settings(FRONTEND_URL='http://localhost:3000')
    def test_password_reset_confirm_success(self):
        user = User.objects.create_user(email='reset@example.com', password='oldpassword123')
        token_generator = PasswordResetTokenGenerator()
        uid = urlsafe_base64_encode(force_bytes(user.pk))
        token = token_generator.make_token(user)
        response = self.client.post(
            self.password_reset_confirm_url,
            {
                'uid': uid,
                'token': token,
                'new_password': 'newpassword456',
                'new_password_confirm': 'newpassword456',
            },
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        login_response = self.client.post(
            self.login_url,
            {'email': 'reset@example.com', 'password': 'newpassword456'},
            format='json',
        )
        self.assertEqual(login_response.status_code, status.HTTP_200_OK)

    def test_password_reset_confirm_invalid_token(self):
        user = User.objects.create_user(email='reset@example.com', password='oldpassword123')
        uid = urlsafe_base64_encode(force_bytes(user.pk))
        response = self.client.post(
            self.password_reset_confirm_url,
            {
                'uid': uid,
                'token': 'invalid-token',
                'new_password': 'newpassword456',
                'new_password_confirm': 'newpassword456',
            },
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('token', response.data)

    def test_password_reset_confirm_weak_password(self):
        user = User.objects.create_user(email='reset@example.com', password='oldpassword123')
        token_generator = PasswordResetTokenGenerator()
        uid = urlsafe_base64_encode(force_bytes(user.pk))
        token = token_generator.make_token(user)
        response = self.client.post(
            self.password_reset_confirm_url,
            {
                'uid': uid,
                'token': token,
                'new_password': '123',
                'new_password_confirm': '123',
            },
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('new_password', response.data)

    def test_password_reset_confirm_token_invalid_after_password_change(self):
        user = User.objects.create_user(email='reset@example.com', password='oldpassword123')
        token_generator = PasswordResetTokenGenerator()
        uid = urlsafe_base64_encode(force_bytes(user.pk))
        token = token_generator.make_token(user)
        user.set_password('changedpassword456')
        user.save()
        response = self.client.post(
            self.password_reset_confirm_url,
            {
                'uid': uid,
                'token': token,
                'new_password': 'newpassword456',
                'new_password_confirm': 'newpassword456',
            },
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('token', response.data)

    @override_settings(FRONTEND_URL='http://localhost:3000')
    def test_password_reset_confirm_blacklists_tokens(self):
        user = User.objects.create_user(email='reset@example.com', password='oldpassword123')
        login_response = self.client.post(
            self.login_url,
            {'email': 'reset@example.com', 'password': 'oldpassword123'},
            format='json',
        )
        refresh_token = login_response.data['tokens']['refresh']
        token_generator = PasswordResetTokenGenerator()
        uid = urlsafe_base64_encode(force_bytes(user.pk))
        token = token_generator.make_token(user)
        response = self.client.post(
            self.password_reset_confirm_url,
            {
                'uid': uid,
                'token': token,
                'new_password': 'newpassword456',
                'new_password_confirm': 'newpassword456',
            },
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        refresh_data = {'refresh': refresh_token}
        response = self.client.post(self.token_refresh_url, refresh_data, format='json')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    @override_settings(RESEND_API_KEY='test-key', FRONTEND_URL='http://localhost:3000')
    @patch('api.services.email.resend.Emails.send')
    def test_password_reset_resend_failure_returns_generic_200(self, mock_send):
        mock_send.side_effect = Exception('Resend outage')
        User.objects.create_user(email='reset@example.com', password='testpassword123')
        response = self.client.post(
            self.password_reset_url,
            {'email': 'reset@example.com'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            response.data['message'],
            'If an account with that email exists, a password reset link has been sent.',
        )
