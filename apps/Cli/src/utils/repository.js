/**
 * ============================================================================
 * Repository - discovery, validation and the handle everything else uses
 * ============================================================================
 *
 * PURPOSE:
 *   Find the repository from any directory, decide whether Gent can safely
 *   operate on it, and hand back one object carrying the object store, refs,
 *   config and paths.
 *
 * LAYOUTS UNDERSTOOD:
 *   <root>/.gent/                  Gent-created; a .git *file* points at it
 *   <root>/.git/                   ordinary Git clone
 *   <root>/.git                    a gitfile: "gitdir: <path>"
 *   bare repositories             (core.bare = true)
 *   linked worktrees              (gitdir + commondir files)
 *
 * VALIDATION HAPPENS BEFORE ANY WRITE:
 *   repositoryformatversion, unknown required extensions, the object format,
 *   the ref backend and any in-progress external Git operation are all checked
 *   at open time. An unsupported repository is refused intact.
 *
 * BRANDING IS NOT VALIDITY:
 *   The directory being called `.gent` never makes a repository valid, and its
 *   being called `.git` never makes one invalid.
 * ============================================================================
 */

const fs = require('fs').promises;
const path = require('path');
const os = require('os');

const { ObjectStore } = require('./object-store');
const { PackStore } = require('./packfile');
const { RefStore } = require('./refs');
const { ConfigFile, ConfigSet, expandIncludes } = require('./git-config');
const { UnsupportedFeatureError, feature, FORMAT_MARKER, OBJECT_FORMAT, REPOSITORY_FORMAT_VERSION } = require('./feature-support');
const { readFileOrNull, writeAtomic } = require('./lockfile');
const { timezoneOffset } = require('./git-objects');

const GENT_DIR = '.gent';
const GIT_DIR = '.git';

/** Extensions Gent understands. Anything else refuses the repository. */
const KNOWN_EXTENSIONS = new Set(['objectformat', 'worktreeconfig', 'preciousobjects', 'compatobjectformat']);

/** Marker files that mean another tool is mid-operation. */
const IN_PROGRESS_MARKERS = [
    ['rebase-merge', 'an interactive rebase'],
    ['rebase-apply', 'a rebase or "git am"'],
    ['CHERRY_PICK_HEAD', 'a cherry-pick'],
    ['REVERT_HEAD', 'a revert'],
    ['BISECT_LOG', 'a bisect'],
    ['sequencer', 'a sequencer operation']
];

class RepositoryError extends Error {
    constructor(message, code) {
        super(message);
        this.name = 'RepositoryError';
        this.code = code || 'GENT_NOT_A_REPOSITORY';
    }
}

/** A pre-v13 repository: JSON history, no canonical config. */
class LegacyRepositoryError extends Error {
    constructor(gentPath) {
        super(
            `'${gentPath}' is a Gent v12 repository.\n` +
            `Its history is stored in commits.json with randomly generated commit ids, which v13 cannot read.\n` +
            `Run "gent migrate --dry-run" to see exactly what conversion would do; nothing is modified until you run "gent migrate".`
        );
        this.name = 'LegacyRepositoryError';
        this.code = 'GENT_LEGACY_REPOSITORY';
        this.gentPath = gentPath;
    }
}

class Repository {
    /**
     * @param {Object} parts
     */
    constructor(parts) {
        /** @type {String} the per-worktree git directory */
        this.gitdir = parts.gitdir;
        /** @type {String} shared objects/refs directory (differs in linked worktrees) */
        this.commondir = parts.commondir;
        /** @type {String|null} null for a bare repository */
        this.worktree = parts.worktree;
        /** @type {Boolean} */
        this.bare = parts.bare;
        /** @type {ConfigSet} */
        this.config = parts.config;
        /** @type {ConfigFile} the file `gent config` writes to */
        this.localConfig = parts.localConfig;
        /** @type {Boolean} true when the gitdir is named .gent */
        this.gentBranded = path.basename(this.commondir) === GENT_DIR;

        const objectsDir = path.join(this.commondir, 'objects');
        this.objects = new ObjectStore(objectsDir, { packBackend: new PackStore(objectsDir) });
        this.refs = new RefStore(this);
    }

