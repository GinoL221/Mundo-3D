'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createE2ESupervisor } = require('./e2e-run-supervisor.cjs');

test('runs full lifecycle: setup resources, runs target work with env, and cleans up cleanly', async () => {
  const events = [];
  const fakeDocker = {
    create: async () => { events.push('docker:create'); return { containerId: 'a'.repeat(64), volumeName: 'b'.repeat(64) }; },
    start: async (id) => { events.push(`docker:start:${id.slice(0, 4)}`); },
    readInternalUuid: async () => { events.push('docker:readUuid'); return '12345678-1234-1234-1234-123456789abc'; },
    stop: async (id) => { events.push(`docker:stop:${id.slice(0, 4)}`); },
    remove: async (id) => { events.push(`docker:remove:${id.slice(0, 4)}`); },
  };

  const supervisor = createE2ESupervisor({
    dockerProvider: fakeDocker,
    portFinder: async () => 33317,
  });

  let receivedEnv;
  const outcome = await supervisor.run(async (context) => {
    events.push('work:run');
    receivedEnv = context.env;
    return 'test-suite-ok';
  });

  assert.equal(outcome, 'test-suite-ok');
  assert.equal(receivedEnv.NODE_ENV, 'test');
  assert.equal(typeof receivedEnv.M3D_E2E_RUN_ID, 'string');
  assert.equal(receivedEnv.M3D_E2E_RUN_ID.length, 32);
  assert.equal(receivedEnv.M3D_E2E_EXPECTED_SERVER_UUID, '12345678-1234-1234-1234-123456789abc');
  assert.equal(receivedEnv.DB_PORT, '33317');

  assert.deepEqual(events, [
    'docker:create',
    'docker:start:aaaa',
    'docker:readUuid',
    'work:run',
    'docker:stop:aaaa',
    'docker:remove:aaaa',
  ]);
});

test('guarantees teardown if target work throws an error', async () => {
  const events = [];
  const fakeDocker = {
    create: async () => ({ containerId: 'a'.repeat(64), volumeName: 'b'.repeat(64) }),
    start: async () => {},
    readInternalUuid: async () => '12345678-1234-1234-1234-123456789abc',
    stop: async () => { events.push('docker:stop'); },
    remove: async () => { events.push('docker:remove'); },
  };

  const supervisor = createE2ESupervisor({
    dockerProvider: fakeDocker,
    portFinder: async () => 33317,
  });

  await assert.rejects(
    supervisor.run(async () => {
      throw new Error('E2E test suite failed');
    }),
    { message: 'E2E test suite failed' }
  );

  assert.deepEqual(events, ['docker:stop', 'docker:remove']);
});

test('aborts without invoking work and preserves candidates if creation is uncertain', async () => {
  const events = [];
  const fakeDocker = {
    create: async () => { throw new Error('Docker daemon timed out'); },
    stop: async () => { events.push('docker:stop'); },
    remove: async () => { events.push('docker:remove'); },
  };

  const supervisor = createE2ESupervisor({
    dockerProvider: fakeDocker,
    portFinder: async () => 33317,
  });

  let workCalled = false;
  await assert.rejects(
    supervisor.run(async () => { workCalled = true; }),
    { message: 'Docker daemon timed out' }
  );

  assert.equal(workCalled, false);
  assert.deepEqual(events, []); // No deletion attempted on failed creation
});
