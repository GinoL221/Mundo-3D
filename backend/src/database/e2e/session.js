'use strict';

// Preparation-only helper. It checks one supplied connection; it does not
// establish resource ownership, prevent arbitrary callback behavior, or prove
// that the endpoint is the intended container. Supply a dedicated connection.
const IDENTITY_QUERY = 'SELECT @@server_uuid AS uuid, CONNECTION_ID() AS connectionId';
const UUID_PATTERN = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;

function parseIdentity(result) {
  if (!Array.isArray(result) || !Array.isArray(result[0]) || result[0].length !== 1) {
    throw new Error('Invalid MySQL session identity result');
  }
  const row = result[0][0];
  if (!row || typeof row.uuid !== 'string' || !UUID_PATTERN.test(row.uuid)) {
    throw new Error('Invalid MySQL server UUID');
  }
  const rawId = row.connectionId;
  if (!(typeof rawId === 'number' && Number.isSafeInteger(rawId) ||
        typeof rawId === 'string' && /^[1-9][0-9]*$/.test(rawId))) {
    throw new Error('Invalid MySQL connection ID');
  }
  const connectionId = Number(rawId);
  if (!Number.isSafeInteger(connectionId) || connectionId <= 0) {
    throw new Error('Invalid MySQL connection ID');
  }
  return { uuid: row.uuid.toLowerCase(), connectionId };
}

async function readIdentity(connection) {
  return parseIdentity(await connection.query(IDENTITY_QUERY));
}

async function withPinnedSession(connection, work, expectedIdentity) {
  if (!connection || typeof connection.end !== 'function') {
    throw new TypeError('A dedicated queryable connection, end method, and work callback are required');
  }
  let result;
  let failure;
  let failed = false;
  try {
    if (typeof connection.query !== 'function' || typeof work !== 'function') {
      throw new TypeError('A dedicated queryable connection, end method, and work callback are required');
    }
    const before = await readIdentity(connection);
    if (expectedIdentity && (before.uuid !== expectedIdentity.uuid.toLowerCase() ||
        expectedIdentity.connectionId !== undefined && before.connectionId !== Number(expectedIdentity.connectionId))) {
      throw new Error('MySQL session identity did not match verified endpoint');
    }
    result = await work(connection);
    const after = await readIdentity(connection);
    if (before.uuid !== after.uuid || before.connectionId !== after.connectionId) {
      throw new Error('MySQL session identity changed during work');
    }
  } catch (error) {
    failed = true;
    failure = error;
  }
  try {
    await connection.end();
  } catch (closeError) {
    failure = failed
      ? new AggregateError([failure, closeError], 'MySQL work failed and connection close failed')
      : closeError;
    failed = true;
  }
  if (failed) throw failure;
  return result;
}

module.exports = { IDENTITY_QUERY, parseIdentity, withPinnedSession };
