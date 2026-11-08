'use strict';

const EXACT_RUN_ID = /^[a-f0-9]{32}$/;
const ALLOWED_OPERATIONS = new Set(['GET_MESSAGES', 'GET_CHAOS', 'SET_CHAOS', 'DELETE_ALL_MESSAGES']);

function parseStrictLoopbackUrl(url) {
  if (typeof url !== 'string' || !url.trim()) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:') return null;
    if (parsed.hostname !== '127.0.0.1' && parsed.hostname !== 'localhost') return null;
    if (parsed.username || parsed.password) return null;
    if (parsed.pathname !== '' && parsed.pathname !== '/') return null;
    if (parsed.search || parsed.hash) return null;
    const port = Number(parsed.port);
    if (!Number.isInteger(port) || port < 1 || port > 65535) return null;
    return `${parsed.protocol}//${parsed.hostname}:${port}`;
  } catch {
    return null;
  }
}

// Pure offline validator for Mailpit API endpoints.
// Requires an explicitly injected fetch implementation to prevent accidental network calls.
// Gates destructive actions behind strictly verified instance proof.
async function verifyMailpitEndpoint(options) {
  const { baseUrl, fetchImpl } = options || {};

  try {
    if (typeof fetchImpl !== 'function') {
      throw new Error('Explicit fetch implementation is required');
    }

    const cleanBaseUrl = parseStrictLoopbackUrl(baseUrl);
    if (!cleanBaseUrl) {
      throw new Error('Invalid Mailpit base URL');
    }

    const response = await fetchImpl(`${cleanBaseUrl}/api/v1/info`);
    if (!response || !response.ok || response.status !== 200) {
      throw new Error('Mailpit info request failed');
    }

    const data = await response.json();
    if (!data || typeof data.Version !== 'string' || !data.Version.trim()) {
      throw new Error('Mailpit info response malformed');
    }

    return Object.freeze({
      ok: true,
      version: data.Version,
      baseUrl: cleanBaseUrl,
    });
  } catch {
    throw new Error('Mailpit endpoint verification failed');
  }
}

function sanitizeMailpitOperation(request) {
  const { operation, runScope } = request || {};

  if (typeof operation !== 'string' || !ALLOWED_OPERATIONS.has(operation)) {
    throw new Error('Invalid or unauthorized Mailpit operation');
  }

  if (operation === 'DELETE_ALL_MESSAGES') {
    if (
      !runScope ||
      typeof runScope.runId !== 'string' ||
      !EXACT_RUN_ID.test(runScope.runId) ||
      runScope.verifiedInstance !== true
    ) {
      throw new Error('Unrestricted Mailpit deletion forbidden without verified dedicated instance');
    }
  }

  return Object.freeze({
    permitted: true,
    operation,
  });
}

module.exports = {
  verifyMailpitEndpoint,
  sanitizeMailpitOperation,
};
