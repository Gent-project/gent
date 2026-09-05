from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
from django.db import connection, close_old_connections, connections
from django.test import TransactionTestCase
from api.models import User, Repository, GitObject, GitRef
from api.gitcore import store, objects
from api.tests.test_gitcore import fixture


class PostgreSQLConcurrencyTests(TransactionTestCase):
    def test_concurrent_stale_pushes_publish_exactly_one_tip(self):
        if connection.vendor != 'postgresql':
            self.skipTest('requires PostgreSQL row locking; run postgres_test_settings')
        user = User.objects.create_user(email='writer@example.com')
        repo = Repository.objects.create(owner=user, name='concurrent', object_format='sha256')
        base, initial = fixture()
        store.publish(repo, user, [(objects.ZERO, base, 'refs/heads/main')], initial)
        barrier = Barrier(2)
        def push(label):
            close_old_connections()
            try:
                payload = initial[base][1].replace(b'\nauthor ', f'\nparent {base}\nauthor '.encode()).replace(b'first\n', label.encode())
                key = objects.object_id('commit', payload)
                barrier.wait(timeout=10)
                try:
                    store.publish(repo, user, [(base, key, 'refs/heads/main')], {key: ('commit', payload)})
                    return 'ok', key
                except objects.GitError as error:
                    return str(error), key
            finally:
                connections['default'].close()
        with ThreadPoolExecutor(max_workers=2) as pool:
            results = list(pool.map(push, ['one', 'two']))
        self.assertEqual(sum(status == 'ok' for status, _ in results), 1)
        winner = next(key for status, key in results if status == 'ok')
        loser = next(key for status, key in results if status != 'ok')
        self.assertEqual(GitRef.objects.get(repository=repo).target, winner)
        self.assertFalse(GitObject.objects.filter(repository=repo, oid=loser).exists())
        self.assertTrue(any('stale old ref' in status for status, _ in results))
        connections['default'].close()
        self.assertEqual(store.read(repo, winner)[0], 'commit')
