'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createGuardedMailpitClient } = require('./mailpit-fixture-guard.cjs');

test('executes operation only when sanitized and authorized', async () => {
  const calls = [];
  const fakeFetch = async (url, opts) => {
    calls.push({ url, method: opts?.method });
    return { ok: true, status: 200, json: async () => ({ ok: true }) };
  };

  const client = createGuardedMailpitClient({
    baseUrl: 'http://127.0.0.1:8025',
    fetchImpl: fakeFetch,
    runScope: { runId: 'a'.repeat(32), verifiedInstance: true },
  });

  const result = await client.clearMessages();
  assert.equal(result.ok, true);
  assert.deepEqual(calls, [{ url: 'http://127.0.0.1:8025/api/v1/messages', method: 'DELETE' }]);
});

test('refuses clearMessages if runScope lacks verifiedInstance proof', async () => {
  const calls = [];
  const fakeFetch = async () => { calls.push('fetch'); return { ok: true }; };

  const client = createGuardedMailpitClient({
    baseUrl: 'http://127.0.0.1:8025',
    fetchImpl: fakeFetch,
    runScope: { runId: 'a'.repeat(32), verifiedInstance: false },
  });

  await assert.rejects(
    client.clearMessages(),
    { message: 'Unrestricted Mailpit deletion forbidden without verified dedicated instance' }
  );
  assert.equal(calls.length, 0);
});
