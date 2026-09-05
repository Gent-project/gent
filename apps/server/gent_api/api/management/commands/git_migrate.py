import json
from pathlib import Path
from django.core.management.base import BaseCommand, CommandError
from api.models import Repository
from api.gitcore.migration import migrate
from api.gitcore.objects import GitError


class Command(BaseCommand):
    help = 'Migrate a legacy repository transactionally, retaining a verified external backup'

    def add_arguments(self, parser):
        parser.add_argument('repository', type=int)
        parser.add_argument('--dry-run', action='store_true')
        parser.add_argument('--backup')

    def handle(self, *args, **options):
        try:
            repository = Repository.objects.get(pk=options['repository'])
            backup = Path(options['backup']).resolve() if options['backup'] else None
            if backup and backup.is_relative_to(repository.get_storage_path().resolve()):
                raise GitError('backup must be outside active repository storage')
            result = migrate(repository, backup, options['dry_run'])
        except (Repository.DoesNotExist, GitError, OSError, KeyError) as error:
            raise CommandError(str(error)) from error
        self.stdout.write(json.dumps(result, indent=2))
