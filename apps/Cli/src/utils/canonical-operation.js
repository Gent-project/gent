const fs = require('fs').promises;
const path = require('path');

const repository = require('./repository');
const journal = require('./canonical-journal');
const worktree = require('./worktree');
const { Lock } = require('./lockfile');

async function assertNoInterruptedMigration(startDir) {
    for (let dir = path.resolve(startDir || process.cwd()); ; dir = path.dirname(dir)) {
        if (await fs.access(path.join(dir, '.gent-migration.json')).then(() => true, () => false)) {
            throw new Error('interrupted migration; use gent migrate --continue or --abort');
        }
        if (path.dirname(dir) === dir) return;
    }
}

/**
 * Shared canonical operation boundary. Callers own argument validation and
 * presentation; this function owns repository validation, recovery guards,
 * locking and the existing journal lifecycle.
 */
async function executeCanonicalOperation(options, operation) {
    const name = options.name;
    const startDir = options.startDir || process.cwd();
    await assertNoInterruptedMigration(startDir);
    const repo = options.repo || await repository.open(startDir);
    let lock;
    let checkpoint;
    try {
        if (!options.readOnly) {
            lock = await Lock.acquire(path.join(repo.gentWorktreeMetaDir, 'operation'));
            await repo.assertNoExternalOperation(options.displayName || `gent ${name}`);
            await require('./gent-ops').recoverBranchRename(repo);
            if (!options.allowPendingCheckout) {
                await worktree.assertNoPendingCheckout(repo, options.displayName || `gent ${name}`);
            }
        }
        if (options.checkpoint) checkpoint = await journal.begin(repo, name);
        const result = await operation(repo);
        if (checkpoint) await journal.finish(repo, checkpoint);
        return result;
    } finally {
        if (lock) await lock.release();
    }
}

module.exports = { assertNoInterruptedMigration, executeCanonicalOperation };
