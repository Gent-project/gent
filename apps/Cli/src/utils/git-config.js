/**
 * ============================================================================
 * Git Config - parser, accessor and format-preserving editor
 * ============================================================================
 *
 * PURPOSE:
 *   Read and write Git's configuration syntax so Gent and Git can share one
 *   config file. Editing rewrites only the affected line: comments, ordering,
 *   indentation and every unrelated setting survive.
 *
 * SYNTAX SUPPORTED:
 *   [section] / [section "subsection"] / [section.subsection]
 *   key = value, bare key (boolean true), repeated keys (multi-valued),
 *   double-quoted values with \n \t \b \\ \" escapes, # and ; comments,
 *   trailing-backslash line continuation, include.path and includeIf.
 *
 * CASE RULES (Git's, not ours):
 *   Section and key names are case-insensitive; the subsection in
 *   [a "B"] is case-sensitive, the one in [a.B] is lowercased.
 *
 * See docs/git-compat/format-contract.md section 6 for what Gent stores here.
 * ============================================================================
 */

const fs = require('fs').promises;
const path = require('path');
const os = require('os');

const MAX_INCLUDE_DEPTH = 10;

class ConfigError extends Error {
    constructor(message, file, line) {
        super(`${file}:${line}: ${message}`);
        this.name = 'ConfigError';
        this.code = 'GENT_BAD_CONFIG';
        this.file = file;
        this.line = line;
    }
}

/**
 * Normalize "Section.Sub Section.Key" into its canonical lookup form.
 * @param {String} name
 * @returns {{section: String, subsection: String|null, key: String, full: String}}
 */
function splitName(name) {
    const first = name.indexOf('.');
    const last = name.lastIndexOf('.');
    if (first < 0) throw new Error(`config name '${name}' needs at least a section and a key`);

    const section = name.slice(0, first).toLowerCase();
    const key = name.slice(last + 1).toLowerCase();
    const subsection = last > first ? name.slice(first + 1, last) : null;
    return { section, subsection, key, full: canonicalName(section, subsection, key) };
}

/**
 * @param {String} section
 * @param {String|null} subsection
 * @param {String} key
 * @returns {String}
 */
function canonicalName(section, subsection, key) {
    return subsection === null
        ? `${section}.${key}`
        : `${section}.${subsection}.${key}`;
}

/**
 * A single config file: the raw lines plus the entries pointing into them.
 */
class ConfigFile {
    /**
     * @param {String} text
     * @param {String} filePath
     */
    constructor(text, filePath) {
        this.filePath = filePath;
        this.lines = text.split('\n');
        this.entries = [];                     // {section, subsection, key, value, lineStart, lineEnd}
        this._parse();
    }

    /**
     * @param {String} filePath
     * @returns {Promise<ConfigFile|null>} null when the file does not exist
     */
    static async load(filePath) {
        try {
            return new ConfigFile(await fs.readFile(filePath, 'utf-8'), filePath);
        } catch (error) {
            if (error.code === 'ENOENT' || error.code === 'EACCES' || error.code === 'EISDIR') return null;
            throw error;
        }
    }

