/**
 * Constants - Application-wide constants
 * Defines paths, patterns, and configuration values
 */

module.exports = {
    // Directory and file names
    GENT_DIR: '.gent',
    CONFIG_FILE: 'config.json',
    STAGING_FILE: 'staging.json',
    COMMITS_FILE: 'commits.json',
    HEAD_FILE: 'HEAD',

    // Default ignore patterns
    DEFAULT_IGNORE_PATTERNS: [
        '.gent',
        'node_modules',
        '.git',
        '.DS_Store',
        '*.log',
        '.env',
        '.env.local',
        'dist',
        'build',
        'coverage',
        '.vscode',
        '.idea'
    ],

    // Regex patterns
    IGNORE_FILE: '.gentignore',

    // Colors (for consistency)
    COLORS: {
        SUCCESS: 'green',
        ERROR: 'red',
        WARNING: 'yellow',
        INFO: 'cyan',
        MUTED: 'gray'
    }
};
