import base64
import hashlib
from unittest.mock import patch
from django.test import TestCase
from api.models import User, Repository, GitObject, GitRef, Commit, PersonalAccessToken
from api.gitcore import objects, pack, store, protocol


def fixture(message=b'first\n'):
    blob = b'\x00\xffbinary\n'
    blob_id = objects.object_id('blob', blob)
    tree = objects.serialize_tree([{'name': 'file', 'mode': '100644', 'sha': blob_id}])
    tree_id = objects.object_id('tree', tree)
    commit = (f'tree {tree_id}\nauthor Outside <outside@example.com> 1700000000 +0300\n'
              'committer Other <other@example.com> 1700000010 +0000\n\n').encode() + message
    commit_id = objects.object_id('commit', commit)
    return commit_id, {blob_id: ('blob', blob), tree_id: ('tree', tree), commit_id: ('commit', commit)}


class GitCoreTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(email='owner@example.com', username='owner')
        self.repo = Repository.objects.create(owner=self.user, name='canonical', object_format='sha256')
        self.key, self.incoming = fixture()

    def publish(self):
        store.publish(self.repo, self.user, [(objects.ZERO, self.key, 'refs/heads/main')], self.incoming)

    def test_pack_binary_roundtrip_and_checksum(self):
        self.assertEqual(pack.decode(pack.encode(list(self.incoming.values()))), self.incoming)
        data = pack.encode(list(self.incoming.values()))
        with self.assertRaises(objects.GitError):
            pack.decode(data[:-1] + bytes([data[-1] ^ 1]))

    def test_transaction_indexes_and_repository_scoped_identity(self):
        self.publish()
        other = Repository.objects.create(owner=self.user, name='second', object_format='sha256')
        store.publish(other, self.user, [(objects.ZERO, self.key, 'refs/heads/main')], self.incoming)
        self.assertEqual(Commit.objects.filter(sha=self.key).count(), 2)
        commit = Commit.objects.get(repository=self.repo, sha=self.key)
        self.assertIsNone(commit.author)
        self.assertEqual(commit.committer_name, 'Other')
        self.assertEqual(commit.author_timezone, '+0300')
        blob_id = next(k for k, v in self.incoming.items() if v[0] == 'blob')
        response = self.client.get(f'/api/repos/owner/canonical/blob/{blob_id}/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(base64.b64decode(response.json()['content']), self.incoming[blob_id][1])

    def test_missing_closure_and_stale_ref_leave_no_mutations(self):
        with self.assertRaises(objects.GitError):
            store.publish(self.repo, self.user, [(objects.ZERO, self.key, 'refs/heads/main')], {self.key: self.incoming[self.key]})
        self.assertFalse(GitObject.objects.exists())
        self.assertFalse(GitRef.objects.exists())
        self.publish()
        with self.assertRaises(objects.GitError):
            self.publish()
        self.assertEqual(GitRef.objects.get().target, self.key)

    def test_database_failure_rolls_back_objects_refs_and_indexes(self):
        with patch.object(GitRef.objects, 'update_or_create', side_effect=RuntimeError('database failed')):
            with self.assertRaises(RuntimeError):
                self.publish()
        self.assertFalse(GitObject.objects.exists())
        self.assertFalse(Commit.objects.exists())
        self.assertFalse(GitRef.objects.exists())

    def test_wrong_relationship_and_private_refs_rejected(self):
        blob_id = next(k for k, v in self.incoming.items() if v[0] == 'blob')
        for target, ref in [(blob_id, 'refs/heads/main'), (self.key, 'refs/gent/journal/1')]:
            with self.assertRaises(objects.GitError):
                store.publish(self.repo, self.user, [(objects.ZERO, target, ref)], self.incoming)
        self.assertFalse(GitObject.objects.exists())

    def test_gitlink_does_not_require_external_object(self):
        data = objects.serialize_tree([{'mode': '160000', 'name': 'sub', 'sha': 'a' * 64}])
        key = objects.object_id('tree', data)
        self.assertEqual(store.closure([(key, 'tree')], lambda _: ('tree', data)), {key: ('tree', data)})

    def test_protocol_v2_request_gets_v0_and_unadvertised_want_fails(self):
        self.publish()
        response = self.client.get('/owner/canonical.git/info/refs?service=git-upload-pack', HTTP_GIT_PROTOCOL='version=2')
        self.assertEqual(response.status_code, 200)
        self.assertIn(b'object-format=sha256', response.content)
        self.assertNotIn(b'version 2', response.content)
        blob_id = next(k for k, v in self.incoming.items() if v[0] == 'blob')
        with self.assertRaises(objects.GitError):
            protocol.upload(self.repo, protocol.pkt(f'want {blob_id} object-format=sha256\n') + b'0000' + protocol.pkt('done\n'))

    def test_authentication_scope_revocation_and_legacy_guard(self):
        endpoint = '/owner/canonical.git/info/refs?service=git-receive-pack'
        self.assertEqual(self.client.get(endpoint).status_code, 401)
        token = PersonalAccessToken.objects.create(user=self.user, name='test', can_write=True,
            repository=self.repo, digest=hashlib.sha256(b'secret').hexdigest())
        auth = 'Basic ' + base64.b64encode(b'owner:secret').decode()
        self.assertEqual(self.client.get(endpoint, HTTP_AUTHORIZATION=auth).status_code, 200)
        token.delete()
        self.assertEqual(self.client.get(endpoint, HTTP_AUTHORIZATION=auth).status_code, 401)
        from rest_framework.test import APIClient
        client = APIClient(); client.force_authenticate(self.user)
        response = client.post('/api/repos/owner/canonical/blob/create/', {'content': 'bad'})
        self.assertEqual(response.status_code, 409)
        self.assertFalse(GitObject.objects.exists())

    def test_receive_only_reports_success_after_commit(self):
        request = protocol.pkt(f'{objects.ZERO} {self.key} refs/heads/main\0report-status object-format=sha256\n') + b'0000' + pack.encode(list(self.incoming.values()))
        response = protocol.receive(self.repo, self.user, request)
        self.assertIn(b'ok refs/heads/main', response)
        self.assertEqual(GitRef.objects.get().target, self.key)
        response = protocol.receive(self.repo, self.user, request)
        self.assertIn(b'ng refs/heads/main', response)
        self.assertNotIn(b'\nok refs/heads/main', response)

    def test_private_reads_and_repository_scoped_tokens(self):
        self.repo.is_private = True; self.repo.save()
        endpoint = '/owner/canonical.git/info/refs?service=git-upload-pack'
        self.assertEqual(self.client.get(endpoint).status_code, 401)
        other = Repository.objects.create(owner=self.user, name='other', object_format='sha256')
        token = PersonalAccessToken.objects.create(user=self.user, repository=other, can_write=True,
            name='wrong-scope', digest=hashlib.sha256(b'scoped').hexdigest())
        auth = 'Basic ' + base64.b64encode(b'owner:scoped').decode()
        self.assertEqual(self.client.get(endpoint, HTTP_AUTHORIZATION=auth).status_code, 401)
        token.repository = self.repo; token.save()
        self.assertEqual(self.client.get(endpoint, HTTP_AUTHORIZATION=auth).status_code, 200)

    def test_multi_ref_stale_update_is_all_or_nothing(self):
        self.publish()
        with self.assertRaises(objects.GitError):
            store.publish(self.repo, self.user,
                [(objects.ZERO, self.key, 'refs/heads/new'), (objects.ZERO, self.key, 'refs/heads/main')], self.incoming)
        self.assertFalse(GitRef.objects.filter(name='refs/heads/new').exists())

    def test_canonical_commit_api_and_binary_diff(self):
        self.publish()
        response = self.client.get(f'/api/repos/owner/canonical/commits/{self.key}/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['committer_timestamp'], 1700000010)
        response = self.client.get(f'/api/repos/owner/canonical/commits/{self.key}/diff/')
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()['files'][0]['binary'])

    def test_tag_target_is_preserved_separately_from_peeled_commit(self):
        from api.models import Tag
        self.publish()
        payload = f'object {self.key}\ntype commit\ntag v1\n\nrelease\n'.encode()
        tag_id = objects.object_id('tag', payload)
        store.publish(self.repo, self.user, [(objects.ZERO, tag_id, 'refs/tags/v1')], {tag_id: ('tag', payload)})
        tag = Tag.objects.get(repository=self.repo, name='v1')
        self.assertEqual(tag.target_oid, tag_id)
        self.assertEqual(tag.target_type, 'tag')
        self.assertEqual(tag.commit_sha, self.key)

    def test_forward_ref_delta_pack(self):
        import struct
        import zlib
        base, delta = b'abc', bytes([3, 4, 0x90, 3, 1, 100])
        body = (b'PACK' + struct.pack('!II', 2, 2) + bytes([0x70 | len(delta)])
                + bytes.fromhex(objects.object_id('blob', base)) + zlib.compress(delta)
                + bytes([0x30 | len(base)]) + zlib.compress(base))
        result = pack.decode(body + hashlib.sha256(body).digest())
        self.assertEqual(result[objects.object_id('blob', b'abcd')], ('blob', b'abcd'))

    def test_shared_node_python_canonical_fixtures(self):
        import json
        from pathlib import Path
        fixture = json.loads((Path(__file__).resolve().parents[5] / 'tests/fixtures/git-compat/canonical.json').read_text())
        decoded = pack.decode(base64.b64decode(fixture['pack']))
        for item in fixture['objects']:
            payload = base64.b64decode(item['payload'])
            self.assertEqual(objects.object_id(item['type'], payload), item['oid'])
            self.assertEqual(decoded[item['oid']], (item['type'], payload))
            objects.dependencies(item['type'], payload)

    def test_browser_edits_preserve_other_files_and_reject_stale_heads(self):
        from api.gitcore.rest import commit_files
        first = commit_files(self.repo, self.user, 'main', None, 'browser initial', [
            {'path': 'nested/a', 'data': base64.b64encode(b'a\0\xff').decode()},
            {'path': 'keep', 'data': base64.b64encode(b'keep\n').decode()}])
        second = commit_files(self.repo, self.user, 'main', first.sha, 'browser update', [
            {'path': 'nested/a', 'data': base64.b64encode(b'updated').decode()}])
        tree = objects.parse_tree(store.read(self.repo, second.tree_sha)[1])
        self.assertEqual([entry['name'] for entry in tree], ['keep', 'nested'])
        self.assertEqual(second.parent_shas, [first.sha])
        with self.assertRaises(objects.GitError):
            commit_files(self.repo, self.user, 'main', first.sha, 'stale', [{'path': 'keep', 'delete': True}])
        self.assertEqual(GitRef.objects.get(repository=self.repo, name='refs/heads/main').target, second.sha)

    def test_browser_branch_and_tag_mutations_use_canonical_refs(self):
        from rest_framework.test import APIClient
        client = APIClient(); client.force_authenticate(self.user)
        self.publish()
        response = client.post('/api/repos/owner/canonical/branches/create/', {'name': 'feature/nested', 'commit_sha': self.key})
        self.assertEqual(response.status_code, 201)
        self.assertEqual(GitRef.objects.get(repository=self.repo, name='refs/heads/feature/nested').target, self.key)
        response = client.delete('/api/repos/owner/canonical/branches/feature/nested/')
        self.assertEqual(response.status_code, 200)
        self.assertFalse(GitRef.objects.filter(repository=self.repo, name='refs/heads/feature/nested').exists())
        response = client.post('/api/repos/owner/canonical/tags/create/', {'name': 'release/v1', 'commit_sha': self.key, 'annotated': True, 'message': 'release'})
        self.assertEqual(response.status_code, 201)
        target = response.json()['tag']['target_oid']
        self.assertEqual(store.read(self.repo, target)[0], 'tag')
        self.assertEqual(client.delete('/api/repos/owner/canonical/tags/release/v1/').status_code, 200)
        self.assertFalse(GitRef.objects.filter(repository=self.repo, name='refs/tags/release/v1').exists())
