/** Interactive, repository-aware Gent AI chat. */

const chalk = require('chalk');
const inquirer = require('inquirer');
const ora = require('ora');
const { getGentPath } = require('../utils/fileSystem');
const ai = require('../utils/ai-service');
const { buildRepoContext } = require('./ask');

const MAX_HISTORY_CHARS = 12000;

async function chat(initialMessage) {
    try {
        await ai.prime();
        if (!ai.isEnabled()) {
            console.error(chalk.red(ai.disabledHint()));
            process.exitCode = 1;
            return;
        }

        const gentPath = await getGentPath();
        const context = await buildRepoContext(gentPath);
        const history = [];

        if (initialMessage && initialMessage.trim()) {
            await reply(initialMessage.trim(), context, history);
            return;
        }
        if (!process.stdin.isTTY || !process.stdout.isTTY) {
            console.error(chalk.red('Usage: gent chat "<message>"'));
            process.exitCode = 1;
            return;
        }

        console.log(chalk.bold.cyan(`\nGent AI chat (${ai.getModel()})`));
        console.log(chalk.gray('Type exit or quit to finish.\n'));
        while (true) {
            const { message } = await inquirer.prompt([{
                type: 'input',
                name: 'message',
                message: 'You:',
            }]);
            const text = message.trim();
            if (!text) continue;
            if (/^(exit|quit)$/i.test(text)) break;
            await reply(text, context, history);
        }
    } catch (error) {
        console.error(chalk.red('Chat failed:'), error.message);
        process.exitCode = 1;
    }
}

async function reply(message, context, history) {
    const previous = history
        .map(turn => `User: ${turn.user}\nAssistant: ${turn.assistant}`)
        .join('\n\n')
        .slice(-MAX_HISTORY_CHARS);
    const spinner = ora('Thinking...').start();
    try {
        const answer = await ai.complete({
            profile: 'chat',
            prompt:
                `Repository context:\n${context}\n\n` +
                (previous ? `Conversation:\n${previous}\n\n` : '') +
                `User: ${message}`,
            maxTokens: 700,
        });
        spinner.stop();
        console.log(chalk.cyan('Gent AI: ') + answer + '\n');
        history.push({ user: message, assistant: answer });
        while (JSON.stringify(history).length > MAX_HISTORY_CHARS && history.length > 1) {
            history.shift();
        }
    } catch (error) {
        spinner.fail(chalk.red(error.message));
    }
}

module.exports = chat;
