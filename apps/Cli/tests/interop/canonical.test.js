const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const repository = require('../../src/utils/repository');
const ops = require('../../src/utils/gent-ops');
const merge = require('../../src/utils/merge-ops');
const stash = require('../../src/utils/stash-ops');
const journal = require('../../src/utils/canonical-journal');
const { GitIndex } = require('../../src/utils/git-index');

async function fixture(t) {
    const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'gent-interop-')));
    t.after(() => fs.rm(root, { recursive: true, force: true }));
    const probe = spawnSync('git', ['init', '--object-format=sha256', path.join(root, 'probe')], { encoding: 'utf8' });
    if (probe.status !== 0) { t.skip(`SHA-256 Git unavailable: ${probe.error?.message || probe.stderr}`); return null; }
    const { repo } = await repository.init(path.join(root, 'work'));
    repo.identity = async () => ({ name: 'Gent Test', email: 'gent@example.com', timestamp: Math.floor(Date.now() / 1000), timezone: '+0000' });
    const env = { ...process.env, GIT_AUTHOR_NAME: 'Git Test', GIT_AUTHOR_EMAIL: 'git@example.com', GIT_COMMITTER_NAME: 'Git Test', GIT_COMMITTER_EMAIL: 'git@example.com' };
    function git(args, input) {
        const result = spawnSync('git', args, { cwd: repo.worktree, env, input });
        assert.equal(result.status, 0, result.stderr?.toString());
        return result.stdout;
    }
    async function commit(name, bytes, message) {
        await fs.mkdir(path.dirname(path.join(repo.worktree, name)), { recursive: true });
        await fs.writeFile(path.join(repo.worktree, name), bytes);
        await ops.addPaths(repo, [path.join(repo.worktree, name)]);
        return ops.createCommit(repo, { message });
    }
    return { repo, git, commit, root };
}

test('Git validates Gent binary objects, merge DAG, tags and packed history', async t => {
    const f = await fixture(t); if (!f) return;
    const { repo, git, commit } = f;
    const binary = Buffer.from([0, 255, 13, 10, 128]);
    await commit('dir/binary', binary, 'base');
    const entry = (await GitIndex.read(repo.indexPath)).get('dir/binary');
    assert.equal(git(['hash-object', '--stdin'], binary).toString().trim(), entry.oid);
    await ops.createBranch(repo, 'feature');
    await commit('main-file', 'main\n', 'main');
    await ops.checkout(repo, 'feature');
    await commit('feature-file', 'feature\n', 'feature');
    await ops.checkout(repo, 'main');
    const merged = await merge.merge(repo, 'feature');
    assert.equal(merged.status, 'merged');
    assert.equal((await repo.objects.readCommit(merged.oid)).parents.length, 2);
    await ops.createTag(repo, 'v1', { message: 'release' });
    git(['fsck', '--full', '--strict']);
    git(['gc']); git(['pack-refs', '--all']);
    const reopened = await repository.open(repo.worktree);
    reopened.identity = repo.identity;
    assert.equal((await ops.walkHistory(reopened)).length, 4);
    assert.deepEqual(await reopened.objects.readBlob(entry.oid), binary);
    assert.equal((await ops.listTags(reopened))[0].annotated, true);
    git(['update-index', '--index-version=4']);
    await fs.writeFile(path.join(repo.worktree, 'main-file'), 'changed\n');
    await ops.addPaths(reopened, [path.join(repo.worktree, 'main-file')]);
    await ops.createCommit(reopened, { message: 'after packing' });
    git(['fsck', '--full', '--strict']);
    assert.equal(git(['status', '--porcelain']).toString(), '');
});

test('Git and Gent can apply each other’s stashes', async t => {
    const f = await fixture(t); if (!f) return;
    const { repo, git, commit } = f;
    await commit('a', 'base\n', 'base');
    await fs.writeFile(path.join(repo.worktree, 'a'), 'from gent\n');
    await stash.push(repo);
    assert.equal(git(['status', '--porcelain']).toString(), '');
    git(['stash', 'pop']);
    assert.equal(await fs.readFile(path.join(repo.worktree, 'a'), 'utf8'), 'from gent\n');
    git(['reset', '--hard']);
    await fs.writeFile(path.join(repo.worktree, 'a'), 'from git\n');
    git(['stash', 'push']);
    repo.refs.invalidate();
    await stash.pop(repo);
    assert.equal(await fs.readFile(path.join(repo.worktree, 'a'), 'utf8'), 'from git\n');
    assert.equal(git(['diff', '--cached']).length, 0);
});

test('undo roots survive Git pruning and external edits block undo', async t => {
    const f = await fixture(t); if (!f) return;
    const { repo, git, commit } = f;
    await commit('a', 'base\n', 'base');
    await fs.writeFile(path.join(repo.worktree, 'a'), 'staged\n');
    await ops.addPaths(repo, [path.join(repo.worktree, 'a')]);
    const checkpoint = await journal.begin(repo, 'commit');
    await ops.createCommit(repo, { message: 'next' });
    await journal.finish(repo, checkpoint);
    git(['gc', '--prune=now']);
    await journal.restore(repo);
    assert.match(git(['diff', '--cached']).toString(), /staged/);
    await journal.restore(repo, true);
    await fs.writeFile(path.join(repo.worktree, 'a'), 'external\n');
    await assert.rejects(journal.restore(repo), /intervening work/);
    assert.equal(await fs.readFile(path.join(repo.worktree, 'a'), 'utf8'), 'external\n');
});
