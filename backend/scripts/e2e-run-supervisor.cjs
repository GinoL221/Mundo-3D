'use strict';
const crypto = require('node:crypto');

function createE2ESupervisor({ dockerProvider, portFinder } = {}) {
  if (!dockerProvider || ['create', 'ready', 'cleanup'].some(name => typeof dockerProvider[name] !== 'function') ||
      typeof portFinder !== 'function') throw new TypeError('E2E supervisor dependencies are required');
  return Object.freeze({
    async run(work, { signal } = {}) {
      if (typeof work !== 'function') throw new TypeError('work callback is required');
      signal?.throwIfAborted();
      const runId = crypto.randomBytes(16).toString('hex');
      const resources = [];
      const errors = [];
      let result;
      try {
        const mysql = await dockerProvider.create({ kind: 'mysql', runId, signal });
        resources.push(mysql);
        const database = await dockerProvider.ready(mysql, signal);
        signal?.throwIfAborted();
        const mailpit = await dockerProvider.create({ kind: 'mailpit', runId, signal });
        resources.push(mailpit);
        const mail = await dockerProvider.ready(mailpit, signal);
        const backendPort = String(await portFinder());
        const frontendPort = String(await portFinder());
        if (backendPort === frontendPort) throw new Error('E2E app port allocation collided');
        signal?.throwIfAborted();
        const env = Object.freeze({
          NODE_ENV: 'test', M3D_E2E_RUN_ID: runId,
          M3D_E2E_EXPECTED_SERVER_UUID: database.serverUuid,
          DB_PORT: database.dbPort, DB_HOST: '127.0.0.1', DB_USER: 'root', DB_PASS: '',
          M3D_E2E_MAILPIT_CONTAINER_ID: mailpit.containerId,
          M3D_E2E_MAILPIT_HTTP_PORT: mail.httpPort,
          SMTP_HOST: '127.0.0.1', SMTP_PORT: mail.smtpPort,
          M3D_E2E_BACKEND_PORT: backendPort, M3D_E2E_FRONTEND_PORT: frontendPort,
          PUBLIC_API_URL: `http://localhost:${backendPort}`,
        });
        result = await work({ env, runId, signal });
      } catch (error) {
        errors.push(error);
      }
      // Cleanup is deliberately not given the aborted work signal. Every known
      // resource is attempted; errors cannot erase work failure or become PASS.
      for (const resource of resources.reverse()) {
        try { await dockerProvider.cleanup(resource); } catch (error) { errors.push(error); }
      }
      if (errors.length === 1) throw errors[0];
      if (errors.length > 1) throw new AggregateError(errors, 'E2E run/cleanup failed');
      return result;
    },
  });
}
module.exports = { createE2ESupervisor };
