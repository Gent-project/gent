/**
 * Register Command - Create a new user account
 * Handles user registration with email and password
 */

const chalk = require('chalk');
const inquirer = require('inquirer');
const ora = require('ora');
const boxen = require('boxen');
const authService = require('../services/auth-service');

/**
 * Register a new user
 * @param {Object} options - Command options
 */
async function register(options) {
    console.log(chalk.cyan('\n🚀 Create your Gent account\n'));

    try {
        let email = options.email;
        let password = options.password;
        let passwordConfirm = options.passwordConfirm;
        let firstName = options.firstName;
        let lastName = options.lastName;

        // Prompt for user information
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
                mask: '*',
                when: !password,
                validate: (input) => {
                    if (input.length < 8) {
                        return 'Password must be at least 8 characters long';
                    }
                    return true;
                }
            },
            {
                type: 'password',
                name: 'passwordConfirm',
                message: 'Confirm password:',
                mask: '*',
                when: !passwordConfirm,
                validate: (input, answers) => {
                    return input === (password || answers.password) || 'Passwords do not match';
                }
            },
            {
                type: 'input',
                name: 'firstName',
                message: 'First name:',
                when: firstName === undefined,
                default: ''
            },
            {
                type: 'input',
                name: 'lastName',
                message: 'Last name:',
                when: lastName === undefined,
                default: ''
            }
        ]);

        email = email || answers.email;
        password = password || answers.password;
        passwordConfirm = passwordConfirm || answers.passwordConfirm;
        firstName = firstName !== undefined ? firstName : answers.firstName;
        lastName = lastName !== undefined ? lastName : answers.lastName;

        if (!email || !password || !passwordConfirm) {
            throw new Error('Email, password, and password confirmation are required');
        }

        const spinner = ora('Creating your account...').start();

        // Register user
        const user = await authService.register(
            email,
            password,
            passwordConfirm,
            firstName || '',
            lastName || ''
        );

        spinner.succeed(chalk.green('✓ Account created successfully!'));

        // Display success message
        const message = chalk.white(`
${chalk.bold('Welcome to Gent!')}

${chalk.bold('Email:')} ${user.email}
${chalk.bold('Name:')} ${user.first_name || ''} ${user.last_name || ''}
${chalk.bold('Account created:')} ${new Date(user.date_joined).toLocaleDateString()}

${chalk.cyan('You are now logged in!')}

${chalk.bold('Next steps:')}
  ${chalk.gray('•')} gent init           - Initialize a repository
  ${chalk.gray('•')} gent whoami         - View your profile
  ${chalk.gray('•')} gent help          - See all commands
        `);

        console.log(boxen(message, {
            padding: 1,
            margin: 1,
            borderStyle: 'round',
            borderColor: 'green'
        }));

    } catch (error) {
        console.error(chalk.red('\n✗ Registration failed'));
        console.error(chalk.red(`Error: ${error.message}\n`));
        process.exit(1);
    }
}

module.exports = register;
