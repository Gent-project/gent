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
        // Auth
        LOGIN: '/api/auth/login/',
        REGISTER: '/api/auth/register/',
        LOGOUT: '/api/auth/logout/',
        REFRESH: '/api/auth/token/refresh/',
        PROFILE: '/api/auth/profile/',

        // Repository management
        REPOS: '/api/repos/',
        REPOS_CREATE: '/api/repos/create/',
        // Template: /api/repos/{owner_id}/{repo_name}/
        REPO_DETAIL: '/api/repos/{owner_id}/{repo_name}/',
        REPO_DELETE: '/api/repos/{owner_id}/{repo_name}/delete/',

        // Push
        REPO_PUSH: '/api/repos/{owner_id}/{repo_name}/push/',

        // Branches
        REPO_BRANCHES: '/api/repos/{owner_id}/{repo_name}/branches/',
        REPO_BRANCHES_CREATE: '/api/repos/{owner_id}/{repo_name}/branches/create/',
        REPO_BRANCH_DETAIL: '/api/repos/{owner_id}/{repo_name}/branches/{branch_name}/',

        // Tags
        REPO_TAGS: '/api/repos/{owner_id}/{repo_name}/tags/',
        REPO_TAGS_CREATE: '/api/repos/{owner_id}/{repo_name}/tags/create/',
        REPO_TAG_DETAIL: '/api/repos/{owner_id}/{repo_name}/tags/{tag_name}/',

        // Commits
        REPO_COMMITS: '/api/repos/{owner_id}/{repo_name}/commits/',
        REPO_COMMIT_DETAIL: '/api/repos/{owner_id}/{repo_name}/commits/{sha}/',

        // Objects (trees & blobs)
        REPO_TREE_CREATE: '/api/repos/{owner_id}/{repo_name}/tree/create/',
        REPO_TREE_DETAIL: '/api/repos/{owner_id}/{repo_name}/tree/{sha}/',
        REPO_BLOB_CREATE: '/api/repos/{owner_id}/{repo_name}/blob/create/',
        REPO_BLOB_DETAIL: '/api/repos/{owner_id}/{repo_name}/blob/{sha}/',
    },

    /**
     * Build a repo-scoped API path by replacing {owner_id} and {repo_name} tokens.
     * @param {string} template - Endpoint template from API_ENDPOINTS
     * @param {object} params - { owner_id, repo_name, branch_name?, tag_name?, sha? }
     * @returns {string}
     */
    buildRepoUrl(template, params) {
        let url = template;
        for (const [key, value] of Object.entries(params)) {
            url = url.replace(`{${key}}`, encodeURIComponent(value));
        }
        return url;
    },

    /**
     * Parse a remote URL like /api/repos/{owner_id}/{repo_name} into { owner_id, repo_name }.
     * @param {string} url - Remote URL stored in config
     * @returns {{ owner_id: string, repo_name: string } | null}
     */
    parseRemoteUrl(url) {
        const match = url.match(/\/api\/repos\/(\d+)\/([^/]+)\/?$/);
        if (!match) return null;
        return { owner_id: match[1], repo_name: match[2] };
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
