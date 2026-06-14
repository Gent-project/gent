/**
 * Docs Command - AI-generate a README for the current repo.
 *
 *   gent docs                  → print suggested README to stdout
 *   gent docs --write          → write to README.md (prompt before overwrite)
 *   gent docs --section <name> → only regenerate a section (Usage, Install, ...)
 *
 * Builds context from: repository name/desc, file tree, key files (package.json,
 * pyproject.toml, etc.), and a sample of source files.
 */

const path = require('path');
const fs = require('fs').promises;
const chalk = require('chalk');
const ora = require('ora');
const inquirer = require('inquirer');
const { getGentPath, readJSON, pathExists } = require('../utils/fileSystem');
const { CONFIG_FILE } = require('../utils/constants');
const ai = require('../utils/ai-service');

const KEY_FILES = [
    'package.json', 'pyproject.toml', 'Cargo.toml', 'go.mod',
    'requirements.txt', 'Gemfile', 'composer.json', 'pom.xml',
];

const MAX_CONTEXT_CHARS = 16000;

async function docs(options = {}) {
    try {
        const cwd = process.cwd();
        const gentPath = await getGentPath();

        if (!ai.isEnabled()) {
            console.error(chalk.red('AI is required for `gent docs`.'));
            console.log(chalk.yellow(ai.disabledHint()));
            process.exit(1);
        }

        const context = await buildDocsContext(gentPath, cwd);
        const target = options.section
            ? `Generate ONLY the "${options.section}" section of a README.md.`
            : 'Generate a complete, polished README.md.';

        const spinner = ora(`Drafting README with ${ai.getModel()}...`).start();
        let draft;
        try {
            draft = await ai.complete({
                system:
                    'You write clear, accurate, well-formatted README.md files. ' +
                    'Use plain GitHub-flavored Markdown. Do not invent features that are not ' +
                    'in the provided context. Prefer short paragraphs and concrete examples.',
                prompt:
                    `${target}\n\nProject context:\n\n${context}\n\n` +
                    'Output: ONLY the Markdown. No preamble, no code fences around the whole document.',
                maxTokens: 2500,
            });
        } catch (err) {
            spinner.fail(chalk.red(err.message));
            process.exit(1);
        }
        spinner.stop();

        if (!options.write) {
            console.log(draft);
            console.log(chalk.gray('\n(use --write to save to README.md)\n'));
            return;
        }

        const target_path = path.join(cwd, 'README.md');
        if (await pathExists(target_path)) {
            const { ok } = await inquirer.prompt([{
                type: 'confirm',
                name: 'ok',
                message: `Overwrite existing README.md?`,
                default: false,
            }]);
            if (!ok) {
                console.log(chalk.yellow('Aborted — nothing written.'));
                return;
            }
        }
        await fs.writeFile(target_path, draft + '\n', 'utf-8');
        console.log(chalk.green(`✓ Wrote ${path.relative(cwd, target_path)}`));
    } catch (error) {
        if (error.code === 'ENOENT' && error.message.includes('.gent')) {
            console.error(chalk.red('Error: Not a gent repository'));
        } else {
            console.error(chalk.red('Error:'), error.message);
        }
        process.exit(1);
    }
}

async function buildDocsContext(gentPath, cwd) {
    const parts = [];

    try {
        const config = await readJSON(path.join(gentPath, CONFIG_FILE));
        const r = config.repository || {};
        parts.push(`# Project metadata\nname: ${r.name || ''}\ndescription: ${r.description || ''}`);
    } catch { /* fine */ }

    // Top-level layout
    try {
        const entries = await fs.readdir(cwd, { withFileTypes: true });
        const layout = entries
            .filter(e => !e.name.startsWith('.') && e.name !== 'node_modules')
            .map(e => e.isDirectory() ? `${e.name}/` : e.name);
        parts.push(`# Top-level layout\n${layout.join('\n')}`);
    } catch { /* fine */ }

    // Key manifest files
    for (const f of KEY_FILES) {
        const p = path.join(cwd, f);
        if (await pathExists(p)) {
            try {
                const text = await fs.readFile(p, 'utf-8');
                parts.push(`# ${f}\n${text.slice(0, 2000)}`);
            } catch { /* fine */ }
        }
    }

    // Existing README (so the model can preserve voice if user wants to refresh)
    for (const c of ['README.md', 'readme.md']) {
        const p = path.join(cwd, c);
        if (await pathExists(p)) {
            try {
                const text = await fs.readFile(p, 'utf-8');
                parts.push(`# Existing ${c}\n${text.slice(0, 3000)}`);
                break;
            } catch { /* fine */ }
        }
    }

    const joined = parts.join('\n\n');
    return joined.length > MAX_CONTEXT_CHARS
        ? joined.slice(0, MAX_CONTEXT_CHARS) + '\n... (context truncated)'
        : joined;
}

module.exports = docs;
