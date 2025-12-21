from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken
from .models import User, Repository, Branch, Commit, Tree, Blob


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


class RepositoryAPITestCase(TestCase):
    """Test cases for repository APIs."""

    def setUp(self):
        """Set up test data."""
        self.client = APIClient()
        self.user1 = User.objects.create_user(
            email='user1@example.com',
            password='testpass123',
            first_name='User',
            last_name='One'
        )
        self.user2 = User.objects.create_user(
            email='user2@example.com',
            password='testpass123'
        )

        refresh = RefreshToken.for_user(self.user1)
        self.user1_token = str(refresh.access_token)

        refresh2 = RefreshToken.for_user(self.user2)
        self.user2_token = str(refresh2.access_token)

        self.repo_list_url = reverse('repository-list')
        self.repo_create_url = reverse('repository-create')

    def test_create_repository_success(self):
        """Test successful repository creation."""
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.user1_token}')
        data = {
            'name': 'test-repo',
            'description': 'Test repository',
            'is_private': False
        }
        response = self.client.post(self.repo_create_url, data, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn('repository', response.data)
        self.assertEqual(response.data['repository']['name'], 'test-repo')
        self.assertTrue(Repository.objects.filter(owner=self.user1, name='test-repo').exists())

        repo = Repository.objects.get(owner=self.user1, name='test-repo')
        self.assertTrue(Branch.objects.filter(repository=repo, name='main').exists())

    def test_create_repository_duplicate_name(self):
        """Test creating repository with duplicate name."""
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.user1_token}')
        data = {'name': 'test-repo', 'description': 'Test'}

        self.client.post(self.repo_create_url, data, format='json')
        response = self.client.post(self.repo_create_url, data, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('error', response.data)

    def test_create_repository_invalid_name(self):
        """Test creating repository with invalid name."""
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.user1_token}')
        data = {'name': 'test repo!@#', 'description': 'Test'}
        response = self.client.post(self.repo_create_url, data, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_repository_unauthenticated(self):
        """Test creating repository without authentication."""
        data = {'name': 'test-repo'}
        response = self.client.post(self.repo_create_url, data, format='json')

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_list_repositories(self):
        """Test listing user's repositories."""
        Repository.objects.create(owner=self.user1, name='repo1')
        Repository.objects.create(owner=self.user1, name='repo2')
        Repository.objects.create(owner=self.user2, name='repo3')

        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.user1_token}')
        response = self.client.get(self.repo_list_url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 2)

    def test_get_repository_detail(self):
        """Test getting repository details."""
        repo = Repository.objects.create(owner=self.user1, name='test-repo')
        url = reverse('repository-detail', kwargs={'owner_id': self.user1.id, 'repo_name': 'test-repo'})

        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.user1_token}')
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['name'], 'test-repo')

    def test_update_repository(self):
        """Test updating repository."""
        repo = Repository.objects.create(owner=self.user1, name='test-repo')
        url = reverse('repository-detail', kwargs={'owner_id': self.user1.id, 'repo_name': 'test-repo'})

        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.user1_token}')
        data = {'description': 'Updated description'}
        response = self.client.patch(url, data, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        repo.refresh_from_db()
        self.assertEqual(repo.description, 'Updated description')

    def test_delete_repository(self):
        """Test deleting repository."""
        repo = Repository.objects.create(owner=self.user1, name='test-repo')
        url = reverse('repository-delete', kwargs={'owner_id': self.user1.id, 'repo_name': 'test-repo'})

        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.user1_token}')
        response = self.client.delete(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(Repository.objects.filter(id=repo.id).exists())


class BranchAPITestCase(TestCase):
    """Test cases for branch APIs."""

    def setUp(self):
        """Set up test data."""
        self.client = APIClient()
        self.user = User.objects.create_user(
            email='user@example.com',
            password='testpass123'
        )
        refresh = RefreshToken.for_user(self.user)
        self.token = str(refresh.access_token)

        self.repo = Repository.objects.create(owner=self.user, name='test-repo')
        Branch.objects.create(repository=self.repo, name='main', commit_sha='0' * 40)

    def test_list_branches(self):
        """Test listing branches."""
        url = reverse('branch-list', kwargs={'owner_id': self.user.id, 'repo_name': 'test-repo'})

        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.token}')
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['name'], 'main')

    def test_create_branch(self):
        """Test creating a branch."""
        url = reverse('branch-create', kwargs={'owner_id': self.user.id, 'repo_name': 'test-repo'})

        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.token}')
        data = {'name': 'develop', 'commit_sha': 'a' * 40}
        response = self.client.post(url, data, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(Branch.objects.filter(repository=self.repo, name='develop').exists())

    def test_get_branch_detail(self):
        """Test getting branch details."""
        url = reverse('branch-detail', kwargs={
            'owner_id': self.user.id,
            'repo_name': 'test-repo',
            'branch_name': 'main'
        })

        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.token}')
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['name'], 'main')


