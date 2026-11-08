'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createOwnedMailpitClient } = require('./e2e-owned-mailpit-client.cjs');
const { MAILPIT_IMAGE } = require('./e2e-resource-binding.cjs');
const RUN = 'b'.repeat(32), ID = 'a'.repeat(64);
function harness() {
  const calls = [];
  const env = { M3D_E2E_RUN_ID: RUN, M3D_E2E_MAILPIT_CONTAINER_ID: ID,
    M3D_E2E_MAILPIT_HTTP_PORT: '34568', SMTP_HOST: '127.0.0.1', SMTP_PORT: '34569' };
  const inspected = { Id: ID, Name: `/m3d-e2e-mailpit-${RUN}`, Mounts: [], State: { Running: true },
    Config: { Image: MAILPIT_IMAGE, Labels: { 'm3d.e2e.run': RUN, 'm3d.e2e.kind': 'mailpit' } },
    NetworkSettings: { Ports: { '8025/tcp': [{ HostIp: '127.0.0.1', HostPort: '34568' }],
      '1025/tcp': [{ HostIp: '127.0.0.1', HostPort: '34569' }] } } };
  const client = createOwnedMailpitClient({ env, inspect: async id => { calls.push(['inspect', id]); return inspected; },
    fetchImpl: async (url, options) => { calls.push(['fetch', url, options.method, options.redirect]); return { ok: true, status: 200 }; } });
  return { env, inspected, calls, client };
}

test('every read, global delete and chaos mutation validates both live HTTP and SMTP bindings first', async () => {
  const h = harness();
  for (const [route, method] of [['messages', 'DELETE'], ['chaos', 'PUT'], ['chaos', 'GET'], ['message/abc-123', 'GET']]) {
    await h.client.request(route, { method });
    assert.deepEqual(h.calls.splice(0), [['inspect', ID], ['fetch', `http://127.0.0.1:34568/api/v1/${route}`, method, 'error']]);
  }
});
test('wrong SMTP peer, ownership drift and stopped containers reject before any fetch', async () => {
  for (const mutate of [
    h => { h.inspected.NetworkSettings.Ports['1025/tcp'][0].HostPort = '1025'; },
    h => { h.inspected.Config.Labels['m3d.e2e.run'] = 'c'.repeat(32); },
    h => { h.inspected.State.Running = false; },
  ]) {
    const h = harness(); mutate(h);
    await assert.rejects(h.client.request('chaos', { method: 'PUT' }), /Mailpit binding rejected/);
    assert.deepEqual(h.calls, [['inspect', ID]]);
  }
});
test('missing context, unknown routes and methods cause no inspection or network calls', async () => {
  assert.throws(() => createOwnedMailpitClient({ env: {}, fetchImpl() {} }), /Mailpit context rejected/);
  const h = harness();
  for (const [route, method] of [['messages/../chaos', 'GET'], ['messages', 'POST'], ['chaos?other', 'PUT']]) {
    await assert.rejects(h.client.request(route, { method }), /Mailpit operation rejected/);
  }
  assert.deepEqual(h.calls, []);
});

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('../node_modules/typescript');
const root = path.resolve(__dirname, '../..');

test('Mailpit fixture startup and clearing route through the live-owned client, never Compose or ambient fetch', async () => {
  const requests = [];
  const defaults = { Sender: { ErrorCode: 451, Probability: 0 }, Recipient: { ErrorCode: 451, Probability: 0 }, Authentication: { ErrorCode: 535, Probability: 0 } };
  const source = fs.readFileSync(path.join(root, 'e2e/fixtures/emailConfirmation.ts'), 'utf8');
  const compiled = ts.transpileModule(source.replaceAll('import.meta.url', JSON.stringify('file:///fixture.ts')).replace(/\brequire\b/g, 'fixtureRequire'),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  const requireFake = id => {
    if (id !== 'node:module') throw new Error(`Unexpected native dependency: ${id}`);
    return { createRequire: () => id => {
      if (id !== '../../backend/scripts/e2e-owned-mailpit-client.cjs') throw new Error(`Unexpected fixture dependency: ${id}`);
      return { createOwnedMailpitClient: () => ({ request: async (route, options = {}) => {
        requests.push([route, options.method || 'GET']);
        return { ok: true, json: async () => defaults };
      } }) };
    } };
  };
  vm.runInNewContext(compiled, { require: requireFake, module, exports: module.exports,
    process: { env: {} }, fetch: () => { throw new Error('Ambient network forbidden'); } });
  await module.exports.startMailpit();
  await module.exports.clearMailpit();
  assert.deepEqual(requests, [['info', 'GET'], ['chaos', 'PUT'], ['chaos', 'GET'], ['chaos', 'GET'], ['messages', 'DELETE']]);
});
