const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const contract = require('./fixtures/git-graph-1.30.0-contract.json');
const { parseInvocation, validateRead } = require('../../src/utils/git-graph-adapter');

const examples = {
    'branches-local': ['branch', '--no-color'],
    'branches-all': ['branch', '-a', '--no-color'],
    remotes: ['remote'],
    'remote-url': ['config', '--get', 'remote.origin.url'],
    'config-consolidated': ['--no-pager', 'config', '--list', '-z', '--includes'],
    'config-local': ['--no-pager', 'config', '--list', '-z', '--includes', '--local'],
    'config-global': ['--no-pager', 'config', '--list', '-z', '--includes', '--global'],
    'refs-all': ['show-ref', '-d', '--head'],
    'refs-local-and-tags': ['show-ref', '--heads', '--tags', '-d', '--head'],
    'graph-log-selected': ['-c', 'log.showSignature=false', 'log', '--max-count=51', '--format=%H%x1f%s', '--topo-order', '--first-parent', 'main', '--'],
    'graph-log-all': ['-c', 'log.showSignature=false', 'log', '--max-count=51', '--format=%H%x1f%s', '--date-order', '--branches', '--tags', '--reflog', '--remotes', 'HEAD', '--'],
    'commit-subject': ['-c', 'log.showSignature=false', 'log', '--format=%s', '-n', '1', 'HEAD', '--'],
    'commit-details': ['-c', 'log.showSignature=false', 'show', '--quiet', 'HEAD', '--format=%H%x1f%B'],
    'file-at-commit': ['show', 'HEAD:path with space.txt'],
    'tag-details': ['for-each-ref', 'refs/tags/v1', '--format=%(objectname)'],
    stashes: ['reflog', '--format=%H%x1f%gD', 'refs/stash', '--'],
    'uncommitted-count': ['status', '--untracked-files=all', '--porcelain'],
    'uncommitted-files': ['status', '-s', '--untracked-files=no', '--porcelain', '-z'],
    'diff-name-status': ['diff', '--name-status', '--find-renames', '--diff-filter=AMDR', '-z', 'HEAD^', 'HEAD'],
    'diff-numstat': ['diff', '--numstat', '--find-renames', '--diff-filter=AMDR', '-z', 'HEAD^', 'HEAD'],
    'tree-name-status': ['diff-tree', '--name-status', '-r', '--root', '--find-renames', '--diff-filter=AMDR', '-z', 'HEAD'],
    'tree-numstat': ['diff-tree', '--numstat', '-r', '--root', '--find-renames', '--diff-filter=AMDR', '-z', 'HEAD'],
    'staged-changes-probe': ['diff-index', 'HEAD']
};

test('the adapter recognizes every pinned Git Graph 1.30.0 read family', () => {
    assert.equal(contract.extension.sourceCommit, '881a9e613045bacbbadf8940f6b6c5b8bd699335');
    assert.equal(contract.extension.officialVsixSha256, 'b0779a30caf9866434900159c71322464e9fd267e3920d9732703819ff831f00');
    for (const entry of contract.reads) {
        const argv = examples[entry.id];
        assert.ok(argv, `missing concrete contract example for ${entry.id}`);
        assert.equal(validateRead(parseInvocation(argv, path.parse(process.cwd()).root)), true, entry.id);
    }
});

test('dangerous read variants remain outside the contract', () => {
    for (const argv of [
        ['diff', '--ext-diff', '--name-status', '-z', 'HEAD'],
        ['show', '--output=/tmp/leak', 'HEAD'],
        ['config', '--get', 'credential.helper'],
        ['reflog', 'delete', 'HEAD@{0}'],
        ['branch', '--format=%(refname)']
    ]) {
        assert.equal(validateRead(parseInvocation(argv)), false, argv.join(' '));
    }
});
