/** Run the actual engine/CLI regressions with no executable search path. */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const modules = ['attributes', 'feature-support', 'gent-ops', 'git-config', 'git-index', 'git-objects', 'ignore', 'lockfile', 'merge-ops', 'object-store', 'packfile', 'refs', 'repository', 'stash-ops', 'worktree', 'canonical-journal'];
for (const name of modules) {
    const source = fs.readFileSync(path.resolve(__dirname, `../../src/utils/${name}.js`), 'utf8');
    assert.doesNotMatch(source, /require\(['"](?:node:)?child_process['"]\)|require\(['"](?:isomorphic-git|nodegit)['"]\)/, `${name} must not delegate to a Git engine`);
}
assert.doesNotMatch(fs.readFileSync(path.resolve(__dirname, '../../src/commands/canonical.js'), 'utf8'), /require\(['"](?:node:)?child_process['"]\)/);
const env = { ...process.env, PATH: '' };
assert.equal(spawnSync('git', ['--version'], { env }).error?.code, 'ENOENT');
const result = spawnSync(process.execPath, ['--test', path.join(__dirname, 'engine.test.js'), path.join(__dirname, 'cli.test.js')], { env, stdio: 'inherit' });
process.exitCode = result.status ?? 1;
