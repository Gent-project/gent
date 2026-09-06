const apiClient = require('../utils/api-client');
const { API_ENDPOINTS } = require('../utils/constants');

async function gitToken(action = 'list', id, options = {}) {
    if (action === 'list') {
        const tokens = await apiClient.get(API_ENDPOINTS.GIT_TOKENS);
        if (!tokens.length) {
            console.log('No Git access tokens.');
            return;
        }
        for (const token of tokens) {
            const scope = token.repository_id ? `repository ${token.repository_id}` : 'all accessible repositories';
            const access = token.can_write ? 'read/write' : 'read-only';
            console.log(`${token.id}\t${token.name}\t${access}\t${scope}\t${token.expires_at || 'no expiry'}`);
        }
        return;
    }
    if (action === 'create') {
        const payload = {
            name: options.name || 'Git client',
            can_write: Boolean(options.write),
        };
        if (options.repository !== undefined) payload.repository_id = Number(options.repository);
        if (options.expiresDays !== undefined) payload.expires_days = Number(options.expiresDays);
        const token = await apiClient.post(API_ENDPOINTS.GIT_TOKENS, payload);
        console.log(`Username: ${token.username}`);
        console.log(`Token: ${token.token}`);
        console.log('The token is shown once. Use it as the HTTPS password in Git clients.');
        return;
    }
    if (action === 'revoke') {
        const tokenId = Number(id);
        if (!Number.isInteger(tokenId) || tokenId <= 0) throw new Error('usage: gent git-token revoke <id>');
        await apiClient.delete(`${API_ENDPOINTS.GIT_TOKENS}${tokenId}/`);
        console.log(`Revoked Git access token ${tokenId}.`);
        return;
    }
    throw new Error('use gent git-token list|create|revoke');
}

module.exports = gitToken;
