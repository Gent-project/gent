from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken
from .models import User


class AuthenticationAPITestCase(TestCase):
    """Test cases for authentication APIs."""
    
    def setUp(self):
        """Set up test client and test data."""
        self.client = APIClient()
        self.register_url = reverse('register')
        self.login_url = reverse('login')
        self.logout_url = reverse('logout')
        self.profile_url = reverse('profile')
        self.token_refresh_url = reverse('token_refresh')
        
        # Test user data
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
        """Test successful user registration."""
        response = self.client.post(self.register_url, self.valid_user_data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn('user', response.data)
        self.assertIn('tokens', response.data)
        self.assertIn('access', response.data['tokens'])
        self.assertIn('refresh', response.data['tokens'])
        self.assertEqual(response.data['user']['email'], self.valid_user_data['email'])
        self.assertEqual(response.data['user']['first_name'], self.valid_user_data['first_name'])
        self.assertEqual(response.data['user']['last_name'], self.valid_user_data['last_name'])
        
        # Verify user was created in database
        self.assertTrue(User.objects.filter(email=self.valid_user_data['email']).exists())
    
    def test_register_user_missing_fields(self):
        """Test registration with missing required fields."""
        incomplete_data = {
            'email': 'test@example.com',
            'password': 'testpassword123'
        }
        response = self.client.post(self.register_url, incomplete_data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
    
    def test_register_user_password_mismatch(self):
        """Test registration with mismatched passwords."""
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
        """Test registration with duplicate email."""
        # Create first user
        self.client.post(self.register_url, self.valid_user_data, format='json')
        
        # Try to create another user with same email
        response = self.client.post(self.register_url, self.valid_user_data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('email', response.data)
    
    def test_register_user_invalid_email(self):
        """Test registration with invalid email format."""
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
        """Test registration with weak password."""
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
        """Test successful user login."""
        # Create user first
        self.client.post(self.register_url, self.valid_user_data, format='json')
        
        # Login
        response = self.client.post(self.login_url, self.login_data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('user', response.data)
        self.assertIn('tokens', response.data)
        self.assertIn('access', response.data['tokens'])
        self.assertIn('refresh', response.data['tokens'])
        self.assertEqual(response.data['user']['email'], self.login_data['email'])
    
    def test_login_invalid_credentials(self):
        """Test login with invalid credentials."""
        invalid_data = {
            'email': 'test@example.com',
            'password': 'wrongpassword'
        }
        response = self.client.post(self.login_url, invalid_data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertIn('error', response.data)
    
    def test_login_missing_fields(self):
        """Test login with missing fields."""
        incomplete_data = {
            'email': 'test@example.com'
        }
        response = self.client.post(self.login_url, incomplete_data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('error', response.data)
    
    def test_login_nonexistent_user(self):
        """Test login with non-existent user."""
        nonexistent_data = {
            'email': 'nonexistent@example.com',
            'password': 'testpassword123'
        }
        response = self.client.post(self.login_url, nonexistent_data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertIn('error', response.data)
    
    def test_login_inactive_user(self):
        """Test login with inactive user account."""
        # Create user
        user = User.objects.create_user(
            email='inactive@example.com',
            password='testpassword123'
        )
        user.is_active = False
        user.save()
        
        inactive_data = {
            'email': 'inactive@example.com',
            'password': 'testpassword123'
        }
        response = self.client.post(self.login_url, inactive_data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertIn('error', response.data)
    
    def test_get_profile_authenticated(self):
        """Test getting user profile when authenticated."""
        # Create and login user
        self.client.post(self.register_url, self.valid_user_data, format='json')
        login_response = self.client.post(self.login_url, self.login_data, format='json')
        access_token = login_response.data['tokens']['access']
        
        # Get profile
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {access_token}')
        response = self.client.get(self.profile_url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['email'], self.valid_user_data['email'])
        self.assertEqual(response.data['first_name'], self.valid_user_data['first_name'])
        self.assertEqual(response.data['last_name'], self.valid_user_data['last_name'])
        self.assertIn('id', response.data)
        self.assertIn('date_joined', response.data)
    
    def test_get_profile_unauthenticated(self):
        """Test getting user profile when not authenticated."""
        response = self.client.get(self.profile_url)
        
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
    
    def test_update_profile_put(self):
        """Test updating user profile with PUT (full update)."""
        # Create and login user
        self.client.post(self.register_url, self.valid_user_data, format='json')
        login_response = self.client.post(self.login_url, self.login_data, format='json')
        access_token = login_response.data['tokens']['access']
        
        # Update profile
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {access_token}')
        update_data = {
            'first_name': 'Updated',
            'last_name': 'Name'
        }
        response = self.client.put(self.profile_url, update_data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('user', response.data)
        self.assertEqual(response.data['user']['first_name'], 'Updated')
        self.assertEqual(response.data['user']['last_name'], 'Name')
        self.assertEqual(response.data['user']['email'], self.valid_user_data['email'])
    
    def test_update_profile_patch(self):
        """Test updating user profile with PATCH (partial update)."""
        # Create and login user
        self.client.post(self.register_url, self.valid_user_data, format='json')
        login_response = self.client.post(self.login_url, self.login_data, format='json')
        access_token = login_response.data['tokens']['access']
        
        # Update profile partially
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {access_token}')
        update_data = {
            'first_name': 'PartiallyUpdated'
        }
        response = self.client.patch(self.profile_url, update_data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('user', response.data)
        self.assertEqual(response.data['user']['first_name'], 'PartiallyUpdated')
        self.assertEqual(response.data['user']['last_name'], self.valid_user_data['last_name'])
    
    def test_update_profile_unauthenticated(self):
        """Test updating profile when not authenticated."""
        update_data = {
            'first_name': 'Updated'
        }
        response = self.client.put(self.profile_url, update_data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
    
    def test_logout_success(self):
        """Test successful logout."""
        # Create and login user
        self.client.post(self.register_url, self.valid_user_data, format='json')
        login_response = self.client.post(self.login_url, self.login_data, format='json')
        access_token = login_response.data['tokens']['access']
        refresh_token = login_response.data['tokens']['refresh']
        
        # Logout
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {access_token}')
        logout_data = {'refresh': refresh_token}
        response = self.client.post(self.logout_url, logout_data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('message', response.data)
    
    def test_logout_missing_refresh_token(self):
        """Test logout without refresh token."""
        # Create and login user
        self.client.post(self.register_url, self.valid_user_data, format='json')
        login_response = self.client.post(self.login_url, self.login_data, format='json')
        access_token = login_response.data['tokens']['access']
        
        # Logout without refresh token
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {access_token}')
        response = self.client.post(self.logout_url, {}, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('error', response.data)
    
    def test_logout_unauthenticated(self):
        """Test logout when not authenticated."""
        logout_data = {'refresh': 'sometoken'}
        response = self.client.post(self.logout_url, logout_data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
    
    def test_token_refresh_success(self):
        """Test successful token refresh."""
        # Create and login user
        self.client.post(self.register_url, self.valid_user_data, format='json')
        login_response = self.client.post(self.login_url, self.login_data, format='json')
        refresh_token = login_response.data['tokens']['refresh']
        
        # Refresh token
        refresh_data = {'refresh': refresh_token}
        response = self.client.post(self.token_refresh_url, refresh_data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access', response.data)
    
    def test_token_refresh_invalid_token(self):
        """Test token refresh with invalid token."""
        refresh_data = {'refresh': 'invalidtoken'}
        response = self.client.post(self.token_refresh_url, refresh_data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
    
    def test_token_refresh_missing_token(self):
        """Test token refresh without token."""
        response = self.client.post(self.token_refresh_url, {}, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
    
    def test_token_refresh_after_logout(self):
        """Test that refresh token cannot be used after logout."""
        # Create and login user
        self.client.post(self.register_url, self.valid_user_data, format='json')
        login_response = self.client.post(self.login_url, self.login_data, format='json')
        access_token = login_response.data['tokens']['access']
        refresh_token = login_response.data['tokens']['refresh']
        
        # Logout
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {access_token}')
        logout_data = {'refresh': refresh_token}
        self.client.post(self.logout_url, logout_data, format='json')
        
        # Try to refresh with blacklisted token
        refresh_data = {'refresh': refresh_token}
        response = self.client.post(self.token_refresh_url, refresh_data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
