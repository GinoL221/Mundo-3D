'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { verifyContainer } = require('./refresh-mysql-identity.cjs');

const expected = Object.freeze({ id: 'a'.repeat(64), image: `sha256:${'b'.repeat(64)}`, run: 'c'.repeat(32), volume: 'm3d-refresh-test-c', port: '33317' });
const fixture = () => ({ Id: expected.id, Image: expected.image, State: { Running: true }, HostConfig: { NetworkMode: 'bridge' }, Config: { Labels: { 'm3d.refresh.run': expected.run } }, Mounts: [{ Type: 'volume', Name: expected.volume, Destination: '/var/lib/mysql' }], NetworkSettings: { Ports: { '3306/tcp': [{ HostIp: '127.0.0.1', HostPort: expected.port }] } } });
test('accepts matching synthetic identity and rejects missing or mismatched evidence', () => {
  assert.equal(verifyContainer(fixture(), expected), true);
  for (const change of [
    x => { x.Id = 'd'.repeat(64); },
    x => { x.Image = 'sha256:' + 'e'.repeat(64); },
    x => { x.State.Running = false; },
    x => { x.HostConfig.NetworkMode = 'host'; },
    x => { x.Mounts[0].Type = 'bind'; },
    x => { x.Mounts[0].Destination = '/other'; },
    x => { delete x.NetworkSettings; },
    x => { x.NetworkSettings.Ports['9999/tcp'] = null; },
    x => { x.Config.Labels['m3d.refresh.run'] = 'wrong'; },
    x => { x.Mounts[0].Name = 'other'; },
    x => { x.Mounts.push({ Type: 'bind', Destination: '/other' }); },
    x => { x.NetworkSettings.Ports['3306/tcp'][0].HostIp = '0.0.0.0'; },
    x => { x.NetworkSettings.Ports['3306/tcp'][0].HostPort = '33318'; },
    x => { x.NetworkSettings.Ports['3306/tcp'].push({ HostIp: '::', HostPort: expected.port }); },
  ]) { const observed = fixture(); change(observed); assert.equal(verifyContainer(observed, expected), false); }
  assert.equal(verifyContainer(null, expected), false);
  assert.equal(verifyContainer(fixture(), {}), false);
  for (const key of ['id', 'image', 'run', 'volume', 'port']) {
    const malformed = { ...expected, [key]: expected[key] + '\n' };
    const observed = fixture();
    if (key === 'id') observed.Id = malformed.id;
    if (key === 'image') observed.Image = malformed.image;
    if (key === 'run') observed.Config.Labels['m3d.refresh.run'] = malformed.run;
    if (key === 'volume') observed.Mounts[0].Name = malformed.volume;
    if (key === 'port') observed.NetworkSettings.Ports['3306/tcp'][0].HostPort = malformed.port;
    assert.equal(verifyContainer(observed, malformed), false);
  }
  const outOfRange = fixture();
  outOfRange.NetworkSettings.Ports['3306/tcp'][0].HostPort = '65536';
  assert.equal(verifyContainer(outOfRange, { ...expected, port: '65536' }), false);
});
