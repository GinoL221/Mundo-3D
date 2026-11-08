'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { assertResourceBinding, MYSQL_IMAGE, MAILPIT_IMAGE } = require('./e2e-resource-binding.cjs');
const id = 'a'.repeat(64);
const runId = 'b'.repeat(32);
function fixture(kind = 'mysql') {
  const record = { containerId: id, runId, kind };
  const inspected = {
    Id: id, Name: `/m3d-e2e-${kind}-${runId}`,
    Config: { Image: kind === 'mysql' ? MYSQL_IMAGE : MAILPIT_IMAGE,
      Labels: { 'm3d.e2e.run': runId, 'm3d.e2e.kind': kind } },
    State: { Running: true },
    Mounts: kind === 'mysql' ? [{ Type: 'volume', Destination: '/var/lib/mysql', RW: true, Name: 'c'.repeat(64) }] : [],
    NetworkSettings: { Ports: kind === 'mysql'
      ? { '3306/tcp': [{ HostIp: '127.0.0.1', HostPort: '34567' }] }
      : { '8025/tcp': [{ HostIp: '127.0.0.1', HostPort: '34568' }], '1025/tcp': [{ HostIp: '127.0.0.1', HostPort: '34569' }] } },
  };
  return { record, inspected };
}

test('binds exact run/container, image, anonymous volume and TCP port from live inspection', () => {
  const f = fixture();
  assert.deepEqual(assertResourceBinding(f.record, f.inspected, true), { dbPort: '34567', volumeName: 'c'.repeat(64) });
});

test('binds Mailpit HTTP and SMTP to the same live owned container', () => {
  const f = fixture('mailpit');
  assert.deepEqual(assertResourceBinding(f.record, f.inspected, true), { httpPort: '34568', smtpPort: '34569' });
});

test('rejects wrong ownership, exposed endpoints, extra mounts and malformed ids', () => {
  for (const mutate of [
    f => { f.inspected.Id = 'd'.repeat(64); },
    f => { f.inspected.Config.Labels['m3d.e2e.run'] = 'd'.repeat(32); },
    f => { f.inspected.Name += '-other'; },
    f => { f.inspected.Config.Image = 'different'; },
    f => { f.inspected.Mounts[0].Type = 'bind'; },
    f => { f.inspected.Mounts.push(f.inspected.Mounts[0]); },
    f => { f.inspected.NetworkSettings.Ports['3306/tcp'][0].HostIp = '0.0.0.0'; },
    f => { f.inspected.State.Running = false; },
    f => { f.record.runId += '\n'; },
    f => { f.record.containerId += '\n'; },
  ]) {
    const f = fixture(); mutate(f);
    assert.throws(() => assertResourceBinding(f.record, f.inspected, true), /E2E resource binding rejected/);
  }
});

test('cleanup inspection permits stopped resources but never mismatched anonymous volumes', () => {
  const f = fixture();
  f.inspected.State.Running = false;
  f.inspected.NetworkSettings.Ports = {};
  assert.deepEqual(assertResourceBinding(f.record, f.inspected), { volumeName: 'c'.repeat(64) });
  f.record.volumeName = 'd'.repeat(64);
  assert.throws(() => assertResourceBinding(f.record, f.inspected), /E2E resource binding rejected/);
});
module.exports = { fixture };
