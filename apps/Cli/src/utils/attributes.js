/**
 * ============================================================================
 * Attributes - gitattributes lookup and text/EOL conversion
 * ============================================================================
 *
 * PURPOSE:
 *   Decide how a path's bytes differ between the object store and the working
 *   tree, and refuse — before writing anything — when the answer depends on a
 *   transformation Gent does not implement.
 *
 * SUPPORTED:
 *   text, -text, text=auto, eol=lf, eol=crlf, the `binary` macro,
 *   core.autocrlf and core.eol.
 *
 * REFUSED (never guessed):
 *   filter=* (including Git LFS) and working-tree-encoding. A path carrying
 *   either raises UnsupportedFeatureError, so an operation stops before it
 *   corrupts content by storing the wrong bytes.
 *
 * DIRECTION:
 *   toIndex()    working tree -> object store ("clean")
 *   toWorktree() object store -> working tree ("smudge")
 *   Blobs are stored with LF line endings; CRLF is a working-tree property.
 * ============================================================================
 */

const path = require('path');

const { readFileOrNull } = require('./lockfile');
const { IgnorePattern } = require('./ignore');
const { UnsupportedFeatureError, feature } = require('./feature-support');

/** Attributes that decide content transformation. */
const BINARY_MACRO = { text: false, diff: false, merge: false };

/**
 * @param {Buffer} buffer
 * @returns {Boolean} Git's heuristic: a NUL byte in the first 8000 bytes
 */
function looksBinary(buffer) {
    const limit = Math.min(buffer.length, 8000);
    return buffer.indexOf(0, 0) >= 0 && buffer.indexOf(0, 0) < limit;
}

/**
 * One `<pattern> <attr>...` line.
 */
class AttributeRule {
    /**
     * @param {String} line
     * @param {String} base - POSIX directory the file sits in
     */
    constructor(line, base) {
        const parts = line.trim().split(/\s+/);
        const pattern = parts.shift();
        this.matcher = new IgnorePattern(pattern.endsWith('/') ? pattern : pattern, base);
        this.attributes = {};

        for (const token of parts) {
            if (token.startsWith('-')) { this.attributes[token.slice(1)] = false; continue; }
            if (token.startsWith('!')) { this.attributes[token.slice(1)] = undefined; continue; }
            const eq = token.indexOf('=');
            if (eq < 0) { this.attributes[token] = true; continue; }
            this.attributes[token.slice(0, eq)] = token.slice(eq + 1);
        }
    }

    /**
     * @param {String} relativePath
     * @param {Boolean} isDirectory
     * @returns {Boolean}
     */
    matches(relativePath, isDirectory) {
        return this.matcher.matches(relativePath, isDirectory);
    }
}

/**
 * @param {String} text
 * @param {String} base
 * @returns {Array<AttributeRule>}
 */
function parseAttributes(text, base = '') {
    const rules = [];
    for (const raw of text.split('\n')) {
        const line = raw.replace(/\r$/, '').trim();
        if (!line || line.startsWith('#')) continue;
        rules.push(new AttributeRule(line, base));
    }
    return rules;
}

class AttributesMatcher {
    /**
     * @param {Object} repo
     */
    constructor(repo) {
        this.repo = repo;
        this.baseRules = [];
        this.perDirectory = new Map();
        this.loaded = false;

        this.autocrlf = repo.config.get('core.autocrlf', 'false').toLowerCase();
        this.eol = repo.config.get('core.eol', 'native').toLowerCase();
        this.safecrlf = repo.config.get('core.safecrlf', 'false').toLowerCase();
    }

    async load() {
        if (this.loaded) return;
        this.loaded = true;

        const infoAttributes = await readFileOrNull(path.join(this.repo.commondir, 'info', 'attributes'));
        if (infoAttributes) this.baseRules.push(...parseAttributes(infoAttributes.toString('utf-8')));
    }

    /**
     * @param {String} directory
     * @returns {Promise<Array<AttributeRule>>}
     */
    async rulesFor(directory) {
        if (this.perDirectory.has(directory)) return this.perDirectory.get(directory);

        const filePath = path.join(this.repo.worktree, ...(directory ? directory.split('/') : []), '.gitattributes');
        const text = await readFileOrNull(filePath);
        const rules = text ? parseAttributes(text.toString('utf-8'), directory) : [];
        this.perDirectory.set(directory, rules);
        return rules;
    }

