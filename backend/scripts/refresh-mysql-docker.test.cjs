'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createDockerAdapter, simulateAnonymousCreation } = require('./refresh-mysql-docker.cjs');

const config = { containerName: 'm3d-refresh-test-a', runId: 'a'.repeat(32), port: '33317', imageId: `sha256:${'b'.repeat(64)}` };
const containerId = 'c'.repeat(64);
const volumeName = 'd'.repeat(64);
function inspection() {
  return { Id: containerId, Name: '/m3d-refresh-test-a', Image: config.imageId, Config: { Labels: { 'm3d.refresh.run': config.runId } }, HostConfig: { NetworkMode: 'bridge', PortBindings: { '3306/tcp': [{ HostIp: '127.0.0.1', HostPort: config.port }] } }, Mounts: [{ Type: 'volume', Name: volumeName, Destination: '/var/lib/mysql', RW: true }] };
}
const ok = stdout => ({ code: 0, stderr: '', stdout });

test('simulates anonymous creation using captured container ID and inspected volume', () => {
  const result = simulateAnonymousCreation(config, [ok(`${containerId}\n`), ok(JSON.stringify([inspection()]))]);
  assert.deepEqual(result.evidence, { containerId, volumeName });
  assert.deepEqual(result.calls, [
    ['create', '--name', config.containerName, '--label', `m3d.refresh.run=${config.runId}`, '--network', 'bridge', '--publish', `127.0.0.1:${config.port}:3306`, '--mount', 'type=volume,dst=/var/lib/mysql', config.imageId],
    ['inspect', '--type', 'container', containerId],
  ]);
});

test('simulation retains only confirmed evidence on uncertain results', () => {
  for (const bad of [ok(`${containerId}\nextra\n`), { code: 1, stderr: '', stdout: `${containerId}\n` }, { code: 0, stderr: 'warning', stdout: `${containerId}\n` }]) {
    assert.throws(() => simulateAnonymousCreation(config, [bad]), error => error.evidence.containerId === null && error.evidence.volumeName === null);
  }
  for (const raw of [{ ...inspection(), Id: 'e'.repeat(64) }, { ...inspection(), Mounts: [...inspection().Mounts, inspection().Mounts[0]] }, { ...inspection(), Image: 'wrong' }]) {
    assert.throws(() => simulateAnonymousCreation(config, [ok(`${containerId}\n`), ok(JSON.stringify([raw]))]), error => error.evidence.containerId === containerId && error.evidence.volumeName === null);
  }
});

test('untrusted candidates survive failed creation and inspection drift without authorizing action', () => {
  for (const created of [{ code: 1, stderr: '', stdout: `${containerId}\n` }, { code: 0, stderr: 'warning', stdout: `${containerId}\n` }]) {
    assert.throws(() => simulateAnonymousCreation(config, [created]), error => {
      assert.deepEqual(error.untrustedCandidates, { containerIds: [containerId], volumeNames: [] });
      assert.equal(error.evidence.containerId, null);
      assert.equal(error.calls.length, 1);
      return true;
    });
  }
  for (const response of [ok(JSON.stringify([{ ...inspection(), Image: 'different' }])), { code: 1, stderr: 'failed', stdout: JSON.stringify([inspection()]) }]) {
    assert.throws(() => simulateAnonymousCreation(config, [ok(`${containerId}\n`), response]), error => {
      assert.deepEqual(error.untrustedCandidates, { containerIds: [containerId], volumeNames: [volumeName] });
      assert.equal(error.evidence.volumeName, null);
      return true;
    });
  }
});

test('anonymous volume name can be inspected without asserting ownership', async () => {
  const calls = [];
  const adapter = createDockerAdapter(async args => { calls.push(args); return ok(JSON.stringify([{ Name: volumeName, Labels: {} }])); });
  assert.deepEqual(await adapter.inspectVolume(volumeName), { id: volumeName, name: volumeName, runId: undefined });
  assert.deepEqual(calls, [['volume', 'inspect', volumeName]]);
});

test('requires an explicitly supplied executor and never defaults to Docker', () => {
  assert.throws(() => createDockerAdapter(), /executor is required/i);
});

test('creation fails closed before executor invocation without trusted freshness proof', async () => {
  let calls = 0;
  const adapter = createDockerAdapter(async () => { calls++; throw new Error('must not execute'); });
  await assert.rejects(adapter.create({ containerName: 'm3d-refresh-test-a', volumeName: 'm3d-refresh-test-a', runId: 'a'.repeat(32), port: '33317', imageId: `sha256:${'b'.repeat(64)}` }), /freshness proof/i);
  assert.equal(calls, 0);
});

test('inspection uses exact argv and realistic named-volume identity', async () => {
  const calls = [];
  const adapter = createDockerAdapter(async args => {
    calls.push(args);
    if (args[0] === 'inspect') return { code: 0, stdout: JSON.stringify([{ Id: 'c'.repeat(64), Name: '/m3d-refresh-test-a', Image: `sha256:${'b'.repeat(64)}`, State: { Running: true }, HostConfig: { NetworkMode: 'bridge' }, Config: { Labels: { 'm3d.refresh.run': 'a'.repeat(32) } }, Mounts: [{ Type: 'volume', Name: 'm3d-refresh-test-a', Destination: '/var/lib/mysql' }], NetworkSettings: { Ports: { '3306/tcp': [{ HostIp: '127.0.0.1', HostPort: '33317' }] } } }]), stderr: '' };
    return { code: 0, stdout: JSON.stringify([{ Name: 'm3d-refresh-test-a', Labels: { 'm3d.refresh.run': 'a'.repeat(32) } }]), stderr: '' };
  });
  const container = await adapter.inspectContainer('c'.repeat(64));
  const volume = await adapter.inspectVolume('m3d-refresh-test-a');
  assert.deepEqual(calls, [['inspect', '--type', 'container', 'c'.repeat(64)], ['volume', 'inspect', 'm3d-refresh-test-a']]);
  assert.equal(container.id, 'c'.repeat(64));
  assert.equal(volume.id, 'm3d-refresh-test-a');
  assert.equal(volume.name, 'm3d-refresh-test-a');
  assert.equal(adapter.verifyInspection(container, { id: 'c'.repeat(64), image: `sha256:${'b'.repeat(64)}`, run: 'a'.repeat(32), volume: 'm3d-refresh-test-a', port: '33317' }), true);
});

test('invalid volume suffix is rejected before invoking executor', async () => {
  let calls = 0;
  const adapter = createDockerAdapter(async () => { calls++; return { code: 0, stdout: '[]', stderr: '' }; });
  await assert.rejects(adapter.inspectVolume('m3d-refresh-test-a!'), TypeError);
  assert.equal(calls, 0);
});

test('inspection fails closed on nonzero, rejected, stderr, or ambiguous output', async () => {
  for (const execute of [
    async () => ({ code: 1, stdout: '[]', stderr: '' }),
    async () => { throw new Error('executor rejected'); },
    async () => ({ code: 0, stdout: '[]', stderr: 'warning' }),
    async () => ({ code: 0, stdout: '[] []', stderr: '' }),
  ]) {
    const adapter = createDockerAdapter(execute);
    await assert.rejects(adapter.inspectVolume('m3d-refresh-test-a'));
  }
});