    /** Gent's own metadata namespace inside the resolved gitdir. */
    get gentMetaDir() {
        return path.join(this.commondir, 'gent');
    }

    /** Per-worktree Gent metadata (operation state that must not be shared). */
    get gentWorktreeMetaDir() {
        return path.join(this.gitdir, 'gent');
    }

    get indexPath() {
        return path.join(this.gitdir, 'index');
    }

    /**
     * @param {String} name
     * @returns {String}
     */
    gitPath(name) {
        return path.join(this.gitdir, name);
    }

    /**
     * @param {String} name
     * @returns {String}
     */
    commonPath(name) {
        return path.join(this.commondir, name);
    }

    /**
     * Committer/author identity from config, or null when unset.
     * @param {String} [kind] - 'author' | 'committer'
     * @returns {Promise<{name, email, timestamp, timezone}|null>}
     */
    async identity(kind = 'committer') {
        const now = new Date();
        const name = process.env[`GIT_${kind.toUpperCase()}_NAME`] || this.config.get('user.name');
        const email = process.env[`GIT_${kind.toUpperCase()}_EMAIL`] || this.config.get('user.email');
        if (!name || !email) return null;
        return {
            name,
            email,
            timestamp: Math.floor(now.getTime() / 1000),
            timezone: timezoneOffset(now)
        };
    }

    /** Used by RefStore for reflog lines; absent identity means no reflog. */
    async reflogIdentity() {
        return this.identity('committer');
    }

    /**
     * Refuse to write while another tool holds the repository mid-operation.
     * @param {String} what - the Gent operation being attempted
     */
    async assertNoExternalOperation(what) {
        for (const [marker, description] of IN_PROGRESS_MARKERS) {
            for (const candidate of [this.gitPath(marker), this.commonPath(marker)]) {
                const present = await fs.access(candidate).then(() => true, () => false);
                if (!present) continue;
                throw new UnsupportedFeatureError(
                    [{ ...feature('sequencer.external'), detail: `${description} is in progress (${path.basename(candidate)} exists)` }],
                    what
                );
            }
        }
    }

    /**
     * @returns {Promise<String>} absolute path
     * @throws when the repository is bare
     */
    requireWorktree(what) {
        if (!this.worktree) {
            throw new RepositoryError(`${what} requires a working tree, and this is a bare repository`, 'GENT_BARE_REPOSITORY');
        }
        return this.worktree;
    }

    /**
     * Path of a worktree file relative to the worktree root, in POSIX form.
     * @param {String} absolutePath
     * @returns {String}
     */
    relativePath(absolutePath) {
        const root = this.requireWorktree('resolving a path');
        const relative = path.relative(root, path.resolve(absolutePath));
        if (relative.startsWith('..') || path.isAbsolute(relative)) {
            throw new RepositoryError(`'${absolutePath}' is outside the repository at ${root}`, 'GENT_OUTSIDE_WORKTREE');
        }
        return relative.split(path.sep).join('/');
    }
}

/**
 * Read a gitfile ("gitdir: <path>") and resolve it.
 * @param {String} filePath
 * @returns {Promise<String|null>}
 */
async function readGitfile(filePath) {
    const raw = await readFileOrNull(filePath);
    if (!raw) return null;

    const text = raw.toString('utf-8').trim();
    if (!text.startsWith('gitdir:')) return null;

    const target = text.slice('gitdir:'.length).trim();
    if (!target) throw new RepositoryError(`gitfile '${filePath}' names no directory`);
    return path.resolve(path.dirname(filePath), target);
}

/**
 * Follow a linked worktree's `commondir` file.
 * @param {String} gitdir
 * @returns {Promise<String>}
 */
