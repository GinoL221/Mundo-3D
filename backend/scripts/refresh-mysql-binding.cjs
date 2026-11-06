'use strict';
const { verifyContainer } = require('./refresh-mysql-identity.cjs');

// Offline orchestration prototype only: injected operations and expected values
// are not evidence of resource ownership. Never use this to authorize a run.
async function bindIdentity(captured, ops, connection) {
  const expected = Object.freeze({ id: captured?.id, image: captured?.image, run: captured?.run, volume: captured?.volume, port: captured?.port });
  const fail = () => { throw new Error('Identity verification failed'); };
  if (typeof expected.id !== 'string' || !/^[a-f0-9]{64}(?![\s\S])/.test(expected.id)) fail();
  if (!verifyContainer(await ops.inspect(expected.id), expected)) fail();
  const internalUuid = await ops.containerUuid(expected.id);
  if (typeof internalUuid !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}(?![\s\S])/.test(internalUuid)) fail();
  if (connection === null || typeof connection !== 'object') fail();
  if (await ops.endpointUuid(connection) !== internalUuid) fail();
  if (!verifyContainer(await ops.inspect(expected.id), expected)) fail();
  return ops.work(connection);
}
module.exports = { bindIdentity };