class CommitAPITestCase(TestCase):
    """Test cases for commit APIs."""

    def setUp(self):
        """Set up test data."""
        self.client = APIClient()
        self.user = User.objects.create_user(
            email='user@example.com',
            password='testpass123',
            first_name='Test',
            last_name='User'
        )
        refresh = RefreshToken.for_user(self.user)
        self.token = str(refresh.access_token)

        self.repo = Repository.objects.create(owner=self.user, name='test-repo')
        self.branch = Branch.objects.create(repository=self.repo, name='main', commit_sha='0' * 40)
        self.tree = Tree.objects.create(repository=self.repo, sha='tree123', entries=[])

    def test_create_commit(self):
        """Test creating a commit."""
        url = reverse('commit-create', kwargs={'owner_id': self.user.id, 'repo_name': 'test-repo'})

        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.token}')
        data = {
            'message': 'Initial commit',
            'tree_sha': 'tree123',
            'parent_shas': [],
            'branch': 'main'
        }
        response = self.client.post(url, data, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(Commit.objects.filter(repository=self.repo).exists())

    def test_list_commits(self):
        """Test listing commits."""
        Commit.objects.create(
            repository=self.repo,
            sha='abc123',
            author=self.user,
            message='Test commit',
            tree_sha='tree123',
            author_name='Test User',
            author_email='user@example.com',
            committed_at='2024-01-01T00:00:00Z'
        )

        url = reverse('commit-list', kwargs={'owner_id': self.user.id, 'repo_name': 'test-repo'})

        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.token}')
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)

    def test_get_commit_detail(self):
        """Test getting commit details."""
        commit = Commit.objects.create(
            repository=self.repo,
            sha='abc123',
            author=self.user,
            message='Test commit',
            tree_sha='tree123',
            author_name='Test User',
            author_email='user@example.com',
            committed_at='2024-01-01T00:00:00Z'
        )

        url = reverse('commit-detail', kwargs={
            'owner_id': self.user.id,
            'repo_name': 'test-repo',
            'sha': 'abc123'
        })

        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.token}')
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['sha'], 'abc123')


class BlobAndTreeAPITestCase(TestCase):
    """Test cases for blob and tree APIs."""

    def setUp(self):
        """Set up test data."""
        self.client = APIClient()
        self.user = User.objects.create_user(
            email='user@example.com',
            password='testpass123'
        )
        refresh = RefreshToken.for_user(self.user)
        self.token = str(refresh.access_token)

        self.repo = Repository.objects.create(owner=self.user, name='test-repo')

    def test_create_blob(self):
        """Test creating a blob."""
        url = reverse('blob-create', kwargs={'owner_id': self.user.id, 'repo_name': 'test-repo'})

        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.token}')
        data = {'content': 'Hello, World!', 'encoding': 'utf-8'}
        response = self.client.post(url, data, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(Blob.objects.filter(repository=self.repo).exists())

    def test_get_blob_detail(self):
        """Test getting blob details."""
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
        """Test creating a tree."""
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
        """Test getting tree details."""
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
