/**
 * Logout Command - End user session
 * Handles user logout and clearing authentication data
 */

const chalk = require('chalk');
const ora = require('ora');
const authService = require('../services/auth-service');
const authStorage = require('../utils/auth-storage');

/**
 * Logout user
 * @param {Object} options - Command options
 */
async function logout(options) {
    try {
        // Check if user is authenticated
        const isAuth = await authStorage.isAuthenticated();

        if (!isAuth) {
            console.log(chalk.yellow('\nℹ You are not logged in\n'));
            return;
        }

        const spinner = ora('Logging out...').start();

        // Logout user (calls API and clears local storage)
        await authService.logout();

        spinner.succeed(chalk.green('✓ Logged out successfully!'));
        console.log(chalk.gray('Your session has been ended.\n'));

    } catch (error) {
        console.error(chalk.red('\n✗ Logout failed'));
        console.error(chalk.red(`Error: ${error.message}\n`));
        process.exit(1);
    }
}

module.exports = logout;
