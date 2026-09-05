/**
 * ============================================================================
 * Ignore - gitignore pattern matching
 * ============================================================================
 *
 * PURPOSE:
 *   Decide which untracked paths Gent hides, using exactly Git's rules so the
 *   two agree. Replaces the v12 hidden built-in list, which excluded things
 *   like .gitignore itself and could never be overridden.
 *
 * SOURCES, lowest precedence first:
 *   core.excludesFile  →  <gitdir>/info/exclude  →  .gitignore files from the
 *   worktree root down to the file's own directory (deeper wins).
 *   Within one file, the last matching pattern wins.
 *
 * SYNTAX:
 *   blank lines and '#' comments; '!' negation; trailing '/' for directories
 *   only; a '/' anywhere but the end anchors the pattern to the file's
 *   directory; '*' and '?' stop at '/'; '**' spans separators; '[a-z]'
 *   character classes; backslash escapes.
 *
 * THE ONE RULE PEOPLE FORGET:
 *   A file inside an excluded directory cannot be re-included. isIgnored()
 *   therefore tests every ancestor directory before the path itself.
 *
 * SCOPE:
 *   Ignore rules govern *untracked* discovery only. A tracked file's changes
 *   are always reported, whatever the patterns say.
 * ============================================================================
 */

const fs = require('fs').promises;
const path = require('path');

const { readFileOrNull, } = require('./lockfile');
const { expandTilde } = require('./git-config');

/**
 * One parsed pattern line.
 */
class IgnorePattern {
    /**
     * @param {String} line - already stripped of its trailing newline
     * @param {String} base - POSIX directory the pattern is relative to ('' = root)
     */
    constructor(line, base) {
        this.source = line;
        this.base = base;
        this.negated = false;
        this.directoryOnly = false;

        let pattern = line;
        if (pattern.startsWith('!')) {
            this.negated = true;
            pattern = pattern.slice(1);
        } else if (pattern.startsWith('\\!')) {
            pattern = pattern.slice(1);
        }

        if (pattern.endsWith('/')) {
            this.directoryOnly = true;
            pattern = pattern.slice(0, -1);
        }

        // A '/' anywhere except the very end anchors the pattern to `base`.
        const withoutLeading = pattern.startsWith('/') ? pattern.slice(1) : pattern;
        this.anchored = pattern.includes('/');
        this.pattern = withoutLeading;
        this.regex = compile(withoutLeading, this.anchored);
    }

    /**
     * @param {String} relativePath - POSIX, relative to the worktree root
     * @param {Boolean} isDirectory
     * @returns {Boolean}
     */
    matches(relativePath, isDirectory) {
        if (this.directoryOnly && !isDirectory) return false;

        let subject = relativePath;
        if (this.base) {
            if (!relativePath.startsWith(this.base + '/')) return false;
            subject = relativePath.slice(this.base.length + 1);
        }

        if (this.anchored) return this.regex.test(subject);

        // Unanchored patterns match at any depth, i.e. against any suffix
        // that starts at a path component boundary.
        if (this.regex.test(subject)) return true;
        let from = subject.indexOf('/');
        while (from >= 0) {
            if (this.regex.test(subject.slice(from + 1))) return true;
            from = subject.indexOf('/', from + 1);
        }
        return false;
    }
}

/**
 * Translate a gitignore glob into an anchored regular expression.
 * @param {String} pattern
 * @param {Boolean} anchored
 * @returns {RegExp}
 */