    /**
     * @param {String} relativePath
     * @returns {Promise<Object>} resolved attribute values
     */
    async attributesFor(relativePath) {
        await this.load();

        const resolved = {};
        const apply = (rule) => {
            if (!rule.matches(relativePath, false)) return;
            const source = rule.attributes.binary === true ? { ...BINARY_MACRO, ...rule.attributes } : rule.attributes;
            for (const [key, value] of Object.entries(source)) {
                if (key === 'binary') continue;
                resolved[key] = value;
            }
        };

        for (const rule of this.baseRules) apply(rule);

        const components = relativePath.split('/');
        for (let depth = 0; depth < components.length; depth++) {
            for (const rule of await this.rulesFor(components.slice(0, depth).join('/'))) apply(rule);
        }
        return resolved;
    }

    /**
     * Refuse paths whose bytes depend on an unimplemented transformation.
     * @param {String} relativePath
     * @param {Object} attributes
     * @param {String} what
     */
    assertConvertible(relativePath, attributes, what) {
        const problems = [];
        if (attributes.filter !== undefined && attributes.filter !== false) {
            problems.push({
                ...feature('attributes.filter'),
                detail: `'${relativePath}' has filter=${attributes.filter}; its stored bytes are produced by an external program.`
            });
        }
        if (attributes['working-tree-encoding'] !== undefined && attributes['working-tree-encoding'] !== false) {
            problems.push({
                id: 'attributes.encoding',
                status: 'unsupported',
                title: 'working-tree-encoding attribute',
                detail: `'${relativePath}' declares working-tree-encoding=${attributes['working-tree-encoding']}.`,
                remedy: 'Check this path out with Git, or remove the attribute.'
            });
        }
        if (problems.length) throw new UnsupportedFeatureError(problems, what);
    }

    /**
     * Decide whether CRLF conversion applies to a path.
     * @param {String} relativePath
     * @param {Buffer} sample - content used for the text=auto heuristic
     * @returns {Promise<{convert: Boolean, worktreeEol: 'lf'|'crlf'}>}
     */
    async conversionFor(relativePath, sample) {
        const attributes = await this.attributesFor(relativePath);
        this.assertConvertible(relativePath, attributes, 'converting line endings');

        let isText;
        if (attributes.text === false) isText = false;
        else if (attributes.text === true) isText = true;
        else if (attributes.text === 'auto') isText = !looksBinary(sample);
        else if (this.autocrlf === 'true' || this.autocrlf === 'input') isText = !looksBinary(sample);
        else isText = false;

        if (!isText) return { convert: false, worktreeEol: 'lf' };

        let worktreeEol;
        if (attributes.eol === 'crlf') worktreeEol = 'crlf';
        else if (attributes.eol === 'lf') worktreeEol = 'lf';
        else if (this.autocrlf === 'true') worktreeEol = 'crlf';
        else if (this.autocrlf === 'input') worktreeEol = 'lf';
        else if (this.eol === 'crlf') worktreeEol = 'crlf';
        else if (this.eol === 'native') worktreeEol = process.platform === 'win32' ? 'crlf' : 'lf';
        else worktreeEol = 'lf';

        return { convert: true, worktreeEol };
    }

    /**
     * Working tree bytes -> stored blob bytes.
     * @param {String} relativePath
     * @param {Buffer} content
     * @returns {Promise<Buffer>}
     */
    async toIndex(relativePath, content) {
        const { convert } = await this.conversionFor(relativePath, content);
        if (!convert) return content;
        return normalizeToLf(content);
    }

    /**
     * Stored blob bytes -> working tree bytes.
     * @param {String} relativePath
     * @param {Buffer} content
     * @returns {Promise<Buffer>}
     */
    async toWorktree(relativePath, content) {
        const { convert, worktreeEol } = await this.conversionFor(relativePath, content);
        if (!convert || worktreeEol !== 'crlf') return content;
        return normalizeToCrlf(content);
    }
}

/**
 * @param {Buffer} content
 * @returns {Buffer}
 */
function normalizeToLf(content) {
    if (!content.includes(0x0d)) return content;

    const out = Buffer.allocUnsafe(content.length);
    let written = 0;
    for (let i = 0; i < content.length; i++) {
        if (content[i] === 0x0d && content[i + 1] === 0x0a) continue;   // drop the CR of a CRLF
        out[written++] = content[i];
    }
    return out.subarray(0, written);
}

/**
 * @param {Buffer} content
 * @returns {Buffer}
 */
function normalizeToCrlf(content) {
    const lf = normalizeToLf(content);
    let count = 0;
    for (let i = 0; i < lf.length; i++) if (lf[i] === 0x0a) count++;
    if (count === 0) return lf;

    const out = Buffer.allocUnsafe(lf.length + count);
    let written = 0;
    for (let i = 0; i < lf.length; i++) {
        if (lf[i] === 0x0a) out[written++] = 0x0d;
        out[written++] = lf[i];
    }
    return out;
}

module.exports = {
    AttributesMatcher,
    AttributeRule,
    parseAttributes,
    looksBinary,
    normalizeToLf,
    normalizeToCrlf
};