async function resolveCommonDir(gitdir) {
    const raw = await readFileOrNull(path.join(gitdir, 'commondir'));
    if (!raw) return gitdir;
    const target = raw.toString('utf-8').trim();
    return path.resolve(gitdir, target);
}

/**
 * Locate the git directory by walking up from a starting directory.
 * @param {String} [startDir]
 * @returns {Promise<{gitdir: String, commondir: String, worktree: String|null}>}
 */
async function findGitdir(startDir = process.cwd()) {
    if (process.env.GIT_DIR) {
        const gitdir = path.resolve(process.env.GIT_DIR);
        return {
            gitdir,
            commondir: await resolveCommonDir(gitdir),
            worktree: process.env.GIT_WORK_TREE ? path.resolve(process.env.GIT_WORK_TREE) : null
        };
    }

    let current = await fs.realpath(startDir);
    const root = path.parse(current).root;

    for (;;) {
        for (const name of [GENT_DIR, GIT_DIR]) {
            const candidate = path.join(current, name);
            let stat;
            try {
                stat = await fs.stat(candidate);
            } catch {
                continue;
            }

            if (stat.isDirectory()) {
                if (name === GENT_DIR && !(await looksLikeGitdir(candidate)) && !(await looksLikeLegacyGentdir(candidate))) {
                    continue;
                }
                const commondir = await resolveCommonDir(candidate);
                return { gitdir: candidate, commondir, worktree: current };
            }
            if (stat.isFile()) {
                const target = await readGitfile(candidate);
                if (!target) continue;
                const commondir = await resolveCommonDir(target);
                return { gitdir: target, commondir, worktree: current };
            }
        }

        // A bare repository: the directory we are standing in *is* the gitdir.
        if (await looksLikeGitdir(current)) {
            return { gitdir: current, commondir: await resolveCommonDir(current), worktree: null };
        }

        if (current === root) {
            throw new RepositoryError(
                `not a Gent repository (or any parent up to ${root}): no .gent or .git found`
            );
        }
        current = path.dirname(current);
    }
}

/**
 * @param {String} dir
 * @returns {Promise<Boolean>}
 */
async function looksLikeGitdir(dir) {
    try {
        const [head, objects, refs] = await Promise.all([
            fs.stat(path.join(dir, 'HEAD')).then(() => true, () => false),
            fs.stat(path.join(dir, 'objects')).then(s => s.isDirectory(), () => false),
            fs.stat(path.join(dir, 'refs')).then(s => s.isDirectory(), () => false)
        ]);
        return head && objects && refs;
    } catch {
        return false;
    }
}

/**
 * @param {String} dir
 * @returns {Promise<Boolean>}
 */
async function looksLikeLegacyGentdir(dir) {
    return fs.access(path.join(dir, 'commits.json')).then(() => true, () => false);
}

/**
 * Build the layered config: system < global < local < worktree.
 * @param {String} commondir
 * @param {String} gitdir
 * @returns {Promise<{set: ConfigSet, local: ConfigFile}>}
 */
async function loadConfig(commondir, gitdir) {
    const localPath = path.join(commondir, 'config');
    const local = (await ConfigFile.load(localPath)) || new ConfigFile('', localPath);

    const context = { gitdir: commondir, worktree: null, branch: null };
    const files = [];

    if (!process.env.GIT_CONFIG_NOSYSTEM) {
        for (const candidate of ['/etc/gitconfig', '/usr/local/etc/gitconfig']) {
            files.push(...await expandIncludes(await ConfigFile.load(candidate), context));
        }
    }

    const xdg = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
    for (const candidate of [path.join(xdg, 'git', 'config'), path.join(os.homedir(), '.gitconfig')]) {
        files.push(...await expandIncludes(await ConfigFile.load(candidate), context));
    }

    files.push(...await expandIncludes(local, context));

    const set = new ConfigSet(files);
    if (set.getBoolean('extensions.worktreeConfig', false)) {
        const worktreeConfig = await ConfigFile.load(path.join(gitdir, 'config.worktree'));
        if (worktreeConfig) files.push(...await expandIncludes(worktreeConfig, context));
    }

    return { set: new ConfigSet(files), local };
}