function compile(pattern) {
    let source = '';

    for (let i = 0; i < pattern.length; i++) {
        const ch = pattern[i];

        if (ch === '\\') {
            const next = pattern[i + 1];
            if (next === undefined) { source += '\\\\'; break; }
            source += escapeLiteral(next);
            i += 1;
            continue;
        }

        if (ch === '*') {
            const doubled = pattern[i + 1] === '*';
            if (doubled) {
                const before = i === 0 || pattern[i - 1] === '/';
                const after = pattern[i + 2] === '/' || pattern[i + 2] === undefined;
                i += 1;
                if (before && after && pattern[i + 1] === '/') {
                    source += '(?:[^/]+/)*';               // 'a/**/b' -> zero or more dirs
                    i += 1;
                } else if (before && after) {
                    source += '.*';                        // trailing '/**'
                } else {
                    source += '[^/]*';                     // '**' inside a component
                }
            } else {
                source += '[^/]*';
            }
            continue;
        }

        if (ch === '?') { source += '[^/]'; continue; }

        if (ch === '[') {
            const close = findClassEnd(pattern, i);
            if (close < 0) { source += '\\['; continue; }
            let body = pattern.slice(i + 1, close);
            if (body.startsWith('!')) body = '^' + body.slice(1);
            source += '[' + body.replace(/\\/g, '\\\\') + ']';
            i = close;
            continue;
        }

        source += escapeLiteral(ch);
    }

    return new RegExp(`^${source}$`);
}

/**
 * @param {String} pattern
 * @param {Number} start - index of '['
 * @returns {Number} index of the closing ']', or -1
 */
function findClassEnd(pattern, start) {
    let i = start + 1;
    if (pattern[i] === '!' || pattern[i] === '^') i += 1;
    if (pattern[i] === ']') i += 1;
    for (; i < pattern.length; i++) {
        if (pattern[i] === '\\') { i += 1; continue; }
        if (pattern[i] === ']') return i;
    }
    return -1;
}

/**
 * @param {String} ch
 * @returns {String}
 */
function escapeLiteral(ch) {
    return /[.*+?^${}()|[\]\\]/.test(ch) ? '\\' + ch : ch;
}

/**
 * Parse one ignore file's text into patterns.
 * @param {String} text
 * @param {String} base - POSIX directory the file sits in ('' for the root)
 * @returns {Array<IgnorePattern>}
 */
function parsePatterns(text, base = '') {
    const patterns = [];
    for (const raw of text.split('\n')) {
        let line = raw.replace(/\r$/, '');
        if (!line.trim()) continue;
        if (line.startsWith('#')) continue;

        // Trailing whitespace is stripped unless the last space is escaped.
        line = line.replace(/(?<!\\)\s+$/, '');
        if (!line) continue;

        patterns.push(new IgnorePattern(line, base));
    }
    return patterns;
}

/**
 * Evaluates a whole precedence stack. Per-directory .gitignore files are read
 * on demand and cached, so a status walk pays for each file once.
 */
class IgnoreMatcher {
    /**
     * @param {Object} repo - a Repository
     */
    constructor(repo) {
        this.repo = repo;
        this.worktree = repo.worktree;
        /** Lowest-precedence layers: core.excludesFile then info/exclude. */
        this.basePatterns = [];
        /** dir (POSIX, '' = root) -> patterns from that directory's .gitignore */
        this.perDirectory = new Map();
        this.loaded = false;
    }

    /**
     * @returns {Promise<void>}
     */
    async load() {
        if (this.loaded) return;
        this.loaded = true;

        const excludesFile = this.repo.config.get('core.excludesFile');
        if (excludesFile) {
            const text = await readFileOrNull(expandTilde(excludesFile));
            if (text) this.basePatterns.push(...parsePatterns(text.toString('utf-8')));
        }

        const infoExclude = await readFileOrNull(path.join(this.repo.commondir, 'info', 'exclude'));
        if (infoExclude) this.basePatterns.push(...parsePatterns(infoExclude.toString('utf-8')));
    }

    /**
     * @param {String} directory - POSIX path relative to the worktree root
     * @returns {Promise<Array<IgnorePattern>>}
     */
    async patternsFor(directory) {
        if (this.perDirectory.has(directory)) return this.perDirectory.get(directory);

        const filePath = path.join(this.worktree, ...(directory ? directory.split('/') : []), '.gitignore');
        const text = await readFileOrNull(filePath);
        const patterns = text ? parsePatterns(text.toString('utf-8'), directory) : [];
        this.perDirectory.set(directory, patterns);
        return patterns;
    }

