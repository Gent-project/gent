/**
 * Password Command - Change or reset your account password.
 *
 * USAGE:
 *   gent password change             → change password (prompts current + new)
 *   gent password reset [email]      → email yourself a reset link
 *   gent password reset-confirm      → finish a reset with uid + token from the email
 *
 * BACKEND:
 *   POST /api/auth/password/change/          { current_password, new_password, new_password_confirm }
 *   POST /api/auth/password/reset/           { email }
 *   POST /api/auth/password/reset/confirm/   { uid, token, new_password, new_password_confirm }
 *
 * Note: changing/resetting the password blacklists all refresh tokens, so
 * `change` re-logs you in with the new password to keep the session alive.
 */

const chalk = require('chalk');
const inquirer = require('inquirer');
const ora = require('ora');
const { API_ENDPOINTS } = require('../utils/constants');
const apiClient = require('../utils/api-client');
const authStorage = require('../utils/auth-storage');
const authService = require('../services/auth-service');

async function password(action, options = {}) {
    try {
        const act = action || 'change';
        if (act === 'change') {
            await changePassword();
        } else if (act === 'reset') {
            await requestReset(options);
        } else if (act === 'reset-confirm') {
            await confirmReset();
        } else {
            console.error(chalk.red(`Unknown action '${action}'`));
            console.log(chalk.yellow('Usage: gent password [change | reset [email] | reset-confirm]'));
        }
    } catch (error) {
        handleError(error);
    }
}

async function changePassword() {
    if (!(await authStorage.isAuthenticated())) {
        console.error(chalk.red('Not authenticated'));
        console.log(chalk.yellow('Run "gent login" first'));
        return;
    }
    const user = await authStorage.getUser();

    const answers = await inquirer.prompt([
        { type: 'password', name: 'current', message: 'Current password:', mask: '*' },
        {
            type: 'password', name: 'next', message: 'New password:', mask: '*',
            validate: (v) => v.length >= 8 || 'Password must be at least 8 characters long'
        },
        {
            type: 'password', name: 'confirm', message: 'Confirm new password:', mask: '*',
            validate: (v, a) => v === a.next || 'Passwords do not match'
        },
    ]);

    const spinner = ora('Changing password...').start();
    await apiClient.post(API_ENDPOINTS.PASSWORD_CHANGE, {
        current_password: answers.current,
        new_password: answers.next,
        new_password_confirm: answers.confirm,
    });

    // The backend blacklisted our refresh token; re-login to refresh the session.
    try {
        if (user?.email) await authService.login(user.email, answers.next);
        spinner.succeed(chalk.green('Password changed'));
    } catch {
        await authStorage.clearAuth();
        spinner.succeed(chalk.green('Password changed'));
        console.log(chalk.yellow('Please run "gent login" again with your new password.'));
    }
}

async function requestReset(options) {
    let email = options.email;
    if (!email) {
        ({ email } = await inquirer.prompt([{ type: 'input', name: 'email', message: 'Account email:' }]));
    }

    const spinner = ora('Requesting password reset...').start();
    const res = await apiClient.post(API_ENDPOINTS.PASSWORD_RESET, { email });
    spinner.succeed(chalk.green(res.message || 'If that account exists, a reset link has been sent.'));
    console.log(chalk.gray('Open the link in your email, then run "gent password reset-confirm".'));
}

async function confirmReset() {
    const a = await inquirer.prompt([
        { type: 'input', name: 'uid', message: 'uid (from reset link):' },
        { type: 'input', name: 'token', message: 'token (from reset link):' },
        {
            type: 'password', name: 'next', message: 'New password:', mask: '*',
            validate: (v) => v.length >= 8 || 'Password must be at least 8 characters long'
        },
        {
            type: 'password', name: 'confirm', message: 'Confirm new password:', mask: '*',
            validate: (v, ans) => v === ans.next || 'Passwords do not match'
        },
    ]);

    const spinner = ora('Resetting password...').start();
    const res = await apiClient.post(API_ENDPOINTS.PASSWORD_RESET_CONFIRM, {
        uid: a.uid,
        token: a.token,
        new_password: a.next,
        new_password_confirm: a.confirm,
    });
    spinner.succeed(chalk.green(res.message || 'Password reset successfully'));
    console.log(chalk.gray('Run "gent login" with your new password.'));
}

function handleError(error) {
    const data = error.response?.data;
    if (error.response?.status === 401 && data?.current_password) {
        console.error(chalk.red('Current password is incorrect'));
    } else if (data) {
        // DRF returns { field: [messages] } or { error/detail: message }.
        const msg = data.error || data.detail
            || (typeof data === 'object' ? Object.values(data).flat().join(', ') : data);
        console.error(chalk.red(msg || 'Request failed'));
    } else {
        console.error(chalk.red('Error:'), error.message);
    }
    process.exit(1);
}

module.exports = password;
