'use strict';
const { assertResourceBinding } = require('./e2e-resource-binding.cjs');
const { inspectContainer } = require('./e2e-docker-provider.cjs');

// Live daemon binding, not a caller-supplied verifiedInstance boolean. Both
// protocol ports must belong to the exact container/run before every request.
function createOwnedMailpitClient({ env, inspect = inspectContainer, fetchImpl } = {}) {
  const record = Object.freeze({ runId: env?.M3D_E2E_RUN_ID,
    containerId: env?.M3D_E2E_MAILPIT_CONTAINER_ID, kind: 'mailpit' });
  const httpPort = env?.M3D_E2E_MAILPIT_HTTP_PORT;
  const smtpPort = env?.SMTP_PORT;
  if (!/^[a-f0-9]{32}(?![\s\S])/.test(record.runId || '') ||
      !/^[a-f0-9]{64}(?![\s\S])/.test(record.containerId || '') ||
      !/^[1-9][0-9]{0,4}(?![\s\S])/.test(httpPort || '') || Number(httpPort) > 65535 ||
      !/^[1-9][0-9]{0,4}(?![\s\S])/.test(smtpPort || '') || Number(smtpPort) > 65535 ||
      env.SMTP_HOST !== '127.0.0.1' || typeof fetchImpl !== 'function') {
    throw new Error('Mailpit context rejected');
  }
  return Object.freeze({
    async request(route, options = {}) {
      const method = options.method || 'GET';
      const allowed = route === 'messages' ? ['GET', 'DELETE'] : route === 'chaos' ? ['GET', 'PUT']
        : route === 'info' || /^message\/[a-zA-Z0-9-]+(?![\s\S])/.test(route) ? ['GET'] : [];
      if (!allowed.includes(method)) throw new Error('Mailpit operation rejected');
      try {
        const binding = assertResourceBinding(record, await inspect(record.containerId), true);
        if (binding.httpPort !== httpPort || binding.smtpPort !== smtpPort) throw new Error('Endpoint changed');
      } catch {
        throw new Error('Mailpit binding rejected');
      }
      const response = await fetchImpl(`http://127.0.0.1:${httpPort}/api/v1/${route}`, {
        ...options, method, redirect: 'error', signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) throw new Error(`Mailpit request failed: ${response.status}`);
      return response;
    },
  });
}
module.exports = { createOwnedMailpitClient };
