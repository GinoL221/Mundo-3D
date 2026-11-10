'use strict';
const { IDENTITY_QUERY, parseIdentity } = require('./session');

const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}(?![\s\S])/i;

// Offline comparison only. The expected UUID must come from a separately
// trusted source; matching it does not prove ownership or authorize mutation.
async function verifyEndpoint(connection, expectedUuid) {
  try {
    if (typeof expectedUuid !== 'string' || !UUID.test(expectedUuid) ||
        !connection || typeof connection.query !== 'function') {
      throw new Error('Invalid input');
    }
    const identity = parseIdentity(await connection.query(IDENTITY_QUERY));
    if (identity.uuid !== expectedUuid.toLowerCase()) throw new Error('Identity mismatch');
    return identity;
  } catch {
    throw new Error('MySQL endpoint verification failed');
  }
}

module.exports = { verifyEndpoint };
