"""Operator token provisioning; store only a digest and show the secret once."""
import hashlib
import secrets
from django.core.management.base import BaseCommand, CommandError
from api.models import User, Repository, PersonalAccessToken


class Command(BaseCommand):
    help = 'Issue or revoke a scoped smart-HTTP personal access token'

    def add_arguments(self, parser):
        parser.add_argument('username')
        parser.add_argument('--name', default='git')
        parser.add_argument('--repository', type=int)
        parser.add_argument('--write', action='store_true')
        parser.add_argument('--revoke', type=int)

    def handle(self, *args, **options):
        try:
            user = User.objects.get(username=options['username'], is_active=True)
        except User.DoesNotExist:
            raise CommandError('active user not found')
        if options['revoke']:
            PersonalAccessToken.objects.filter(user=user, pk=options['revoke']).delete()
            self.stdout.write('Token revoked')
            return
        repository = None
        if options['repository']:
            try:
                repository = Repository.objects.get(pk=options['repository'])
            except Repository.DoesNotExist:
                raise CommandError('repository not found')
        secret = secrets.token_urlsafe(32)
        token = PersonalAccessToken.objects.create(user=user, name=options['name'], repository=repository,
            can_write=options['write'], digest=hashlib.sha256(secret.encode()).hexdigest())
        self.stdout.write(f'Token {token.pk}; save this secret now: {secret}')
