/**
 * Login Command - Authenticate user
 * Handles user login with email and password
 */

const chalk = require('chalk');
const inquirer = require('inquirer');
const ora = require('ora');
const boxen = require('boxen');
const authService = require('../services/auth-service');

/**
 * Login user
 * @param {Object} options - Command options
 */
async function login(options) {
    console.log(chalk.cyan('\n🔐 Login to your Gent account\n'));

    try {
        let email = options.email;
        let password = options.password;

        // If credentials not provided via flags, prompt for them
        if (!email || !password) {
            const answers = await inquirer.prompt([
                {
                    type: 'input',
                    name: 'email',
                    message: 'Email address:',
                    when: !email,
                    validate: (input) => {
                        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                        return emailRegex.test(input) || 'Please enter a valid email address';
                    }
                },
                {
                    type: 'password',
                    name: 'password',
                    message: 'Password:',
                    when: !password,
                    mask: '*'
                }
            ]);

            email = email || answers.email;
            password = password || answers.password;
        }

        const spinner = ora('Logging in...').start();

        // Login user
        const user = await authService.login(email, password);

        spinner.succeed(chalk.green('✓ Login successful!'));

        // Display welcome message
        const message = chalk.white(`
${chalk.bold('Welcome back!')}

${chalk.bold('Email:')} ${user.email}
${chalk.bold('Name:')} ${user.first_name || ''} ${user.last_name || ''}

${chalk.cyan('You are now logged in!')}

${chalk.bold('Commands:')}
  ${chalk.gray('•')} gent whoami         - View your profile
  ${chalk.gray('•')} gent init           - Initialize a repository
  ${chalk.gray('•')} gent help          - See all commands
        `);

        console.log(boxen(message, {
            padding: 1,
            margin: 1,
            borderStyle: 'round',
            borderColor: 'cyan'
        }));

    } catch (error) {
        console.error(chalk.red('\n✗ Login failed'));
        console.error(chalk.red(`Error: ${error.message}\n`));
        process.exit(1);
    }
}

module.exports = login;
