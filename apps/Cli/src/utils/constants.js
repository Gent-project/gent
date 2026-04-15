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
    AUTH_FILE: 'auth.json',

    // API Configuration
    API_BASE_URL: 'https://gent-api.onrender.com',
    API_ENDPOINTS: {
        LOGIN: '/api/auth/login/',
        REGISTER: '/api/auth/register/',
        LOGOUT: '/api/auth/logout/',
        REFRESH: '/api/auth/token/refresh/',
        PROFILE: '/api/auth/profile/',

        // Repository endpoints (used by push/pull/clone)
        // Base: /api/repos/:id/
        REPOS: '/api/repos/',
        REPO_PUSH: '/push/',       // POST - upload commits + objects
        REPO_PULL: '/pull/',       // GET  - download commits + objects since hash
        REPO_CLONE: '/clone/',     // GET  - full repo download
        REPO_REFS: '/refs/',       // GET  - list remote branch refs
        REPO_TAGS: '/tags/',       // GET/POST/DELETE - tag management
        REPO_MERGE: '/merge/',     // POST - server-side merge request
        REPO_COMMITS: '/commits/', // GET  - commit history
    },

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
