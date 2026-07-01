/**
 * Template Command - Quick-start from a baked-in starter.
 *
 *   gent template list                       → show available templates
 *   gent template use <name> [directory]     → scaffold a starter
 *
 * Templates are tiny inline definitions — no network needed. Keep them small
 * so the CLI bundle stays light.
 */

const fs = require('fs').promises;
const path = require('path');
const chalk = require('chalk');
const { pathExists, ensureDir } = require('../utils/fileSystem');
const initCommand = require('./init');

const TEMPLATES = {
    node: {
        description: 'Minimal Node.js project (package.json + index.js)',
        files: {
            'package.json': JSON.stringify({
                name: '__NAME__',
                version: '0.1.0',
                main: 'index.js',
                scripts: { start: 'node index.js' },
            }, null, 2) + '\n',
            'index.js': "console.log('hello from __NAME__');\n",
            '.gentignore': 'node_modules/\n.env\n',
            'README.md': '# __NAME__\n\nA Node.js project scaffolded with `gent template use node`.\n',
        },
    },
    python: {
        description: 'Minimal Python project (main.py + requirements.txt)',
        files: {
            'main.py': "def main():\n    print('hello from __NAME__')\n\nif __name__ == '__main__':\n    main()\n",
            'requirements.txt': '',
            '.gentignore': '__pycache__/\n.venv/\n*.pyc\n.env\n',
            'README.md': '# __NAME__\n\nA Python project scaffolded with `gent template use python`.\n',
        },
    },
    react: {
        description: 'Vite + React skeleton (vite-style index.html + src/main.jsx)',
        files: {
            'package.json': JSON.stringify({
                name: '__NAME__',
                version: '0.1.0',
                type: 'module',
                scripts: { dev: 'vite', build: 'vite build', preview: 'vite preview' },
                dependencies: { react: '^18.3.1', 'react-dom': '^18.3.1' },
                devDependencies: { vite: '^5.4.0', '@vitejs/plugin-react': '^4.3.1' },
            }, null, 2) + '\n',
            'index.html': '<!doctype html>\n<html><head><title>__NAME__</title></head>\n<body><div id="root"></div><script type="module" src="/src/main.jsx"></script></body></html>\n',
            'src/main.jsx': "import React from 'react';\nimport { createRoot } from 'react-dom/client';\ncreateRoot(document.getElementById('root')).render(<h1>__NAME__</h1>);\n",
            '.gentignore': 'node_modules/\ndist/\n.env\n',
            'README.md': '# __NAME__\n\nRun `npm install && npm run dev` to start.\n',
        },
    },
    'django-api': {
        description: 'Minimal Django project shell (manage.py + settings stub)',
        files: {
            'manage.py': "#!/usr/bin/env python\nimport os, sys\nif __name__ == '__main__':\n    os.environ.setdefault('DJANGO_SETTINGS_MODULE', '__NAME__.settings')\n    from django.core.management import execute_from_command_line\n    execute_from_command_line(sys.argv)\n",
            'requirements.txt': 'Django>=5.0\n',
            '.gentignore': '__pycache__/\n*.pyc\n.venv/\ndb.sqlite3\n.env\n',
            'README.md': '# __NAME__\n\nRun `python -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt`.\n',
        },
    },
};

async function template(subcommand, args = [], options = {}) {
    const sub = (subcommand || 'list').toLowerCase();
    switch (sub) {
        case 'list': return list();
        case 'use': return use(args[0], args[1], options);
        default:
            console.error(chalk.red(`Unknown subcommand '${sub}'`));
            console.log(chalk.gray('Usage: gent template <list|use>'));
            process.exit(1);
    }
}

function list() {
    console.log(chalk.bold.cyan('\nAvailable templates\n'));
    for (const [name, t] of Object.entries(TEMPLATES)) {
        console.log(`  ${chalk.cyan(name.padEnd(14))} ${chalk.gray(t.description)}`);
    }
    console.log(chalk.gray('\n  Usage: gent template use <name> [directory]\n'));
}

async function use(name, directory) {
    if (!name) {
        console.error(chalk.red('Usage: gent template use <name> [directory]'));
        process.exit(1);
    }
    const tpl = TEMPLATES[name];
    if (!tpl) {
        console.error(chalk.red(`Unknown template '${name}'`));
        console.log(chalk.gray(`Available: ${Object.keys(TEMPLATES).join(', ')}`));
        process.exit(1);
    }

    const targetDir = directory || name;
    const targetPath = path.resolve(process.cwd(), targetDir);
    const projectName = path.basename(targetPath).replace(/[^A-Za-z0-9_-]/g, '-');

    if (await pathExists(targetPath)) {
        const entries = await fs.readdir(targetPath);
        if (entries.length > 0) {
            console.error(chalk.red(`Directory '${targetDir}' is not empty.`));
            process.exit(1);
        }
    } else {
        await ensureDir(targetPath);
    }

    for (const [rel, content] of Object.entries(tpl.files)) {
        const filePath = path.join(targetPath, rel);
        await ensureDir(path.dirname(filePath));
        const body = content.replace(/__NAME__/g, projectName);
        await fs.writeFile(filePath, body, 'utf-8');
    }

    console.log(chalk.green(`✓ Scaffolded '${name}' into ${targetDir}/`));

    // Auto-init a gent repo so the next steps work
    const originalCwd = process.cwd();
    try {
        process.chdir(targetPath);
        await initCommand({});
    } finally {
        process.chdir(originalCwd);
    }
    console.log(chalk.gray('  Next: cd ' + targetDir + ' && gent add -A && gent commit -m "init"'));
}

module.exports = template;