/**
 * Refuse repositories whose format Gent does not implement.
 * @param {ConfigSet} config
 * @param {String} commondir
 */
function assertSupportedFormat(config, commondir) {
    const version = config.getInt('core.repositoryformatversion', 0);
    const violations = [];

    if (version > REPOSITORY_FORMAT_VERSION) {
        throw new RepositoryError(
            `repository format version ${version} at ${commondir} is newer than this Gent understands (${REPOSITORY_FORMAT_VERSION})`,
            'GENT_UNKNOWN_FORMAT'
        );
    }

    const objectFormat = version >= 1 ? config.get('extensions.objectFormat') : undefined;
    if (objectFormat === undefined) {
        violations.push({
            ...feature('object-format.sha1'),
            detail: `${commondir} has no extensions.objectFormat, so it is a SHA-1 repository`
        });
    } else if (objectFormat.toLowerCase() !== OBJECT_FORMAT) {
        violations.push({ ...feature('object-format.sha1'), detail: `extensions.objectFormat is '${objectFormat}'` });
    }

    if (version >= 1) {
        for (const [name] of config.list()) {
            if (!name.startsWith('extensions.')) continue;
            const extension = name.slice('extensions.'.length).toLowerCase();
            if (extension === 'refstorage') {
                const backend = config.get(name);
                if (backend && backend.toLowerCase() !== 'files') {
                    violations.push({ ...feature('refs.reftable'), detail: `extensions.refStorage is '${backend}'` });
                }
                continue;
            }
            if (extension === 'partialclone') {
                violations.push({ ...feature('transport.shallow'), detail: `extensions.partialClone is set (promisor remote '${config.get(name)}')` });
                continue;
            }
            if (!KNOWN_EXTENSIONS.has(extension)) {
                violations.push({
                    id: `extensions.${extension}`,
                    status: 'unsupported',
                    title: `Repository extension '${extension}'`,
                    detail: `${commondir} requires an extension Gent does not implement`,
                    remedy: 'Use Git for this repository, or remove the extension if it is no longer needed.'
                });
            }
        }
    }

    if (violations.length) throw new UnsupportedFeatureError(violations, `opening ${commondir}`);
}

/**
 * Detect a v12 repository so the caller can explain migration instead of
 * failing with a confusing format error.
 * @param {String} gitdir
 * @returns {Promise<Boolean>}
 */
async function isLegacyRepository(gitdir) {
    const hasCommitsJson = await fs.access(path.join(gitdir, 'commits.json')).then(() => true, () => false);
    if (!hasCommitsJson) return false;
    const hasCanonicalConfig = await fs.access(path.join(gitdir, 'config')).then(() => true, () => false);
    return !hasCanonicalConfig;
}

/**
 * Open the repository containing `startDir`.
 * @param {String} [startDir]
 * @returns {Promise<Repository>}
 */
async function open(startDir = process.cwd()) {
    const located = await findGitdir(startDir);

    if (await isLegacyRepository(located.commondir)) {
        throw new LegacyRepositoryError(located.commondir);
    }

    const { set, local } = await loadConfig(located.commondir, located.gitdir);
    assertSupportedFormat(set, located.commondir);

    const bare = set.getBoolean('core.bare', located.worktree === null);
    let worktree = bare ? null : located.worktree;

    const configuredWorktree = set.get('core.worktree');
    if (!bare && configuredWorktree) {
        worktree = path.resolve(located.commondir, configuredWorktree);
    }
    if (!bare && !worktree) {
        const raw = await readFileOrNull(path.join(located.gitdir, 'gitdir'));
        if (raw) worktree = path.dirname(raw.toString('utf-8').trim());
    }

    return new Repository({
        gitdir: located.gitdir,
        commondir: located.commondir,
        worktree,
        bare,
        config: set,
        localConfig: local
    });
}

