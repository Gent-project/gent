/**
 * ============================================================================
 * Web URLs - Build links into the gent web app (frontend), not the API.
 * ============================================================================
 *
 * The frontend is a SEPARATE deployment from the API. Never derive a web URL
 * from `api.base_url` — resolve `web.base_url` (env GENT_WEB_URL > user config
 * > built-in default) instead.
 *
 * CANONICAL ROUTE TREE
 *   The Next.js app currently ships two parallel repo route trees:
 *     /app/[ownerId]/[name]                            (older lineage)
 *     /dashboard/repository/[owner_id]/[repo_name]     (frontend2 lineage)
 *
 *   We target the /dashboard tree: it is where `/auth/login` sends users after
 *   sign-in (`router.replace(DASHBOARD_PATH.ROOT)`), it is what the dashboard
 *   sidebar links to, and its route params (`owner_id` / `repo_name`) match the
 *   values the CLI parses out of a remote URL.
 *
 *   If that decision is reversed, change `repoPath()` below — it is the single
 *   place the shape is defined.
 *
 * BRANCH / COMMIT DEEP LINKS
 *   The frontend has NO addressable branch or commit target. Verified against
 *   `npx next build` (no /tree/[branch], no /commit/[sha] route in either tree)
 *   and against the page sources: the branch picker and the commit diff modal
 *   are both local `useState`, never reflected in the URL or a query param.
 *   So we do not invent a URL shape — callers surface `BRANCH_COMMIT_UNSUPPORTED`
 *   and fall back to the repo page.
 * ============================================================================
 */

const userConfig = require('./user-config');

/** Message shown when a caller asks for a branch/commit link we cannot build. */
const BRANCH_COMMIT_UNSUPPORTED =
    'The gent web app has no branch or commit page yet, so this link points at the repository instead.';

/**
 * Resolve the web app base URL (env > user config > default), validated and
 * without a trailing slash.
 *
 * Validation is deliberate: a scheme-less value like `gent.example.com` is a
 * realistic typo, and without a check it silently yields a relative path that
 * looks like a link but isn't one. Fail loudly here instead — this is the
 * single normalization point, so callers can assume a clean http(s) base.
 *
 * @returns {Promise<string>}
 * @throws {Error} if the configured value is not an http(s) URL
 */
async function getWebBaseUrl() {
    const { value, source } = await userConfig.getResolved('web.base_url');
    const raw = String(value ?? '').trim();

    let parsed = null;
    try {
        parsed = new URL(raw);
    } catch {
        parsed = null;
    }

    if (!parsed || !/^https?:$/.test(parsed.protocol)) {
        throw new Error(
            `Invalid web.base_url (${source}): '${raw}'. `
            + 'Expected an http(s) URL, e.g. https://gent-nu2e.onrender.com. '
            + 'Set it with `gent config set web.base_url <url>`.'
        );
    }

    return stripTrailingSlash(parsed.href);
}

function stripTrailingSlash(url) {
    return String(url || '').replace(/\/+$/, '');
}

/**
 * Path (no host) of a repository page on the web app.
 * Single source of truth for the repo route shape.
 * @param {string|number} ownerId
 * @param {string} repoName
 * @returns {string}
 */
function repoPath(ownerId, repoName) {
    return `/dashboard/repository/${encodeURIComponent(ownerId)}/${encodeURIComponent(repoName)}`;
}

/**
 * Absolute URL of a repository page.
 * @param {string} baseUrl - Web app base URL
 * @param {string|number} ownerId
 * @param {string} repoName
 * @returns {string}
 */
function repoUrl(baseUrl, ownerId, repoName) {
    return `${stripTrailingSlash(baseUrl)}${repoPath(ownerId, repoName)}`;
}

/**
 * Build the best available link for the requested target.
 *
 * Because branch/commit pages don't exist, a branch or commit request resolves
 * to the repo page and reports `unsupported` so the caller can warn.
 *
 * @param {string} baseUrl - Web app base URL
 * @param {{ owner_id: string|number, repo_name: string }} info
 * @param {{ branch?: string, commit?: string }} [target]
 * @returns {{ url: string, unsupported: null|'branch'|'commit' }}
 */
function buildRepoLink(baseUrl, info, target = {}) {
    const url = repoUrl(baseUrl, info.owner_id, info.repo_name);
    let unsupported = null;
    if (target.commit) unsupported = 'commit';
    else if (target.branch) unsupported = 'branch';
    return { url, unsupported };
}

module.exports = {
    BRANCH_COMMIT_UNSUPPORTED,
    getWebBaseUrl,
    repoPath,
    repoUrl,
    buildRepoLink,
    stripTrailingSlash,
};
