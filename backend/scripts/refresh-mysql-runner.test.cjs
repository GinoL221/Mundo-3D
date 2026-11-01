'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { runPreparation } = require('./refresh-mysql-runner.cjs');

const identity = Object.freeze({ runId: 'a'.repeat(32), containerName: 'm3d-refresh-test-a', volumeName: 'm3d-refresh-test-a', port: '33317', imageId: `sha256:${'b'.repeat(64)}` });
function adapters(overrides = {}) {
  const events = [];
  const connection = { async query() { events.push('query'); return [[{ uuid: '12345678-1234-1234-1234-123456789abc', connectionId: 7 }], []]; }, async end() { events.push('close'); } };
  return { events, connection, ops: {
    async create() { events.push('create'); return { containerId: 'c'.repeat(64), volumeId: 'd'.repeat(64) }; },
    async inspectContainer(id) { events.push(`inspect-container:${id}`); return { id, ...identity }; },
    async inspectVolume(id) { events.push(`inspect-volume:${id}`); return { id, name: identity.volumeName, runId: identity.runId }; },
    async connect() { events.push('connect'); return connection; },
    async verifyEndpoint() { events.push('endpoint'); return { uuid: '12345678-1234-1234-1234-123456789abc' }; },
    async work() { events.push('work'); },
    async removeContainer(id) { events.push(`remove-container:${id}`); },
    async removeVolume(id) { events.push(`remove-volume:${id}`); },
    ...overrides,
  } };
}

test('creation-result IDs and exact identities gate work; session closes and cleanup remains explicit', async () => {
  const { ops, events } = adapters();
  const result = await runPreparation(identity, ops);
  assert.ok(events.indexOf('work') > events.indexOf(`inspect-volume:${'d'.repeat(64)}`));
  assert.ok(events.indexOf('close') < events.lastIndexOf(`inspect-container:${'c'.repeat(64)}`));
  assert.equal(result.cleanupRequired, true);
  assert.equal(events.some(event => event.startsWith('remove-')), false);
});

test('uncertain creation preserves evidence and never inspects or deletes', async () => {
  const { ops, events } = adapters({ async create() { events.push('create'); throw new Error('creation uncertain'); } });
  await assert.rejects(runPreparation(identity, ops), /creation uncertain/);
  assert.deepEqual(events, ['create']);
});

test('identity drift fails closed without work or deletion', async () => {
  const { ops, events } = adapters({ async inspectContainer(id) { events.push(`inspect-container:${id}`); return { id: 'e'.repeat(64), ...identity }; } });
  await assert.rejects(runPreparation(identity, ops), /identity/i);
  assert.equal(events.includes('work'), false);
  assert.equal(events.some(event => event.startsWith('remove-')), false);
});

test('work errors close connection and preserve resources for explicit cleanup authorization', async () => {
  const { ops, events } = adapters({ async work() { events.push('work'); throw new Error('work failed'); } });
  await assert.rejects(runPreparation(identity, ops), /work failed/);
  assert.ok(events.includes('close'));
  assert.equal(events.some(event => event.startsWith('remove-')), false);
});

test('post-work identity drift preserves all resources', async () => {
  let workCompleted = false;
  const { ops, events } = adapters({
    async work() { events.push('work'); workCompleted = true; },
    async inspectContainer(id) { events.push(`inspect-container:${id}`); return workCompleted ? { id: 'e'.repeat(64), ...identity } : { id, ...identity }; },
  });
  await assert.rejects(runPreparation(identity, ops), /identity/i);
  assert.ok(events.indexOf('work') > -1);
  assert.equal(events.some(event => event.startsWith('remove-')), false);
});

test('endpoint/session UUID mismatch closes before database work', async () => {
  const { ops, events } = adapters({ async verifyEndpoint() { events.push('endpoint'); return { uuid: '87654321-1234-1234-1234-123456789abc' }; } });
  await assert.rejects(runPreparation(identity, ops), /verified endpoint/i);
  assert.equal(events.includes('work'), false);
  assert.equal(events.at(-1), 'close');
  assert.equal(events.some(event => event.startsWith('remove-')), false);
});

test('configuration mutation during creation cannot redirect verification baseline', async () => {
  const mutable = { ...identity };
  let seen;
  const { ops } = adapters({ async create(snapshot) { seen = snapshot; mutable.containerName = 'm3d-refresh-test-redirected'; return { containerId: 'c'.repeat(64), volumeId: 'd'.repeat(64) }; } });
  await runPreparation(mutable, ops);
  assert.notEqual(seen, mutable);
  assert.equal(Object.isFrozen(seen), true);
  assert.equal(seen.containerName, identity.containerName);
});

test('endpoint identity mutation during resource inspection cannot redirect session binding', async () => {
  const endpoint = { uuid: '12345678-1234-1234-1234-123456789abc' };
  let inspections = 0;
  const { ops, events } = adapters({
    async verifyEndpoint() { events.push('endpoint'); return endpoint; },
    async inspectContainer(id) {
      events.push(`inspect-container:${id}`);
      inspections++;
      if (inspections === 2) endpoint.uuid = '87654321-1234-1234-1234-123456789abc';
      return { id, ...identity };
    },
  });
  await runPreparation(identity, ops);
  assert.ok(events.includes('work'));
});

test('invalid config is rejected before any adapter call', async () => {
  const { ops, events } = adapters();
  await assert.rejects(runPreparation({ ...identity, port: '33317\n' }, ops), TypeError);
  assert.deepEqual(events, []);
});

test('pre-session failure and close failure are both preserved', async () => {
  const { ops, events, connection } = adapters({ async verifyEndpoint() { events.push('endpoint'); throw new Error('primary failure'); } });
  connection.end = async () => { events.push('close'); throw new Error('close failure'); };
  await assert.rejects(runPreparation(identity, ops), error => {
    assert.ok(error instanceof AggregateError);
    assert.deepEqual(error.errors.map(item => item.message), ['primary failure', 'close failure']);
    return true;
  });
  assert.equal(events.includes('work'), false);
});
