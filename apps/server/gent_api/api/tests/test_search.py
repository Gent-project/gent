"""Tests for the anonymous discovery endpoints."""
import json

from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from api.models import Repository, RepositoryMember, RepositoryMemberRole, User


class SearchTestMixin:
    """Two users with a mix of public and private repositories."""

    def setUp(self):
        self.client = APIClient()
        self.alice = User.objects.create_user(
            email='alice@example.com',
            password='testpass123',
            username='alice',
        )
        self.bob = User.objects.create_user(
            email='bob@example.com',
            password='testpass123',
            username='bob',
        )

        self.public_repo = Repository.objects.create(
            owner=self.alice,
            name='gent',
            description='A version control system',
            is_private=False,
        )
        self.public_other = Repository.objects.create(
            owner=self.bob,
            name='gent-tools',
            description='Helpers built on top of gent',
            is_private=False,
        )
        self.alice_private = Repository.objects.create(
            owner=self.alice,
            name='gent-secret',
            is_private=True,
        )
        self.bob_private = Repository.objects.create(
            owner=self.bob,
            name='gent-hidden',
            is_private=True,
        )

        self.alice_token = str(RefreshToken.for_user(self.alice).access_token)

    def authenticate(self, token):
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')

    def search_repos(self, **params):
        return self.client.get(reverse('repository-search'), params)


class RepositorySearchVisibilityTests(SearchTestMixin, TestCase):
    def test_anonymous_search_returns_only_public_repositories(self):
        response = self.search_repos(q='gent')

        self.assertEqual(response.status_code, 200)
        names = {repo['name'] for repo in response.data['results']}
        self.assertEqual(names, {'gent', 'gent-tools'})

    def test_authenticated_user_sees_own_private_but_not_others(self):
        self.authenticate(self.alice_token)

        response = self.search_repos(q='gent')

        names = {repo['name'] for repo in response.data['results']}
        self.assertIn('gent-secret', names)
        self.assertNotIn('gent-hidden', names)

    def test_collaborator_sees_repository_they_are_a_member_of(self):
        RepositoryMember.objects.create(
            repository=self.bob_private,
            user=self.alice,
            role=RepositoryMemberRole.READ,
            added_by=self.bob,
        )
        self.authenticate(self.alice_token)

        names = {repo['name'] for repo in self.search_repos(q='gent').data['results']}

        self.assertIn('gent-hidden', names)

    def test_empty_query_lists_public_repositories(self):
        response = self.search_repos()

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['count'], 2)


class RepositorySearchQueryTests(SearchTestMixin, TestCase):
    def test_owner_slash_name_qualifier(self):
        response = self.search_repos(q='bob/gent')

        names = {repo['name'] for repo in response.data['results']}
        self.assertEqual(names, {'gent-tools'})

    def test_owner_qualifier_does_not_leak_private_repositories(self):
        response = self.search_repos(q='bob/gent')

        names = {repo['name'] for repo in response.data['results']}
        self.assertNotIn('gent-hidden', names)

    def test_description_is_searchable(self):
        response = self.search_repos(q='version control')

        names = {repo['name'] for repo in response.data['results']}
        self.assertEqual(names, {'gent'})

    def test_owner_username_is_searchable(self):
        response = self.search_repos(q='alice')

        names = {repo['name'] for repo in response.data['results']}
        self.assertEqual(names, {'gent'})

    def test_best_sort_ranks_exact_name_match_first(self):
        response = self.search_repos(q='gent')

        self.assertEqual(response.data['results'][0]['name'], 'gent')

    def test_name_sort_is_alphabetical(self):
        response = self.search_repos(q='gent', sort='name')

        names = [repo['name'] for repo in response.data['results']]
        self.assertEqual(names, sorted(names))

    def test_unknown_sort_falls_back_to_best(self):
        response = self.search_repos(q='gent', sort='bogus')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['results'][0]['name'], 'gent')


class SearchPaginationTests(SearchTestMixin, TestCase):
    def test_response_is_paginated(self):
        response = self.search_repos(q='gent')

        for key in ('count', 'next', 'previous', 'results'):
            self.assertIn(key, response.data)

    def test_page_parameter_is_honoured(self):
        for index in range(25):
            Repository.objects.create(
                owner=self.alice,
                name=f'gent-bulk-{index}',
                is_private=False,
            )

        first = self.search_repos(q='gent')
        second = self.search_repos(q='gent', page=2)

        self.assertEqual(len(first.data['results']), 20)
        self.assertTrue(second.data['results'])
        first_names = {repo['name'] for repo in first.data['results']}
        second_names = {repo['name'] for repo in second.data['results']}
        self.assertFalse(first_names & second_names)


class EmailPrivacyTests(SearchTestMixin, TestCase):
    def assertNoEmail(self, response):
        body = json.dumps(response.data, default=str)
        self.assertNotIn('owner_email', body)
        self.assertNotIn('alice@example.com', body)
        self.assertNotIn('bob@example.com', body)

    def test_repository_search_hides_emails(self):
        self.assertNoEmail(self.search_repos(q='gent'))

    def test_user_search_hides_emails(self):
        self.assertNoEmail(self.client.get(reverse('user-search'), {'q': 'alice'}))

    def test_public_profile_hides_emails(self):
        response = self.client.get(reverse('public-user-detail', args=['alice']))
        self.assertNoEmail(response)

    def test_user_search_does_not_match_on_email(self):
        response = self.client.get(reverse('user-search'), {'q': 'example.com'})

        self.assertEqual(response.data['count'], 0)


class UserSearchTests(SearchTestMixin, TestCase):
    def test_finds_user_by_username(self):
        response = self.client.get(reverse('user-search'), {'q': 'alice'})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['results'][0]['username'], 'alice')

    def test_public_repo_count_excludes_private(self):
        response = self.client.get(reverse('user-search'), {'q': 'alice'})

        self.assertEqual(response.data['results'][0]['public_repo_count'], 1)

    def test_inactive_users_are_excluded(self):
        self.alice.is_active = False
        self.alice.save(update_fields=['is_active'])

        response = self.client.get(reverse('user-search'), {'q': 'alice'})

        self.assertEqual(response.data['count'], 0)

    def test_display_name_falls_back_to_username(self):
        response = self.client.get(reverse('user-search'), {'q': 'alice'})

        self.assertEqual(response.data['results'][0]['display_name'], 'alice')


class PublicProfileTests(SearchTestMixin, TestCase):
    def test_anonymous_profile_lists_only_public_repositories(self):
        response = self.client.get(reverse('public-user-detail', args=['alice']))

        self.assertEqual(response.status_code, 200)
        names = {repo['name'] for repo in response.data['repositories']}
        self.assertEqual(names, {'gent'})

    def test_owner_sees_their_private_repositories(self):
        self.authenticate(self.alice_token)

        response = self.client.get(reverse('public-user-detail', args=['alice']))

        names = {repo['name'] for repo in response.data['repositories']}
        self.assertEqual(names, {'gent', 'gent-secret'})

    def test_profile_resolves_by_numeric_id(self):
        response = self.client.get(reverse('public-user-detail', args=[str(self.alice.id)]))

        self.assertEqual(response.data['user']['username'], 'alice')

    def test_unknown_user_returns_404(self):
        response = self.client.get(reverse('public-user-detail', args=['nobody']))

        self.assertEqual(response.status_code, 404)

    def test_public_repo_count_is_reported(self):
        response = self.client.get(reverse('public-user-detail', args=['alice']))

        self.assertEqual(response.data['user']['public_repo_count'], 1)
