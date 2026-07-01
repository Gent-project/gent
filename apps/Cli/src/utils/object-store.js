/**
 * Object Store
 * Persist content-addressed blobs inside .gent/objects.
 */

const fs = require('fs').promises;
const path = require('path');
const { pathExists } = require('./fileSystem');

/**
 * Compute object file path for hash.
 * @param {String} gentPath
 * @param {String} hash
 * @returns {String}
 */
function getObjectPath(gentPath, hash) {
    return path.join(gentPath, 'objects', `${hash}.blob`);
}

/**
 * Save object if missing.
 * @param {String} gentPath
 * @param {String} hash
 * @param {Buffer} content
 */
async function writeObject(gentPath, hash, content) {
    const objectPath = getObjectPath(gentPath, hash);

    if (!await pathExists(objectPath)) {
        await fs.writeFile(objectPath, content);
    }
}

/**
 * Read object as buffer.
 * @param {String} gentPath
 * @param {String} hash
 * @returns {Promise<Buffer|null>}
 */
async function readObject(gentPath, hash) {
    const objectPath = getObjectPath(gentPath, hash);

    if (!await pathExists(objectPath)) {
        return null;
    }

    return fs.readFile(objectPath);
}

module.exports = {
    getObjectPath,
    writeObject,
    readObject
};
