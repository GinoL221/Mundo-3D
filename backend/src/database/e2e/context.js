'use strict';
const { verifyEndpoint } = require('./endpoint');
const { assertTestPrepareAuthorized } = require('./testPrepareGuard');
const RUN_ID = /^[a-f0-9]{32}(?![\s\S])/;
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}(?![\s\S])/i;
const PORT = /^[1-9][0-9]{0,4}(?![\s\S])/;

// Context parsing is not ownership evidence. The supervisor must independently
// bind these values to its created resource. A partial context must never fall
// back to the ordinary operator-provided integration database path.
function readE2EDatabaseContext(env, { required = false } = {}) {
  const present = Object.keys(env).some((key) => key.startsWith('M3D_E2E_'));
  if (!required && !present) return null;
  if (env.NODE_ENV !== 'test' || !RUN_ID.test(env.M3D_E2E_RUN_ID || '') ||
      !UUID.test(env.M3D_E2E_EXPECTED_SERVER_UUID || '') ||
      env.DB_HOST !== '127.0.0.1' || !PORT.test(env.DB_PORT || '') ||
      Number(env.DB_PORT) > 65535) {
    throw Object.assign(new Error('E2E database context rejected'), { code: 'E2E_CONTEXT_REJECTED' });
  }
  return Object.freeze({
    NODE_ENV: 'test', M3D_E2E_RUN_ID: env.M3D_E2E_RUN_ID,
    M3D_E2E_EXPECTED_SERVER_UUID: env.M3D_E2E_EXPECTED_SERVER_UUID,
    DB_HOST: env.DB_HOST, DB_PORT: env.DB_PORT,
  });
}

async function verifyE2EConnection(connection, context) {
  const queryable = typeof connection.promise === 'function' ? connection.promise() : connection;
  const identity = await verifyEndpoint(queryable, context.M3D_E2E_EXPECTED_SERVER_UUID);
  assertTestPrepareAuthorized({ env: context, observedServerUuid: identity.uuid });
}

function protectE2EConnections(sequelize, context) {
  if (!context) return;
  sequelize.addHook('afterConnect', async (connection) => {
    try {
      await verifyE2EConnection(connection, context);
    } catch (error) {
      // Sequelize does not own a pool entry yet when afterConnect rejects.
      // Discard the physical connection rather than leaking/reusing it.
      connection.destroy();
      throw error;
    }
  });
}

module.exports = { readE2EDatabaseContext, verifyE2EConnection, protectE2EConnections };
