'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createDockerProvider } = require('./e2e-docker-provider.cjs');
const { MYSQL_IMAGE } = require('./e2e-resource-binding.cjs');
const ID = 'a'.repeat(64), RUN = 'b'.repeat(32), VOLUME = 'c'.repeat(64);
function harness() {
  const calls = [];
  const inspected = { Id: ID, Name: `/m3d-e2e-mysql-${RUN}`,
    Config: { Image: MYSQL_IMAGE, Labels: { 'm3d.e2e.run': RUN, 'm3d.e2e.kind': 'mysql' } },
    State: { Running: false }, Mounts: [{ Type: 'volume', Destination: '/var/lib/mysql', RW: true, Name: VOLUME }] };
  const faults = {};
  let tcpUp = true;
  const provider = createDockerProvider({ readinessAttempts: 2, tcpProbe: async () => { if (!tcpUp) throw new Error('refused'); }, exec: async (args) => {
    calls.push(args);
    if (faults[args[0]]) throw new Error('synthetic failure');
    if (args[0] === 'create') return `${ID}\n`;
    if (args[0] === 'inspect') return JSON.stringify([inspected]);
    if (args[0] === 'container' || args[0] === 'volume') return '';
    return '';
  } });
  return { calls, inspected, faults, provider, setTcpUp: (value) => { tcpUp = value; } };
}

test('creates exact labelled anonymous-volume container; cleanup rechecks ownership and absence', async () => {
  const h = harness();
  const record = await h.provider.create({ kind: 'mysql', runId: RUN });
  assert.equal(record.containerId, ID);
  assert.equal(record.volumeName, VOLUME);
  const create = h.calls[0];
  assert.ok(create.includes('127.0.0.1::3306'));
  assert.ok(create.includes('type=volume,dst=/var/lib/mysql'));
  assert.ok(create.includes(`m3d.e2e.run=${RUN}`));
  h.calls.length = 0;
  await h.provider.cleanup(record);
  assert.deepEqual(h.calls.map(call => call[0]), ['inspect', 'stop', 'inspect', 'rm', 'container', 'volume']);
  assert.deepEqual(h.calls.find(call => call[0] === 'rm'), ['rm', '-v', ID]);
  assert.equal(h.calls.some(call => call.includes('prune') || call.includes('--force')), false);
});

test('uncertain creation and forged records cannot authorize deletion', async () => {
  const h = harness(); h.inspected.Id = 'd'.repeat(64);
  await assert.rejects(h.provider.create({ kind: 'mysql', runId: RUN }), /E2E creation uncertain/);
  h.calls.length = 0;
  await assert.rejects(h.provider.cleanup({ containerId: ID, kind: 'mysql', runId: RUN }), /Unowned E2E resource/);
  assert.deepEqual(h.calls, []);
});

test('ownership drift preserves resource without any stop or removal', async () => {
  const h = harness();
  const record = await h.provider.create({ kind: 'mysql', runId: RUN });
  h.inspected.Config.Labels['m3d.e2e.run'] = 'd'.repeat(32); h.calls.length = 0;
  await assert.rejects(h.provider.cleanup(record), /E2E resource binding rejected/);
  assert.deepEqual(h.calls.map(call => call[0]), ['inspect']);
});

test('MySQL readiness requires the published TCP endpoint, not only the local socket', async () => {
  const h = harness(); const record = await h.provider.create({ kind: 'mysql', runId: RUN });
  h.setTcpUp(false);
  await assert.rejects(h.provider.ready(record), /readiness failed for run/);
});

test('cancellation during creation preserves the cancellation instead of becoming a failure', async () => {
  const controller = new AbortController(); controller.abort(new Error('cancelled by SIGINT'));
  const provider = createDockerProvider({ exec: async () => { throw new Error('aborted'); } });
  await assert.rejects(provider.create({ kind: 'mysql', runId: RUN, signal: controller.signal }), error => {
    assert.equal(error.message, 'E2E creation cancelled');
    assert.ok(error.errors[1].message.includes('preserve candidate m3d-e2e-mysql-'));
    return true;
  });
});

test('failed stop is observable and cannot silently become successful cleanup', async () => {
  const h = harness();
  const record = await h.provider.create({ kind: 'mysql', runId: RUN });
  h.faults.stop = true; h.calls.length = 0;
  await assert.rejects(h.provider.cleanup(record), /synthetic failure/);
  assert.deepEqual(h.calls.map(call => call[0]), ['inspect', 'stop']);
});