    /**
     * Decision for one path, ignoring its ancestors.
     * @param {String} relativePath
     * @param {Boolean} isDirectory
     * @returns {Promise<Boolean|null>} null when no pattern matched
     */
    async decide(relativePath, isDirectory) {
        await this.load();

        let decision = null;
        for (const pattern of this.basePatterns) {
            if (pattern.matches(relativePath, isDirectory)) decision = !pattern.negated;
        }

        // Root .gitignore first, then each deeper directory: later wins.
        const components = relativePath.split('/');
        for (let depth = 0; depth < components.length; depth++) {
            const directory = components.slice(0, depth).join('/');
            for (const pattern of await this.patternsFor(directory)) {
                if (pattern.matches(relativePath, isDirectory)) decision = !pattern.negated;
            }
        }
        return decision;
    }

    /**
     * Full decision including ancestors: a path inside an excluded directory
     * is excluded no matter what a later negation says.
     * @param {String} relativePath - POSIX, relative to the worktree root
     * @param {Boolean} isDirectory
     * @returns {Promise<Boolean>}
     */
    async isIgnored(relativePath, isDirectory) {
        const components = relativePath.split('/');
        for (let depth = 1; depth < components.length; depth++) {
            const ancestor = components.slice(0, depth).join('/');
            if ((await this.decide(ancestor, true)) === true) return true;
        }
        return (await this.decide(relativePath, isDirectory)) === true;
    }
}

/**
 * Walk the worktree, yielding files that are neither ignored nor inside the
 * git directory. Directories that are ignored are not descended into.
 *
 * @param {Object} repo
 * @param {IgnoreMatcher} matcher
 * @param {Object} [options]
 * @param {Set<String>} [options.tracked] - paths that must be visited even if ignored
 * @returns {AsyncGenerator<{path: String, stat: fs.Stats}>}
 */
async function* walkWorktree(repo, matcher, options = {}) {
    const root = repo.requireWorktree('scanning the working tree');
    const tracked = options.tracked || new Set();
    const trackedDirectories = new Set();
    for (const entry of tracked) {
        const parts = entry.split('/');
        for (let i = 1; i < parts.length; i++) trackedDirectories.add(parts.slice(0, i).join('/'));
    }

    const gitdirReal = path.resolve(repo.gitdir);
    const commondirReal = path.resolve(repo.commondir);

    async function* visit(relativeDir) {
        const absoluteDir = relativeDir ? path.join(root, ...relativeDir.split('/')) : root;

        let entries;
        try {
            entries = await fs.readdir(absoluteDir, { withFileTypes: true });
        } catch (error) {
            if (error.code === 'ENOENT' || error.code === 'EACCES') return;
            throw error;
        }

        for (const entry of entries) {
            const relative = relativeDir ? `${relativeDir}/${entry.name}` : entry.name;
            const absolute = path.join(absoluteDir, entry.name);

            // '.git' is never tracked at any level, whether it is this
            // repository's gitfile or a nested submodule's directory.
            if (entry.name === '.git') continue;
            if (absolute === gitdirReal || absolute === commondirReal) continue;

            const stat = await fs.lstat(absolute).catch(() => null);
            if (!stat) continue;

            if (stat.isDirectory()) {
                // A directory holding its own .git is a submodule boundary.
                const nested = await fs.stat(path.join(absolute, '.git')).then(() => true, () => false);
                if (nested) {
                    yield { path: relative, stat, submodule: true };
                    continue;
                }
                if (!trackedDirectories.has(relative) && await matcher.isIgnored(relative, true)) continue;
                yield* visit(relative);
                continue;
            }

            if (!tracked.has(relative) && await matcher.isIgnored(relative, false)) continue;
            yield { path: relative, stat, submodule: false };
        }
    }

    yield* visit('');
}

module.exports = {
    IgnorePattern,
    IgnoreMatcher,
    parsePatterns,
    walkWorktree
};
