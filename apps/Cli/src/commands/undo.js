/**
 * ============================================================================
 * Undo / Redo Commands - One-command safety net over the operation journal
 * ============================================================================
 *
 * PURPOSE:
 *   Reverse (or re-apply) the last history-changing operation without having to
 *   reason about reflogs and commit hashes.
 *
 * USAGE:
 *   gent undo            → Reverse the last operation
 *   gent undo --list     → Show the operation history (most recent first)
 *   gent redo            → Re-apply the last undone operation
 *
 * See src/utils/journal.js for the recorded state and exact undo semantics
 * (working files are never deleted).
 *
 * ============================================================================
 */

const chalk = require('chalk');
const { formatDistanceToNow } = require('date-fns');
const { getGentPath } = require('../utils/fileSystem');
const journal = require('../utils/journal');

function shortHash(h) {
    return h ? h.substring(0, 7) : '(none)';
}

function notARepo(error) {
    return error.code === 'ENOENT' && error.message.includes('.gent');
}

/**
 * `gent undo` — reverse the last operation, or list history with --list.
 * @param {Object} options
 */
async function undo(options = {}) {
    try {
        const gentPath = await getGentPath();
        const cwd = process.cwd();

        if (options.list) {
            await printHistory(gentPath);
            return;
        }

        const result = await journal.applyUndo(gentPath, cwd);
        if (!result.ok) {
            console.log(chalk.yellow('Nothing to undo'));
            console.log(chalk.gray('History-changing operations (commit, merge, reset, checkout) can be undone.'));
            return;
        }

        const { entry } = result;
        console.log(chalk.green(`✓ Undid ${chalk.bold(entry.op)}: ${entry.description}`));
        console.log(chalk.gray(`  Now on '${result.branch}' at ${shortHash(result.head)}`));
        console.log(chalk.cyan('  Run "gent redo" to re-apply.'));
    } catch (error) {
        if (notARepo(error)) {
            console.error(chalk.red('Error: Not a gent repository'));
            console.log(chalk.yellow('\nRun "gent init" to initialize a repository'));
        } else {
            console.error(chalk.red('Error:'), error.message);
        }
        process.exit(1);
    }
}

/**
 * `gent redo` — re-apply the last undone operation.
 */
async function redo() {
    try {
        const gentPath = await getGentPath();
        const cwd = process.cwd();

        const result = await journal.applyRedo(gentPath, cwd);
        if (!result.ok) {
            console.log(chalk.yellow('Nothing to redo'));
            return;
        }

        const { entry } = result;
        console.log(chalk.green(`✓ Redid ${chalk.bold(entry.op)}: ${entry.description}`));
        console.log(chalk.gray(`  Now on '${result.branch}' at ${shortHash(result.head)}`));
    } catch (error) {
        if (notARepo(error)) {
            console.error(chalk.red('Error: Not a gent repository'));
            console.log(chalk.yellow('\nRun "gent init" to initialize a repository'));
        } else {
            console.error(chalk.red('Error:'), error.message);
        }
        process.exit(1);
    }
}

async function printHistory(gentPath) {
    const entries = await journal.listEntries(gentPath);
    if (entries.length === 0) {
        console.log(chalk.yellow('No operations recorded yet'));
        return;
    }

    console.log(chalk.bold.cyan('\nOperation history (most recent first):\n'));
    entries.forEach((e, i) => {
        const when = chalk.gray(`(${formatDistanceToNow(new Date(e.timestamp), { addSuffix: true })})`);
        const marker = i === 0 ? chalk.yellow('● ') : chalk.gray('○ ');
        console.log(`${marker}${chalk.bold(e.op.padEnd(14))} ${e.description} ${when}`);
    });
    console.log(chalk.gray('\n"gent undo" reverses the most recent (●).'));
}

module.exports = undo;
module.exports.redo = redo;
