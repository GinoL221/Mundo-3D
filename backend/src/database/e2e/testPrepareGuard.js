'use strict';

const EXACT_RUN_ID = /^[a-f0-9]{32}$/;
const EXACT_UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;

// Pure offline guard for test-prepare.js.
// Forbids database recreation and seeding unless explicit E2E run evidence,
// environment checks, and database server UUID verification all match.
function assertTestPrepareAuthorized(options) {
  const { env = process.env, observedServerUuid } = options || {};

  if (env.NODE_ENV !== 'test') {
    throw new Error('Database preparation forbidden: NODE_ENV must be test');
  }

  const runId = env.M3D_E2E_RUN_ID;
  if (typeof runId !== 'string' || !EXACT_RUN_ID.test(runId)) {
    throw new Error('Database preparation forbidden: valid M3D_E2E_RUN_ID is required');
  }

  const expectedUuid = env.M3D_E2E_EXPECTED_SERVER_UUID;
  if (typeof expectedUuid !== 'string' || !EXACT_UUID.test(expectedUuid)) {
    throw new Error('Database preparation forbidden: database endpoint UUID mismatch');
  }

  if (
    typeof observedServerUuid !== 'string' ||
    observedServerUuid.toLowerCase() !== expectedUuid.toLowerCase()
  ) {
    throw new Error('Database preparation forbidden: database endpoint UUID mismatch');
  }

  return Object.freeze({
    authorized: true,
    runId,
    serverUuid: expectedUuid.toLowerCase(),
  });
}

module.exports = { assertTestPrepareAuthorized };
