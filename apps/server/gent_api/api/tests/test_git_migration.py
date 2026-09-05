import base64
import json
import tempfile
from pathlib import Path
from unittest.mock import patch
from django.test import TestCase
from django.utils.dateparse import parse_datetime
from api.models import Repository, User, Commit, Tree, Blob, Branch, GitMigrationMap
from api.gitcore import migration


class MigrationTests(TestCase):
    def setUp(self):
        self.fixture = json.loads((Path(__file__).resolve().parents[5] / 'tests/fixtures/git-compat/legacy.json').read_text())
        self.user = User.objects.create_user(email='author@example.com')
        self.repo = Repository.objects.create(owner=self.user, name='legacy')
        c = self.fixture['history']['commits'][0]
        blob_id = next(iter(self.fixture['blobs']))
        raw = base64.b64decode(self.fixture['blobs'][blob_id])
        self.temp = tempfile.TemporaryDirectory(); self.addCleanup(self.temp.cleanup)
        blob_path = Path(self.temp.name) / 'blob'; blob_path.write_bytes(raw)
        Blob.objects.create(repository=self.repo, sha=blob_id, size=len(raw), file_path=str(blob_path))
        Tree.objects.create(repository=self.repo, sha='2' * 64, entries=[{'name':'nested/file', 'mode':'100644', 'type':'blob', 'sha':blob_id}])
        Commit.objects.create(repository=self.repo, sha=c['hash'], message=c['message'], tree_sha='2' * 64,
            parent_shas=[], author_name=c['author']['name'], author_email=c['author']['email'], committed_at=parse_datetime(c['timestamp']))
        Branch.objects.create(repository=self.repo, name='main', commit_sha=c['hash'])
        self.backup = Path(self.temp.name) / 'backup.json'

    def test_shared_migration_contract(self):
        incoming, mapping, refs = migration.convert(self.fixture['history'], lambda key: base64.b64decode(self.fixture['blobs'][key]))
        self.assertEqual(mapping, self.fixture['mapping'])
        self.assertEqual(refs, self.fixture['refs'])
        for item in self.fixture['objects']:
            self.assertEqual(incoming[item['oid']], (item['type'], base64.b64decode(item['payload'])))

    def test_server_dry_run_then_atomic_migration(self):
        result = migration.migrate(self.repo, self.backup, dry_run=True)
        self.assertFalse(self.backup.exists())
        self.repo.refresh_from_db(); self.assertEqual(self.repo.object_format, 'legacy')
        self.assertEqual(result['mapping'], self.fixture['mapping'])
        migration.migrate(self.repo, self.backup)
        self.repo.refresh_from_db(); self.assertEqual(self.repo.object_format, 'sha256')
        self.assertTrue(self.backup.exists())
        self.assertEqual(GitMigrationMap.objects.get(repository=self.repo).new_oid, next(iter(result['mapping'].values())))
        self.assertFalse(Commit.objects.filter(repository=self.repo, sha='1' * 64).exists())

    def test_failed_publication_restores_legacy_models_and_format(self):
        with patch('api.gitcore.store.publish', side_effect=RuntimeError('simulated DB failure')):
            with self.assertRaises(RuntimeError):
                migration.migrate(self.repo, self.backup)
        self.repo.refresh_from_db(); self.assertEqual(self.repo.object_format, 'legacy')
        self.assertTrue(Commit.objects.filter(repository=self.repo, sha='1' * 64).exists())
        self.assertFalse(GitMigrationMap.objects.exists())
        self.assertTrue(self.backup.exists())