/**
 * Create a new repository.
 *
 * Gent-created repositories keep the `.gent` directory name and add a `.git`
 * gitfile so tools with hard-coded discovery still find them. `.gent` itself
 * is excluded through info/exclude, not through a hidden built-in rule.
 *
 * @param {String} directory
 * @param {Object} [options]
 * @param {Boolean} [options.bare]
 * @param {String} [options.defaultBranch]
 * @param {Boolean} [options.useGitDirName] - name the directory .git instead
 * @returns {Promise<{repo: Repository, created: Boolean, gitdir: String}>}
 */
async function init(directory, options = {}) {
    await fs.mkdir(path.resolve(directory), { recursive: true });
    const root = await fs.realpath(directory);
    // Reinitialization must never turn legacy/SHA-1 metadata into SHA-256
    // metadata or overwrite the pointer of another repository.
    for (const name of (options.bare ? ['HEAD'] : [GIT_DIR, GENT_DIR])) {
        if (await fs.lstat(path.join(root, name)).then(() => true, error => {
            if (error.code === 'ENOENT') return false;
            throw error;
        })) {
            const repo = await open(root);
            return { repo, created: false, gitdir: repo.gitdir };
        }
    }
    const dirName = options.bare ? '' : (options.useGitDirName ? GIT_DIR : GENT_DIR);
    const gitdir = options.bare ? root : path.join(root, dirName);

    const existed = await fs.access(path.join(gitdir, 'HEAD')).then(() => true, () => false);

    await fs.mkdir(path.join(gitdir, 'objects', 'pack'), { recursive: true });
    await fs.mkdir(path.join(gitdir, 'objects', 'info'), { recursive: true });
    await fs.mkdir(path.join(gitdir, 'refs', 'heads'), { recursive: true });
    await fs.mkdir(path.join(gitdir, 'refs', 'tags'), { recursive: true });
    await fs.mkdir(path.join(gitdir, 'info'), { recursive: true });
    await fs.mkdir(path.join(gitdir, 'gent'), { recursive: true });

    const branch = options.defaultBranch || 'main';
    if (!existed) {
        await writeAtomic(path.join(gitdir, 'HEAD'), `ref: refs/heads/${branch}\n`);
    }

    const configPath = path.join(gitdir, 'config');
    const config = (await ConfigFile.load(configPath)) || new ConfigFile('', configPath);
    config.set('core.repositoryformatversion', String(REPOSITORY_FORMAT_VERSION));
    config.set('core.filemode', 'true');
    config.set('core.bare', options.bare ? 'true' : 'false');
    if (!options.bare) config.set('core.logallrefupdates', 'true');
    config.set('extensions.objectFormat', OBJECT_FORMAT);
    config.set('gent.format', FORMAT_MARKER);
    await config.save();

    // Exclude our own metadata directory the way Git excludes anything else.
    if (!options.bare && dirName === GENT_DIR) {
        const excludePath = path.join(gitdir, 'info', 'exclude');
        const existing = (await readFileOrNull(excludePath))?.toString('utf-8') || '';
        if (!existing.split('\n').some(line => line.trim() === '/.gent/')) {
            await writeAtomic(excludePath, `${existing}${existing && !existing.endsWith('\n') ? '\n' : ''}/.gent/\n`);
        }
        await writeAtomic(path.join(root, GIT_DIR), `gitdir: ${GENT_DIR}\n`);
    }

    return { repo: await open(options.bare ? gitdir : root), created: !existed, gitdir };
}

module.exports = {
    Repository,
    RepositoryError,
    LegacyRepositoryError,
    open,
    init,
    findGitdir,
    isLegacyRepository,
    readGitfile,
    resolveCommonDir,
    loadConfig,
    GENT_DIR,
    GIT_DIR
};
