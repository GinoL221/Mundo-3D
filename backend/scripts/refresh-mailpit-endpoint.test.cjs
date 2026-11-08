'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { verifyMailpitEndpoint, sanitizeMailpitOperation } = require('./refresh-mailpit-endpoint.cjs');

test('accepts confirmed Mailpit endpoint with strict loopback URL', async () => {
  const fetchMock = async (url) => {
    if (url === 'http://127.0.0.1:8025/api/v1/info') {
      return {
        ok: true,
        status: 200,
        json: async () => ({ Version: 'v1.18.0', Database: 'in-memory' }),
      };
    }
    throw new Error(`Unexpected URL: ${url}`);
  };

  const result = await verifyMailpitEndpoint({
    baseUrl: 'http://127.0.0.1:8025',
    fetchImpl: fetchMock,
  });

  assert.equal(result.ok, true);
  assert.equal(result.version, 'v1.18.0');
});

test('rejects missing, malformed or credential-bearing URLs', async () => {
  const badUrls = [
    undefined,
    null,
    '',
    'ftp://localhost:8025',
    'http://127.0.0.1:8025@external.domain',
    'http://localhost:8025/extra/path',
    'http://user:pass@localhost:8025',
    'http://127.0.0.1:8025:extra',
  ];
  for (const badUrl of badUrls) {
    await assert.rejects(
      verifyMailpitEndpoint({ baseUrl: badUrl, fetchImpl: async () => {} }),
      { message: 'Mailpit endpoint verification failed' }
    );
  }
});

test('fails closed if info endpoint returns non-200 or unexpected payload', async () => {
  const badStatuses = [404, 500, 502];
  for (const status of badStatuses) {
    const fetchMock = async () => ({ ok: false, status });
    await assert.rejects(
      verifyMailpitEndpoint({ baseUrl: 'http://127.0.0.1:8025', fetchImpl: fetchMock }),
      { message: 'Mailpit endpoint verification failed' }
    );
  }

  const malformedFetch = async () => ({
    ok: true,
    status: 200,
    json: async () => ({ SomeOtherService: true }),
  });
  await assert.rejects(
    verifyMailpitEndpoint({ baseUrl: 'http://127.0.0.1:8025', fetchImpl: malformedFetch }),
    { message: 'Mailpit endpoint verification failed' }
  );
});

test('requires an explicit injected fetch implementation and rejects default network calls', async () => {
  await assert.rejects(
    verifyMailpitEndpoint({ baseUrl: 'http://127.0.0.1:8025' }),
    { message: 'Mailpit endpoint verification failed' }
  );
});

test('fails closed on unknown or malformed operations', () => {
  for (const badOp of [undefined, null, '', 'UNKNOWN_OP', 'DROP_TABLE']) {
    assert.throws(
      () => sanitizeMailpitOperation({ operation: badOp }),
      { message: 'Invalid or unauthorized Mailpit operation' }
    );
  }
});

test('forbids unrestricted deletion unless explicit run identity and confirmed ownership match', () => {
  assert.throws(
    () => sanitizeMailpitOperation({ operation: 'DELETE_ALL_MESSAGES' }),
    { message: 'Unrestricted Mailpit deletion forbidden without verified dedicated instance' }
  );

  assert.throws(
    () => sanitizeMailpitOperation({
      operation: 'DELETE_ALL_MESSAGES',
      runScope: { runId: 'a'.repeat(32) + 'extra', verifiedInstance: true },
    }),
    { message: 'Unrestricted Mailpit deletion forbidden without verified dedicated instance' }
  );

  const allowed = sanitizeMailpitOperation({
    operation: 'DELETE_ALL_MESSAGES',
    runScope: { runId: 'a'.repeat(32), verifiedInstance: true },
  });
  assert.equal(allowed.permitted, true);
  assert.equal(allowed.operation, 'DELETE_ALL_MESSAGES');
});
