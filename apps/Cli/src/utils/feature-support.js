/**
 * ============================================================================
 * Feature Support Manifest
 * ============================================================================
 *
 * PURPOSE:
 *   One declaration of what Gent v13 supports, consumed by repository opening,
 *   command preflight, the generated documentation and the test suites. The
 *   data lives in feature-support.json so the Django API can load the exact
 *   same bytes when server integration is implemented.
 *
 * RULE:
 *   Nothing may claim support for a feature this manifest does not mark
 *   'supported'. Detection happens *before* any state is modified, so an
 *   unsupported repository is refused rather than half-converted.
 *
 * ============================================================================
 */

const manifest = require('./feature-support.json');

const BY_ID = new Map(manifest.features.map(f => [f.id, f]));

/**
 * Raised when a repository or request needs something Gent does not implement.
 * Carries the manifest entries so callers can render a consistent message.
 */
class UnsupportedFeatureError extends Error {
    /**
     * @param {Array<{id: String, title: String, detail: String, remedy?: String}>} features
     * @param {String} [context] - what was being attempted
     */
    constructor(features, context) {
        const list = features.map(f => `  - ${f.title}: ${f.detail}${f.remedy ? `\n    Fix: ${f.remedy}` : ''}`).join('\n');
        super(`${context ? `${context}: ` : ''}unsupported repository feature\n${list}`);
        this.name = 'UnsupportedFeatureError';
        this.code = 'GENT_UNSUPPORTED';
        this.features = features;
        this.context = context || null;
    }
}

/**
 * Look up a manifest entry.
 * @param {String} id
 * @returns {Object}
 */
function feature(id) {
    const f = BY_ID.get(id);
    if (!f) throw new Error(`Unknown feature id '${id}' — add it to feature-support.json`);
    return f;
}

/**
 * @param {String} id
 * @returns {Boolean}
 */
function isSupported(id) {
    const status = feature(id).status;
    return status === 'supported' || status === 'partial';
}

/**
 * Throw if any of the given feature ids is not implemented.
 * @param {Array<String>} ids
 * @param {String} [context]
 */
function assertSupported(ids, context) {
    const bad = ids.filter(id => feature(id).status === 'unsupported').map(feature);
    if (bad.length) throw new UnsupportedFeatureError(bad, context);
}

/**
 * All features in a given status, for documentation and status output.
 * @param {String} status
 * @returns {Array<Object>}
 */
function byStatus(status) {
    return manifest.features.filter(f => f.status === status);
}

module.exports = {
    manifest,
    FORMAT_MARKER: manifest.formatMarker,
    OBJECT_FORMAT: manifest.objectFormat,
    REPOSITORY_FORMAT_VERSION: manifest.repositoryFormatVersion,
    UnsupportedFeatureError,
    feature,
    isSupported,
    assertSupported,
    byStatus
};
