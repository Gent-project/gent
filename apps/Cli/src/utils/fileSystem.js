/**
 * File System Utilities
 * Helper functions for file system operations
 */

const fs = require('fs').promises;
const path = require('path');
const { GENT_DIR, DEFAULT_IGNORE_PATTERNS, IGNORE_FILE } = require('./constants');

const GIT_IGNORE_FILE = '.gitignore';

/**
 * Check if a path exists
 * @param {String} path - Path to check
 * @returns {Promise<Boolean>}
 */
async function pathExists(filePath) {
    try {
        await fs.access(filePath);
        return true;
    } catch {
        return false;
    }
}

/**
 * Ensure directory exists, create if not
 * @param {String} dir - Directory path
 */
async function ensureDir(dir) {
    try {
        await fs.mkdir(dir, { recursive: true });
    } catch (error) {
        if (error.code !== 'EEXIST') {
            throw error;
        }
    }
}

/**
 * Read JSON file
 * @param {String} filePath - Path to JSON file
 * @returns {Promise<Object>}
 */
async function readJSON(filePath) {
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content);
}

/**
 * Write JSON file
 * @param {String} filePath - Path to JSON file
 * @param {Object} data - Data to write
 */
async function writeJSON(filePath, data) {
    const content = JSON.stringify(data, null, 2);
    await fs.writeFile(filePath, content, 'utf-8');
}

/**
 * Get .gent directory path
 * @returns {Promise<String>}
 */
async function getGentPath() {
    const cwd = process.cwd();
    const gentPath = path.join(cwd, GENT_DIR);

    if (!await pathExists(gentPath)) {
        const error = new Error('Not a gent repository (or any of the parent directories): .gent not found');
        error.code = 'ENOENT';
        throw error;
    }

    return gentPath;
}

/**
 * Get all files in directory recursively
 * @param {String} dir - Directory to scan
 * @param {Array} ignorePatterns - Patterns to ignore
 * @returns {Promise<Array>}
 */
async function getAllFiles(dir, ignorePatterns = []) {
    const files = [];

    async function scan(currentDir) {
        const entries = await fs.readdir(currentDir, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = path.join(currentDir, entry.name);
            const relativePath = path.relative(dir, fullPath);

            // Check if should be ignored
            if (shouldIgnore(relativePath, ignorePatterns)) {
                continue;
            }

            if (entry.isDirectory()) {
                await scan(fullPath);
            } else {
                files.push(fullPath);
            }
        }
    }

    await scan(dir);
    return files;
}

/**
 * Check if path should be ignored
 * @param {String} filePath - File path to check
 * @param {Array} patterns - Ignore patterns
 * @returns {Boolean}
 */
function shouldIgnore(filePath, patterns) {
    const normalizedPath = filePath.replace(/\\/g, '/');

    for (const pattern of patterns) {
        const normalizedPattern = normalizeIgnorePattern(pattern);
        if (!normalizedPattern) {
            continue;
        }

        // Exact match
        if (normalizedPath === normalizedPattern || normalizedPath.startsWith(normalizedPattern + '/')) {
            return true;
        }

        // Basename match
        if (!normalizedPattern.includes('/') && !normalizedPattern.includes('*')) {
            const parts = normalizedPath.split('/');
            if (parts.includes(normalizedPattern)) {
                return true;
            }
        }

        // Wildcard match
        if (normalizedPattern.includes('*')) {
            const wildcardRegex = normalizedPattern.split('*').map(escapeRegex).join('.*');
            const regex = new RegExp('^' + wildcardRegex + '$');
            if (regex.test(normalizedPath) || regex.test(path.posix.basename(normalizedPath))) {
                return true;
            }
        }

        // Extension match
        if (normalizedPattern.startsWith('*.') && normalizedPath.endsWith(normalizedPattern.substring(1))) {
            return true;
        }
    }

    return false;
}

function normalizeIgnorePattern(pattern) {
    return pattern
        .replace(/\\/g, '/')
        .replace(/^\.\//, '')
        .replace(/^\/+/, '')
        .replace(/\/+$/, '');
}

function escapeRegex(pattern) {
    return pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
}

function parseIgnoreContent(content, basePath = '') {
    return content.split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#') && !line.startsWith('!'))
        .map(line => normalizeIgnorePattern(path.posix.join(basePath, line)))
        .filter(Boolean);
}

async function collectGitIgnorePatterns(rootDir, patterns) {
    async function scan(currentDir) {
        const entries = await fs.readdir(currentDir, { withFileTypes: true });
        const relativeDir = path.relative(rootDir, currentDir).replace(/\\/g, '/');
        const gitIgnore = entries.find(entry => entry.isFile() && entry.name === GIT_IGNORE_FILE);

        if (gitIgnore) {
            const ignorePath = path.join(currentDir, GIT_IGNORE_FILE);
            const content = await fs.readFile(ignorePath, 'utf-8');
            patterns.push(...parseIgnoreContent(content, relativeDir));
        }

        for (const entry of entries) {
            if (!entry.isDirectory()) {
                continue;
            }

            const fullPath = path.join(currentDir, entry.name);
            const relativePath = path.relative(rootDir, fullPath);
            if (shouldIgnore(relativePath, patterns)) {
                continue;
            }

            await scan(fullPath);
        }
    }

    await scan(rootDir);
}

/**
 * Get ignore patterns from .gentignore file
 * @param {String} dir - Directory to check
 * @returns {Promise<Array>}
 */
async function getIgnorePatterns(dir) {
    const patterns = [...DEFAULT_IGNORE_PATTERNS];
    const ignorePath = path.join(dir, IGNORE_FILE);

    if (await pathExists(ignorePath)) {
        const content = await fs.readFile(ignorePath, 'utf-8');
        patterns.push(...parseIgnoreContent(content));
    }

    await collectGitIgnorePatterns(dir, patterns);

    return patterns;
}

/**
 * Get tracked files from a commit
 * @param {String} gentPath - Path to .gent directory
 * @param {String} commitHash - Commit hash
 * @returns {Promise<Array>}
 */
async function getTrackedFiles(gentPath, commitHash) {
    if (!commitHash) {
        return [];
    }

    const repository = await readJSON(path.join(gentPath, 'commits.json'));
    const commit = repository.commits.find(c => c.hash === commitHash);

    return commit ? commit.files : [];
}

module.exports = {
    pathExists,
    ensureDir,
    readJSON,
    writeJSON,
    getGentPath,
    getAllFiles,
    shouldIgnore,
    getIgnorePatterns,
    getTrackedFiles
};