    _parse() {
        let section = null;
        let subsection = null;

        for (let i = 0; i < this.lines.length; i++) {
            const raw = this.lines[i];
            const trimmed = raw.trim();

            if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith(';')) continue;

            if (trimmed.startsWith('[')) {
                const header = this._parseSectionHeader(trimmed, i);
                section = header.section;
                subsection = header.subsection;
                continue;
            }

            if (section === null) {
                throw new ConfigError(`key outside of any section: ${trimmed}`, this.filePath, i + 1);
            }

            // Gather continuation lines before parsing the value.
            let lineEnd = i;
            let joined = raw;
            while (this._endsWithContinuation(joined) && lineEnd + 1 < this.lines.length) {
                lineEnd += 1;
                joined = joined.slice(0, joined.lastIndexOf('\\')) + this.lines[lineEnd];
            }

            const parsed = this._parseKeyValue(joined, i);
            this.entries.push({
                section,
                subsection,
                key: parsed.key,
                value: parsed.value,
                lineStart: i,
                lineEnd
            });
            i = lineEnd;
        }
    }

    /**
     * A trailing backslash escapes the newline unless it is itself escaped.
     * @param {String} line
     * @returns {Boolean}
     */
    _endsWithContinuation(line) {
        let backslashes = 0;
        for (let i = line.length - 1; i >= 0 && line[i] === '\\'; i--) backslashes++;
        return backslashes % 2 === 1;
    }

    /**
     * @param {String} line
     * @param {Number} index
     * @returns {{section: String, subsection: String|null}}
     */
    _parseSectionHeader(line, index) {
        const close = line.lastIndexOf(']');
        if (close < 0) throw new ConfigError('section header is not closed', this.filePath, index + 1);

        const body = line.slice(1, close).trim();
        const quote = body.indexOf('"');

        if (quote >= 0) {
            const name = body.slice(0, quote).trim();
            if (!/^[A-Za-z0-9.-]+$/.test(name)) {
                throw new ConfigError(`invalid section name '${name}'`, this.filePath, index + 1);
            }
            const endQuote = body.lastIndexOf('"');
            if (endQuote <= quote) throw new ConfigError('subsection is not closed', this.filePath, index + 1);

            let subsection = '';
            for (let i = quote + 1; i < endQuote; i++) {
                if (body[i] === '\\' && i + 1 < endQuote) {
                    i += 1;
                    subsection += body[i];                 // \" and \\ only; others are literal
                } else {
                    subsection += body[i];
                }
            }
            return { section: name.toLowerCase(), subsection };
        }

        if (!/^[A-Za-z0-9.-]+$/.test(body)) {
            throw new ConfigError(`invalid section name '${body}'`, this.filePath, index + 1);
        }
        const dot = body.indexOf('.');
        return dot < 0
            ? { section: body.toLowerCase(), subsection: null }
            : { section: body.slice(0, dot).toLowerCase(), subsection: body.slice(dot + 1).toLowerCase() };
    }

    /**
     * @param {String} line
     * @param {Number} index
     * @returns {{key: String, value: String}}
     */
    _parseKeyValue(line, index) {
        const eq = this._findAssignment(line);
        const keyText = (eq < 0 ? line : line.slice(0, eq)).trim();

        if (!/^[A-Za-z][A-Za-z0-9-]*$/.test(keyText)) {
            throw new ConfigError(`invalid key name '${keyText}'`, this.filePath, index + 1);
        }
        if (eq < 0) return { key: keyText.toLowerCase(), value: 'true' };

        return { key: keyText.toLowerCase(), value: this._parseValue(line.slice(eq + 1), index) };
    }

    /**
     * Index of the assignment '=' — the first one outside quotes.
     * @param {String} line
     * @returns {Number}
     */
    _findAssignment(line) {
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if (ch === '\\') { i += 1; continue; }
            if (ch === '"') { inQuotes = !inQuotes; continue; }
            if (inQuotes) continue;
            if (ch === '=') return i;
            if (ch === '#' || ch === ';') return -1;
        }
        return -1;
    }

    /**
     * @param {String} text - everything after '='
     * @param {Number} index
     * @returns {String}
     */
    _parseValue(text, index) {
        let value = '';
        let inQuotes = false;
        let pendingSpace = '';
        let started = false;

        const ESCAPES = { n: '\n', t: '\t', b: '\b', '\\': '\\', '"': '"' };

        for (let i = 0; i < text.length; i++) {
            const ch = text[i];

            if (ch === '\\') {
                const next = text[i + 1];
                if (next === undefined) throw new ConfigError('value ends with a lone backslash', this.filePath, index + 1);
                i += 1;
                if (!(next in ESCAPES)) throw new ConfigError(`invalid escape '\\${next}'`, this.filePath, index + 1);
                value += pendingSpace + ESCAPES[next];
                pendingSpace = '';
                started = true;
                continue;
            }

            if (ch === '"') { inQuotes = !inQuotes; started = true; continue; }

            if (!inQuotes && (ch === '#' || ch === ';')) break;

            if (!inQuotes && (ch === ' ' || ch === '\t')) {
                if (started) pendingSpace += ch;            // held back until a non-space follows
                continue;
            }

            value += pendingSpace + ch;
            pendingSpace = '';
            started = true;
        }

        if (inQuotes) throw new ConfigError('unterminated quoted value', this.filePath, index + 1);
        return value;
    }

    /**
     * @param {String} name
     * @returns {Array<String>}
     */
    getAll(name) {
        const { section, subsection, key } = splitName(name);
        return this.entries
            .filter(e => e.section === section && e.key === key && (subsection === null ? e.subsection === null : e.subsection === subsection))
            .map(e => e.value);
    }

    /**
     * Every canonical name present, for `gent config --list`.
     * @returns {Array<[String, String]>}
     */
    list() {
        return this.entries.map(e => [canonicalName(e.section, e.subsection, e.key), e.value]);
    }

    /**
     * Replace the last occurrence, or append into the right section.
     * @param {String} name
     * @param {String} value
     */
    set(name, value) {
        const { section, subsection, key } = splitName(name);
        const matches = this._match(section, subsection, key);

        if (matches.length) {
            const target = matches[matches.length - 1];
            const indent = (this.lines[target.lineStart].match(/^[ \t]*/) || [''])[0];
            this.lines.splice(target.lineStart, target.lineEnd - target.lineStart + 1, `${indent}${key} = ${quoteValue(value)}`);
        } else {
            this._appendInSection(section, subsection, key, value);
        }
        this._reparse();
    }

    /**
     * Add a value without removing existing ones.
     * @param {String} name
     * @param {String} value
     */
    add(name, value) {
        const { section, subsection, key } = splitName(name);
        this._appendInSection(section, subsection, key, value);
        this._reparse();
    }

    /**
     * @param {String} name
     * @returns {Number} how many entries were removed
     */
    unset(name) {
        const { section, subsection, key } = splitName(name);
        const matches = this._match(section, subsection, key);

        for (const entry of [...matches].reverse()) {
            this.lines.splice(entry.lineStart, entry.lineEnd - entry.lineStart + 1);
        }
        this._reparse();
        return matches.length;
    }

    _match(section, subsection, key) {
        return this.entries.filter(e =>
            e.section === section && e.key === key &&
            (subsection === null ? e.subsection === null : e.subsection === subsection));
    }

    _appendInSection(section, subsection, key, value) {
        const line = `\t${key} = ${quoteValue(value)}`;

        // Last non-blank line belonging to a matching section header.
        let insertAt = -1;
        let current = null;
        for (let i = 0; i < this.lines.length; i++) {
            const trimmed = this.lines[i].trim();
            if (trimmed.startsWith('[')) {
                current = this._parseSectionHeader(trimmed, i);
                if (current.section === section &&
                    (subsection === null ? current.subsection === null : current.subsection === subsection)) {
                    insertAt = i;
                }
                continue;
            }
            if (trimmed && current && current.section === section &&
                (subsection === null ? current.subsection === null : current.subsection === subsection)) {
                insertAt = i;
            }
        }

        if (insertAt >= 0) {
            this.lines.splice(insertAt + 1, 0, line);
            return;
        }

        const header = subsection === null ? `[${section}]` : `[${section} "${escapeSubsection(subsection)}"]`;
        while (this.lines.length && this.lines[this.lines.length - 1].trim() === '') this.lines.pop();
        this.lines.push(header, line, '');
    }

    _reparse() {
        this.entries = [];
        this._parse();
    }

    /**
     * @returns {String}
     */
    toString() {
        const text = this.lines.join('\n');
        return text === '' || text.endsWith('\n') ? text : text + '\n';
    }

    /**
     * Atomic write through a .lock file, as Git does.
     * @returns {Promise<void>}
     */
    async save() {
        const { withLock } = require('./lockfile');
        await withLock(this.filePath, async (lock) => {
            await lock.write(Buffer.from(this.toString(), 'utf-8'));
        });
    }
}

