/**
 * Helper Utilities
 * General helper functions for the application
 */

const crypto = require('crypto');
const fs = require('fs').promises;

/**
 * Generate a unique commit hash
 * @returns {String} - SHA-256 hash
 */
function generateCommitHash() {
    const timestamp = Date.now();
    const random = Math.random().toString(36);
    const data = `${timestamp}-${random}`;

    return crypto
        .createHash('sha256')
        .update(data)
        .digest('hex');
}

/**
 * Generate hash for a file
 * @param {String} filePath - Path to file
 * @returns {Promise<String>} - SHA-256 hash of file content
 */
async function getFileHash(filePath) {
    try {
        const content = await fs.readFile(filePath);
        return crypto
            .createHash('sha256')
            .update(content)
            .digest('hex');
    } catch (error) {
        throw new Error(`Failed to hash file ${filePath}: ${error.message}`);
    }
}

/**
 * Format bytes to human-readable size
 * @param {Number} bytes - Size in bytes
 * @returns {String}
 */
function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Truncate string to specified length
 * @param {String} str - String to truncate
 * @param {Number} length - Maximum length
 * @returns {String}
 */
function truncate(str, length = 50) {
    if (str.length <= length) return str;
    return str.substring(0, length - 3) + '...';
}

/**
 * Get short commit hash (7 characters)
 * @param {String} hash - Full commit hash
 * @returns {String}
 */
function shortHash(hash) {
    return hash ? hash.substring(0, 7) : '';
}

/**
 * Validate email format
 * @param {String} email - Email to validate
 * @returns {Boolean}
 */
function isValidEmail(email) {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
}

/**
 * Parse command line arguments
 * @param {Array} args - Arguments array
 * @returns {Object}
 */
function parseArgs(args) {
    const parsed = {
        flags: {},
        args: []
    };

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];

        if (arg.startsWith('--')) {
            const key = arg.substring(2);
            const nextArg = args[i + 1];

            if (nextArg && !nextArg.startsWith('-')) {
                parsed.flags[key] = nextArg;
                i++;
            } else {
                parsed.flags[key] = true;
            }
        } else if (arg.startsWith('-')) {
            const key = arg.substring(1);
            parsed.flags[key] = true;
        } else {
            parsed.args.push(arg);
        }
    }

    return parsed;
}

module.exports = {
    generateCommitHash,
    getFileHash,
    formatBytes,
    truncate,
    shortHash,
    isValidEmail,
    parseArgs,
    getAllFiles: require('./fileSystem').getAllFiles
};
