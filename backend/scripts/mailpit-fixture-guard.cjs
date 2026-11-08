'use strict';

const { sanitizeMailpitOperation } = require('./refresh-mailpit-endpoint.cjs');

// Encapsulates Mailpit fixture interactions and enforces operation gating.
// No network call is made without explicit fetch implementation and runScope verification.
function createGuardedMailpitClient(options) {
  const { baseUrl, fetchImpl, runScope } = options || {};

  if (!baseUrl || typeof fetchImpl !== 'function') {
    throw new Error('Valid baseUrl and fetchImpl are required');
  }

  const cleanBase = baseUrl.replace(/\/$/, '');

  return Object.freeze({
    async clearMessages() {
      sanitizeMailpitOperation({
        operation: 'DELETE_ALL_MESSAGES',
        runScope,
      });

      const response = await fetchImpl(`${cleanBase}/api/v1/messages`, { method: 'DELETE' });
      if (!response.ok) {
        throw new Error(`Mailpit reset failed: ${response.status}`);
      }
      return { ok: true };
    },
  });
}

module.exports = { createGuardedMailpitClient };
