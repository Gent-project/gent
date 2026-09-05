"""External Git is a test oracle only. Exercises real HTTP, not mocked RPC."""
import base64
import hashlib
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
from django.test import LiveServerTestCase
from api.models import User, Repository, PersonalAccessToken, GitRef


class GitHTTPInteropTests(LiveServerTestCase):
    def setUp(self):
        self.git = shutil.which('git')
        self.node = shutil.which('node')
        if not self.git or not self.node:
            self.skipTest('Git and Node required for external interoperability evidence')
        self.temp = tempfile.TemporaryDirectory(prefix='gent-http-')
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.cli = Path(__file__).resolve().parents[4] / 'Cli' / 'src' / 'index.js'
        self.env = {**os.environ, 'GIT_CONFIG_NOSYSTEM': '1', 'GIT_CONFIG_GLOBAL': os.devnull,
                    'GIT_TERMINAL_PROMPT': '0', 'GENT_HTTP_USER': 'owner', 'GENT_HTTP_TOKEN': 'test-secret',
                    'GIT_AUTHOR_NAME': 'Outside', 'GIT_AUTHOR_EMAIL': 'outside@example.com',
                    'GIT_COMMITTER_NAME': 'Outside', 'GIT_COMMITTER_EMAIL': 'outside@example.com'}
        user = User.objects.create_user(email='owner@example.com', username='owner')
        self.repo = Repository.objects.create(owner=user, name='interop', object_format='sha256')
        PersonalAccessToken.objects.create(user=user, name='test', can_write=True, repository=self.repo,
            digest=hashlib.sha256(b'test-secret').hexdigest())
        self.url = self.live_server_url + '/owner/interop.git'
        self.auth = 'Authorization: Basic ' + base64.b64encode(b'owner:test-secret').decode()

    def run_cmd(self, args, cwd, env=None):
        result = subprocess.run(args, cwd=cwd, env=env or self.env, capture_output=True, timeout=30)
        self.assertEqual(result.returncode, 0, result.stderr.decode(errors='replace') + result.stdout.decode(errors='replace'))
        return result.stdout.decode().strip()

    def git_cmd(self, cwd, *args):
        return self.run_cmd([self.git, '-c', 'http.extraHeader=' + self.auth, *args], cwd)

    def gent(self, cwd, *args):
        return self.run_cmd([self.node, str(self.cli), *args], cwd, {**self.env, 'PATH': ''})

    def test_git_push_clone_gent_fetch_pull_push_and_git_fetch(self):
        source = self.root / 'source'; source.mkdir()
        self.git_cmd(source, 'init', '--object-format=sha256', '-b', 'main')
        (source / 'binary').write_bytes(b'\0\xff\xfehello\n')
        self.git_cmd(source, 'add', '.')
        self.git_cmd(source, 'commit', '-m', 'Git first')
        self.git_cmd(source, 'remote', 'add', 'origin', self.url)
        self.git_cmd(source, 'push', '-u', 'origin', 'main')
        self.git_cmd(self.root, 'clone', self.url, 'git-clone')
        clone = self.root / 'git-clone'
        self.git_cmd(clone, 'fsck', '--full', '--strict')
        self.assertEqual((clone / 'binary').read_bytes(), b'\0\xff\xfehello\n')
        self.gent(self.root, 'clone', self.url, 'gent-clone')
        gent = self.root / 'gent-clone'
        self.gent(gent, 'config', 'set', 'user.name', 'Gent')
        self.gent(gent, 'config', 'set', 'user.email', 'gent@example.com')
        (gent / 'added').write_text('from Gent\n')
        self.gent(gent, 'add', '.')
        self.gent(gent, 'commit', '-m', 'Gent second')
        self.gent(gent, 'push')
        self.git_cmd(clone, 'pull', '--ff-only')
        self.assertEqual((clone / 'added').read_text(), 'from Gent\n')
        self.git_cmd(clone, 'tag', '-a', 'v1', '-m', 'release')
        self.git_cmd(clone, 'push', 'origin', 'refs/tags/v1')
        (clone / 'third').write_text('from Git again\n')
        self.git_cmd(clone, 'add', '.')
        self.git_cmd(clone, 'commit', '-m', 'Git third')
        self.git_cmd(clone, 'push')
        self.gent(gent, 'fetch')
        self.gent(gent, 'pull')
        self.assertEqual((gent / 'third').read_text(), 'from Git again\n')
        self.git_cmd(gent, 'fsck', '--full', '--strict')
        self.assertEqual(self.git_cmd(gent, 'rev-parse', 'HEAD'), GitRef.objects.get(repository=self.repo, name='refs/heads/main').target)
        self.git_cmd(clone, 'push', 'origin', ':refs/tags/v1')
        self.assertFalse(GitRef.objects.filter(repository=self.repo, name='refs/tags/v1').exists())

    def test_empty_clone_then_gent_originated_history(self):
        self.git_cmd(self.root, 'clone', self.url, 'empty-git')
        empty = self.root / 'empty-git'
        self.assertEqual(self.git_cmd(empty, 'rev-parse', '--show-object-format'), 'sha256')
        self.gent(self.root, 'clone', self.url, 'empty-gent')
        gent = self.root / 'empty-gent'
        (gent / 'file').write_text('initial\n')
        self.gent(gent, 'add', '.')
        self.gent(gent, 'commit', '-m', 'Gent initial')
        self.gent(gent, 'push')
        self.git_cmd(empty, 'fetch')
        self.git_cmd(empty, 'checkout', '-B', 'main', 'origin/main')
        self.git_cmd(empty, 'fsck', '--full', '--strict')
        self.assertEqual((empty / 'file').read_text(), 'initial\n')

    def test_connected_legacy_migration_agrees_with_server_and_preserves_binary(self):
        import json
        import zlib
        from django.utils.dateparse import parse_datetime
        from api.models import Commit, Tree, Blob, Branch
        from api.gitcore.migration import migrate
        fixture = json.loads((Path(__file__).resolve().parents[5] / 'tests/fixtures/git-compat/legacy.json').read_text())
        history = fixture['history']; history['tags'] = {}
        commit = history['commits'][0]
        blob_id = next(iter(fixture['blobs'])); raw = base64.b64decode(fixture['blobs'][blob_id])
        self.repo.object_format = 'legacy'; self.repo.save()
        storage = self.root / 'legacy-blob'; storage.write_bytes(raw)
        Blob.objects.create(repository=self.repo, sha=blob_id, size=len(raw), file_path=str(storage))
        Tree.objects.create(repository=self.repo, sha='2' * 64, entries=[{'name': 'nested/file', 'sha': blob_id, 'mode': '100644', 'type': 'blob'}])
        Commit.objects.create(repository=self.repo, sha=commit['hash'], tree_sha='2' * 64, message=commit['message'],
            parent_shas=[], author_name=commit['author']['name'], author_email=commit['author']['email'], committed_at=parse_datetime(commit['timestamp']))
        Branch.objects.create(repository=self.repo, name='main', commit_sha=commit['hash'])
        source = self.root / 'legacy'; gitdir = source / '.gent'
        (gitdir / 'objects' / blob_id[:2]).mkdir(parents=True)
        (gitdir / 'objects' / blob_id[:2] / blob_id[2:]).write_bytes(zlib.compress(f'blob {len(raw)}\0'.encode() + raw))
        (gitdir / 'commits.json').write_text(json.dumps(history))
        (gitdir / 'staging.json').write_text(json.dumps({'files': [], 'entries': []}))
        (gitdir / 'config.json').write_text(json.dumps({'user': commit['author'], 'remotes': {'origin': {'url': self.live_server_url + '/api/repos/owner/interop'}}}))
        (source / 'nested').mkdir(); (source / 'nested/file').write_bytes(raw)
        report = migrate(self.repo, self.root / 'server-backup.json')
        local = json.loads(self.gent(source, 'migrate', '--dry-run'))
        self.assertEqual(local['mapping'], report['mapping'])
        self.gent(source, 'migrate')
        self.gent(source, 'push')
        self.git_cmd(source, 'fsck', '--full', '--strict')
        self.assertEqual((source / 'nested/file').read_bytes(), raw)
        response = self.client.get(f'/api/repos/owner/interop/commits/{commit["hash"]}/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['sha'], report['mapping'][commit['hash']])
