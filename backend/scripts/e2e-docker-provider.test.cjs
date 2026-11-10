'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createDockerProvider, execDocker, timeoutFor } = require('./e2e-docker-provider.cjs');
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
  const create = h.calls.find(call => call[0] === 'create');
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

test('image pulls get their own long timeout instead of the 30s create budget', () => {
  assert.equal(timeoutFor(['create']), 30_000);
  assert.equal(timeoutFor(['stop', ID]), 30_000);
  assert.ok(timeoutFor(['pull', 'image']) >= 300_000);
});

test('a missing image is pulled before create; a present image is never pulled', async () => {
  const h = harness();
  const missing = createDockerProvider({ readinessAttempts: 1, exec: async (args) => {
    h.calls.push(args);
    if (args[0] === 'image' && args[1] === 'inspect') throw new Error('absent');
    if (args[0] === 'create') return `${ID}\n`;
    if (args[0] === 'inspect') return JSON.stringify([h.inspected]);
    return '';
  } });
  await missing.create({ kind: 'mysql', runId: RUN });
  assert.deepEqual(h.calls.map(call => call[0] === 'image' ? 'image-inspect' : call[0]), ['image-inspect', 'pull', 'create', 'inspect']);
  assert.equal(h.calls[1][1], MYSQL_IMAGE);
  const present = harness();
  await present.provider.create({ kind: 'mysql', runId: RUN });
  assert.equal(present.calls.some(call => call[0] === 'pull'), false);
});

test('Docker failures keep a bounded, single-line diagnosis and the original cause', async () => {
  const failure = Object.assign(new Error('Command failed'), { code: 125,
    stderr: `Error response from daemon: no such container: ${ID}\n${'x'.repeat(500)}` });
  await assert.rejects(execDocker(['stop', ID], undefined, async () => { throw failure; }), error => {
    assert.match(error.message, /^E2E Docker stop failed \(exit 125\): Error response from daemon: no such container/);
    assert.ok(error.message.length <= 320);
    assert.equal(error.message.includes('\n'), false);
    assert.equal(error.cause, failure);
    return true;
  });
  await assert.rejects(execDocker(['stop', ID], undefined, async () => { throw new Error('timeout'); }),
    /^Error: E2E Docker stop failed$/);
});

test('pull failure produces the pull diagnostic, not the container creation diagnostic', async () => {
  const provider = createDockerProvider({
    exec: async (args) => {
      if (args[0] === 'image' && args[1] === 'inspect') throw new Error('absent');
      if (args[0] === 'pull') throw new Error('E2E Docker pull failed (exit 1): network timeout');
      return '';
    },
  });
  await assert.rejects(
    provider.create({ kind: 'mysql', runId: RUN }),
    /^Error: E2E Docker pull failed \(exit 1\): network timeout$/,
  );
});

