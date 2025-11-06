#!/usr/bin/env node

/**
 * Gent CLI - Command Summary
 * Quick reference for all available commands
 */

const chalk = require('chalk');
const boxen = require('boxen');

const commands = [
    {
        name: 'init',
        description: 'Initialize a new gent repository',
        usage: 'gent init [options]',
        options: ['-y, --yes  Skip prompts and use defaults'],
        examples: ['gent init', 'gent init -y']
    },
    {
        name: 'status',
        description: 'Show the working tree status',
        usage: 'gent status [options]',
        options: ['-s, --short  Give output in short format'],
        examples: ['gent status', 'gent status -s']
    },
    {
        name: 'add',
        description: 'Add file contents to the staging area',
        usage: 'gent add <files...> [options]',
        options: ['-A, --all  Add all files'],
        examples: ['gent add file.js', 'gent add .', 'gent add --all']
    },
    {
        name: 'commit',
        description: 'Record changes to the repository',
        usage: 'gent commit [options]',
        options: [
            '-m, --message <message>  Commit message',
            '-a, --all               Auto stage modified files'
        ],
        examples: ['gent commit -m "Fix bug"', 'gent commit', 'gent commit -a -m "Update all"']
    },
    {
        name: 'log',
        description: 'Show commit logs',
        usage: 'gent log [options]',
        options: [
            '-n, --number <count>  Limit commits (default: 10)',
            '--oneline             Show each commit on one line'
        ],
        examples: ['gent log', 'gent log -n 5', 'gent log --oneline']
    },
    {
        name: 'branch',
        description: 'List, create, or delete branches',
        usage: 'gent branch [name] [options]',
        options: [
            '-d, --delete <name>  Delete a branch',
            '-a, --all            List all branches'
        ],
        examples: ['gent branch', 'gent branch feature-x', 'gent branch -d old-feature']
    },
    {
        name: 'checkout',
        description: 'Switch branches',
        usage: 'gent checkout <branch> [options]',
        options: ['-b, --create  Create a new branch'],
        examples: ['gent checkout main', 'gent checkout -b new-feature']
    }
];

console.log(chalk.bold.cyan('\n🚀 Gent CLI - Command Reference\n'));

commands.forEach((cmd, index) => {
    console.log(chalk.yellow.bold(`${index + 1}. ${cmd.name.toUpperCase()}`));
    console.log(chalk.white(`   ${cmd.description}`));
    console.log(chalk.gray(`   Usage: ${cmd.usage}`));

    if (cmd.options.length > 0) {
        console.log(chalk.gray('   Options:'));
        cmd.options.forEach(opt => {
            console.log(chalk.gray(`     ${opt}`));
        });
    }

    console.log(chalk.cyan('   Examples:'));
    cmd.examples.forEach(ex => {
        console.log(chalk.green(`     $ ${ex}`));
    });

    console.log();
});

const tips = `
${chalk.bold('💡 Quick Tips:')}

${chalk.cyan('•')} Always run ${chalk.yellow('gent init')} first in a new project
${chalk.cyan('•')} Use ${chalk.yellow('gent status')} to see what changed
${chalk.cyan('•')} Stage files with ${chalk.yellow('gent add')} before committing
${chalk.cyan('•')} Create branches for new features
${chalk.cyan('•')} Check ${chalk.yellow('gent log')} to view history

${chalk.bold('📚 Documentation:')}
${chalk.gray('• README.md     - Complete documentation')}
${chalk.gray('• QUICKSTART.md - Quick start guide')}
${chalk.gray('• demo.sh       - Interactive demo')}
`;

console.log(boxen(tips, {
    padding: 1,
    margin: 1,
    borderStyle: 'round',
    borderColor: 'cyan'
}));

console.log(chalk.gray('Run'), chalk.yellow('gent --help'), chalk.gray('for more information\n'));
