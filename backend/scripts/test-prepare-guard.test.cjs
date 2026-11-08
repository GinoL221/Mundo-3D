'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { assertTestPrepareAuthorized } = require('./test-prepare-guard.cjs');

const validRunId = 'a'.repeat(32);
const validServerUuid = '12345678-1234-1234-1234-123456789abc';

test('authorizes preparation when explicit runId, verified serverUuid, and test environment match', () => {
  const result = assertTestPrepareAuthorized({
    env: {
      NODE_ENV: 'test',
      M3D_E2E_RUN_ID: validRunId,
      M3D_E2E_EXPECTED_SERVER_UUID: validServerUuid,
    },
    observedServerUuid: validServerUuid,
  });

  assert.equal(result.authorized, true);
  assert.equal(result.runId, validRunId);
});

test('forbids preparation if NODE_ENV is not test', () => {
  for (const envVal of ['development', 'production', '', undefined]) {
    assert.throws(
      () => assertTestPrepareAuthorized({
        env: {
          NODE_ENV: envVal,
          M3D_E2E_RUN_ID: validRunId,
          M3D_E2E_EXPECTED_SERVER_UUID: validServerUuid,
        },
        observedServerUuid: validServerUuid,
      }),
      { message: 'Database preparation forbidden: NODE_ENV must be test' }
    );
  }
});

test('forbids preparation if M3D_E2E_RUN_ID is absent or malformed', () => {
  for (const badRunId of [undefined, null, '', 'short', validRunId + 'extra', 123]) {
    assert.throws(
      () => assertTestPrepareAuthorized({
        env: {
          NODE_ENV: 'test',
          M3D_E2E_RUN_ID: badRunId,
          M3D_E2E_EXPECTED_SERVER_UUID: validServerUuid,
        },
        observedServerUuid: validServerUuid,
      }),
      { message: 'Database preparation forbidden: valid M3D_E2E_RUN_ID is required' }
    );
  }
});

test('forbids preparation if observed server UUID does not match expected UUID', () => {
  assert.throws(
    () => assertTestPrepareAuthorized({
      env: {
        NODE_ENV: 'test',
        M3D_E2E_RUN_ID: validRunId,
        M3D_E2E_EXPECTED_SERVER_UUID: validServerUuid,
      },
      observedServerUuid: '87654321-1234-1234-1234-123456789abc',
    }),
    { message: 'Database preparation forbidden: database endpoint UUID mismatch' }
  );

  assert.throws(
    () => assertTestPrepareAuthorized({
      env: {
        NODE_ENV: 'test',
        M3D_E2E_RUN_ID: validRunId,
        M3D_E2E_EXPECTED_SERVER_UUID: validServerUuid,
      },
      observedServerUuid: undefined,
    }),
    { message: 'Database preparation forbidden: database endpoint UUID mismatch' }
  );
});
