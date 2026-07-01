/**
 * Whoami Command - Display current user information
 * Shows authenticated user profile
 */

const chalk = require('chalk');
const boxen = require('boxen');
const ora = require('ora');
const { formatDistanceToNow } = require('date-fns');
const authStorage = require('../utils/auth-storage');
const authService = require('../services/auth-service');

/**
 * Display current user information
 * @param {Object} options - Command options
 */
async function whoami(options) {
    try {
        // Check if user is authenticated
        const isAuth = await authStorage.isAuthenticated();

        if (!isAuth) {
            console.log(chalk.yellow('\nℹ You are not logged in'));
            console.log(chalk.gray('Use "gent login" or "gent register" to authenticate\n'));
            return;
        }

        const spinner = ora('Fetching user profile...').start();

        // Get user profile from API (this will also test token validity)
        const user = await authService.getProfile();

        spinner.stop();

        // Format date
        const joinedDate = new Date(user.date_joined);
        const joinedAgo = formatDistanceToNow(joinedDate, { addSuffix: true });

        // Display user information
        const message = chalk.white(`
${chalk.bold.cyan('👤 User Profile')}

${chalk.bold('Email:')} ${user.email}
${chalk.bold('Name:')} ${user.first_name || 'N/A'} ${user.last_name || ''}
${chalk.bold('Account ID:')} ${user.id}
${chalk.bold('Joined:')} ${joinedDate.toLocaleDateString()} ${chalk.gray(`(${joinedAgo})`)}
${chalk.bold('Status:')} ${user.is_active ? chalk.green('Active') : chalk.red('Inactive')}
        `);

        console.log(boxen(message, {
            padding: 1,
            margin: 1,
            borderStyle: 'round',
            borderColor: 'cyan'
        }));

    } catch (error) {
        console.error(chalk.red('\n✗ Failed to fetch user profile'));
        console.error(chalk.red(`Error: ${error.message}\n`));

        if (error.message.includes('login')) {
            console.log(chalk.gray('Use "gent login" to authenticate\n'));
        }

        process.exit(1);
    }
}

module.exports = whoami;
