'use strict';
const { withPinnedSession } = require('./refresh-mysql-session.cjs');

const ID = /^[a-f0-9]{64}(?![\s\S])/;
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}(?![\s\S])/i;

function assertContainer(observed, id, config) {
  if (!observed || observed.id !== id || observed.containerName !== config.containerName ||
      observed.volumeName !== config.volumeName || observed.port !== config.port ||
      observed.imageId !== config.imageId || observed.runId !== config.runId) {
    throw new Error('Container identity verification failed');
  }
}
function assertVolume(observed, id, config) {
  if (!observed || observed.id !== id || observed.name !== config.volumeName || observed.runId !== config.runId) {
    throw new Error('Volume identity verification failed');
  }
}

// This is an injected-adapter preparation executor, not a CLI. No adapter or
// resource operation is selected here; callers must provide explicit offline
// or separately authorized implementations.
async function runPreparation(config, ops) {
  const snapshot = config !== null && typeof config === 'object'
    ? Object.freeze({ ...config })
    : config;
  const exact = (pattern, value) => typeof value === 'string' && pattern.test(value);
  if (!snapshot || Object.keys(snapshot).sort().join(',') !== 'containerName,imageId,port,runId,volumeName' ||
      !exact(/^[a-f0-9]{32}(?![\s\S])/, snapshot.runId) ||
      !exact(/^m3d-refresh-test-[a-z0-9-]+(?![\s\S])/, snapshot.containerName) ||
      !exact(/^m3d-refresh-test-[a-z0-9-]+(?![\s\S])/, snapshot.volumeName) ||
      !exact(/^[1-9][0-9]{0,4}(?![\s\S])/, snapshot.port) || Number(snapshot.port) > 65535 ||
      !exact(/^sha256:[a-f0-9]{64}(?![\s\S])/, snapshot.imageId) || !ops ||
      ['create', 'inspectContainer', 'inspectVolume', 'connect', 'verifyEndpoint', 'work', 'removeContainer', 'removeVolume'].some(name => typeof ops[name] !== 'function')) {
    throw new TypeError('Invalid preparation configuration or adapters');
  }

  // On an ambiguous creation result, retain evidence and never guess IDs.
  const created = await ops.create(snapshot);
  const containerId = created?.containerId;
  const volumeId = created?.volumeId;
  if (typeof containerId !== 'string' || !ID.test(containerId) ||
      typeof volumeId !== 'string' || !ID.test(volumeId)) throw new Error('Creation result identity invalid; resources preserved');

  const verifyResources = async () => {
    assertContainer(await ops.inspectContainer(containerId), containerId, snapshot);
    assertVolume(await ops.inspectVolume(volumeId), volumeId, snapshot);
  };
  await verifyResources();
  const connection = await ops.connect(snapshot);
  let sessionOwnsClose = false;
  try {
    const endpointResult = await ops.verifyEndpoint(connection);
    const expected = endpointResult !== null && typeof endpointResult === 'object'
      ? Object.freeze({ uuid: endpointResult.uuid, connectionId: endpointResult.connectionId })
      : endpointResult;
    if (!expected || typeof expected.uuid !== 'string' || !UUID.test(expected.uuid) ||
        (expected.connectionId !== undefined && !(Number.isSafeInteger(expected.connectionId) && expected.connectionId > 0 ||
          typeof expected.connectionId === 'string' && /^[1-9][0-9]*(?![\s\S])/.test(expected.connectionId)))) {
      throw new Error('MySQL endpoint identity verification failed');
    }
    const expectedIdentity = Object.freeze({ uuid: expected.uuid.toLowerCase(), connectionId: expected.connectionId });
    await verifyResources();
    sessionOwnsClose = true;
    await withPinnedSession(connection, async pinned => {
      // The pinned helper probes the same connection before and after work.
      await ops.work(pinned);
    }, expectedIdentity);
  } catch (error) {
    // withPinnedSession owns close after entry. If failure happened before entry,
    // close explicitly; adapters must not reconnect or substitute a session.
    if (!sessionOwnsClose && connection && typeof connection.end === 'function') {
      try {
        await connection.end();
      } catch (closeError) {
        throw new AggregateError([error, closeError], 'MySQL endpoint verification and connection close failed', { cause: error });
      }
    }
    throw error;
  }

  // Intentional fail-closed boundary: no deletion is attempted. The available
  // evidence cannot establish race-free ownership across destructive calls.
  await verifyResources();
  return Object.freeze({ containerId, volumeId, cleanupRequired: true });
}

module.exports = { runPreparation };
