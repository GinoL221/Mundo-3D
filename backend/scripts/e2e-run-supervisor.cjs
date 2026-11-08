'use strict';
const crypto = require('node:crypto');

// E2E run supervisor.
// Orchestrates ephemeral resource creation, extracts real server provenance,
// exports run-isolated environment variables, executes the target work callback,
// and guarantees safe teardown without leaving orphaned resources.
function createE2ESupervisor(dependencies) {
  const { dockerProvider, portFinder } = dependencies || {};

  if (!dockerProvider || typeof dockerProvider.create !== 'function') {
    throw new TypeError('dockerProvider with create/start/readInternalUuid/stop/remove is required');
  }

  return Object.freeze({
    async run(work) {
      if (typeof work !== 'function') {
        throw new TypeError('work callback is required');
      }

      const runId = crypto.randomBytes(16).toString('hex');
      const port = portFinder ? await portFinder() : 3306;

      let containerId = null;
      let confirmedResource = false;

      try {
        const creation = await dockerProvider.create({ runId, port: String(port) });
        containerId = creation?.containerId;
        confirmedResource = true;

        await dockerProvider.start(containerId);
        const serverUuid = await dockerProvider.readInternalUuid(containerId);

        const isolatedEnv = Object.freeze({
          NODE_ENV: 'test',
          M3D_E2E_RUN_ID: runId,
          M3D_E2E_EXPECTED_SERVER_UUID: serverUuid,
          DB_PORT: String(port),
          DB_HOST: '127.0.0.1',
        });

        return await work({ env: isolatedEnv, runId, serverUuid });
      } finally {
        if (confirmedResource && containerId) {
          try {
            await dockerProvider.stop(containerId);
          } finally {
            await dockerProvider.remove(containerId);
          }
        }
      }
    },
  });
}

module.exports = { createE2ESupervisor };