/**
 * @param {String} value
 * @returns {String} the value as it should appear after '='
 */
function quoteValue(value) {
    const text = String(value);
    const needsQuotes = text === '' ||
        /^[ \t]/.test(text) || /[ \t]$/.test(text) ||
        /["#;\\\n\t\x08]/.test(text);

    if (!needsQuotes) return text;
    return '"' + text
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"')
        .replace(/\n/g, '\\n')
        .replace(/\t/g, '\\t')
        .replace(/\x08/g, '\\b') + '"';
}

/**
 * @param {String} subsection
 * @returns {String}
 */
function escapeSubsection(subsection) {
    return subsection.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

/**
 * A stack of config files: later files win, and getAll concatenates in order.
 */
class ConfigSet {
    /**
     * @param {Array<ConfigFile>} files - lowest precedence first
     */
    constructor(files) {
        this.files = files.filter(Boolean);
    }

    /**
     * @param {String} name
     * @returns {Array<String>}
     */
    getAll(name) {
        return this.files.flatMap(file => file.getAll(name));
    }

    /**
     * @param {String} name
     * @param {String} [fallback]
     * @returns {String|undefined}
     */
    get(name, fallback) {
        const all = this.getAll(name);
        return all.length ? all[all.length - 1] : fallback;
    }

    /**
     * @param {String} name
     * @param {Boolean} [fallback]
     * @returns {Boolean}
     */
    getBoolean(name, fallback = false) {
        const value = this.get(name);
        if (value === undefined) return fallback;
        const lower = value.toLowerCase();
        if (['true', 'yes', 'on', '1'].includes(lower)) return true;
        if (['false', 'no', 'off', '0', ''].includes(lower)) return false;
        throw new Error(`config ${name}='${value}' is not a boolean`);
    }

    /**
     * @param {String} name
     * @param {Number} [fallback]
     * @returns {Number}
     */
    getInt(name, fallback = 0) {
        const value = this.get(name);
        if (value === undefined) return fallback;
        const match = /^([+-]?[0-9]+)([kKmMgG]?)$/.exec(value.trim());
        if (!match) throw new Error(`config ${name}='${value}' is not an integer`);
        const scale = { '': 1, k: 1024, m: 1024 ** 2, g: 1024 ** 3 }[match[2].toLowerCase()];
        return Number.parseInt(match[1], 10) * scale;
    }

    /**
     * Distinct subsection names, e.g. every configured remote.
     * @param {String} section
     * @returns {Array<String>}
     */
    subsections(section) {
        const wanted = section.toLowerCase();
        const names = new Set();
        for (const file of this.files) {
            for (const entry of file.entries) {
                if (entry.section === wanted && entry.subsection !== null) names.add(entry.subsection);
            }
        }
        return [...names];
    }

    /**
     * @returns {Array<[String, String]>}
     */
    list() {
        return this.files.flatMap(file => file.list());
    }
}

/**
 * Resolve include.path / includeIf.*.path relative to the including file.
 * @param {ConfigFile} file
 * @param {Object} context - { gitdir, worktree, branch }
 * @param {Number} depth
 * @returns {Promise<Array<ConfigFile>>} the file, then its includes, in order
 */
async function expandIncludes(file, context, depth = 0) {
    if (!file) return [];
    if (depth >= MAX_INCLUDE_DEPTH) return [file];

    const result = [file];
    for (const entry of file.entries) {
        let include = null;
        if (entry.section === 'include' && entry.key === 'path') {
            include = entry.value;
        } else if (entry.section === 'includeif' && entry.key === 'path' && entry.subsection !== null) {
            if (matchesIncludeCondition(entry.subsection, context, file.filePath)) include = entry.value;
        }
        if (!include) continue;

        const resolved = expandTilde(include);
        const absolute = path.isAbsolute(resolved) ? resolved : path.resolve(path.dirname(file.filePath), resolved);
        const included = await ConfigFile.load(absolute);
        if (included) result.push(...await expandIncludes(included, context, depth + 1));
    }
    return result;
}

/**
 * @param {String} condition - e.g. gitdir:~/work/, onbranch:main
 * @param {Object} context
 * @param {String} fromPath
 * @returns {Boolean}
 */
function matchesIncludeCondition(condition, context, fromPath) {
    const colon = condition.indexOf(':');
    if (colon < 0) return false;

    const kind = condition.slice(0, colon).toLowerCase();
    let pattern = condition.slice(colon + 1);

    if (kind === 'onbranch') {
        return Boolean(context.branch) && globMatch(pattern.replace(/\/$/, ''), context.branch);
    }
    if (kind !== 'gitdir' && kind !== 'gitdir/i') return false;
    if (!context.gitdir) return false;

    pattern = expandTilde(pattern);
    if (pattern.startsWith('./')) pattern = path.resolve(path.dirname(fromPath), pattern);
    if (pattern.endsWith('/')) pattern += '**';
    if (!pattern.startsWith('/') && !pattern.startsWith('**')) pattern = '**/' + pattern;

    const subject = kind === 'gitdir/i' ? context.gitdir.toLowerCase() : context.gitdir;
    const target = kind === 'gitdir/i' ? pattern.toLowerCase() : pattern;
    return globMatch(target, subject);
}

/**
 * Minimal fnmatch with '**' spanning separators, used only for include
 * conditions. The worktree matcher in ignore.js is the full implementation.
 * @param {String} pattern
 * @param {String} subject
 * @returns {Boolean}
 */
function globMatch(pattern, subject) {
    let source = '';
    for (let i = 0; i < pattern.length; i++) {
        const ch = pattern[i];
        if (ch === '*' && pattern[i + 1] === '*') {
            source += '.*';
            i += 1;
            continue;
        }
        if (ch === '*') { source += '[^/]*'; continue; }
        if (ch === '?') { source += '[^/]'; continue; }
        source += /[.+^${}()|[\]\\]/.test(ch) ? '\\' + ch : ch;
    }
    return new RegExp(`^${source}$`).test(subject);
}

/**
 * @param {String} value
 * @returns {String}
 */
function expandTilde(value) {
    if (value === '~') return os.homedir();
    if (value.startsWith('~/')) return path.join(os.homedir(), value.slice(2));
    return value;
}

module.exports = {
    ConfigFile,
    ConfigSet,
    ConfigError,
    expandIncludes,
    splitName,
    canonicalName,
    quoteValue,
    expandTilde
};
