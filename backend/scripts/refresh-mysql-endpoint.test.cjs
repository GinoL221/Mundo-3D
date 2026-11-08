'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { verifyEndpoint } = require('./refresh-mysql-endpoint.cjs');
const { withPinnedSession } = require('./refresh-mysql-session.cjs');

const uuid = '12345678-1234-1234-1234-123456789abc';
const query = 'SELECT @@server_uuid AS uuid, CONNECTION_ID() AS connectionId';
function connection(result = [[{ uuid, connectionId: 42 }], []]) {
  const calls = [];
  return {
    calls,
    async query(sql) { calls.push(sql); return result; },
    async end() { calls.push('end'); },
  };
}

test('returns normalized identity from the supplied connection without closing it', async () => {
  const db = connection([[{ uuid: uuid.toUpperCase(), connectionId: '42' }], []]);
  assert.deepEqual(await verifyEndpoint(db, uuid), { uuid, connectionId: 42 });
  assert.deepEqual(db.calls, [query]);
});

test('rejects missing or malformed expected identity before querying', async () => {
  for (const expected of [undefined, null, '', uuid + '\n']) {
    const db = connection();
    await assert.rejects(verifyEndpoint(db, expected), { message: 'MySQL endpoint verification failed' });
    assert.deepEqual(db.calls, []);
  }
});

test('rejects a different endpoint identity without closing it', async () => {
  const db = connection();
  await assert.rejects(verifyEndpoint(db, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'), { message: 'MySQL endpoint verification failed' });
  assert.deepEqual(db.calls, [query]);
});

test('rejects malformed identity results without closing the supplied connection', async () => {
  for (const result of [null, [[], []], [[{ uuid, connectionId: 42 }, { uuid, connectionId: 43 }], []], [[{ uuid, connectionId: 0 }], []], [[{ uuid: 'invalid', connectionId: 42 }], []]]) {
    const db = connection(result);
    await assert.rejects(verifyEndpoint(db, uuid), { message: 'MySQL endpoint verification failed' });
    assert.deepEqual(db.calls, [query]);
  }
});

test('sanitizes query failures without exposing credentials', async () => {
  const db = { async query() { throw new Error('password=secret'); } };
  await assert.rejects(verifyEndpoint(db, uuid), error => {
    assert.equal(error.message, 'MySQL endpoint verification failed');
    assert.equal(error.cause, undefined);
    return true;
  });
});

test('binds the verified identity to work on the same pinned connection', async () => {
  const db = connection();
  const expected = await verifyEndpoint(db, uuid);
  let received;
  const result = await withPinnedSession(db, async pinned => { received = pinned; return 'ok'; }, expected);
  assert.equal(result, 'ok');
  assert.equal(received, db);
  assert.deepEqual(db.calls, [query, query, query, 'end']);
});

test('rejects a changed connection identity before pinned work', async () => {
  const db = connection();
  const expected = await verifyEndpoint(db, uuid);
  db.query = async sql => { db.calls.push(sql); return [[{ uuid, connectionId: 43 }], []]; };
  let worked = false;
  await assert.rejects(withPinnedSession(db, async () => { worked = true; }, expected), /identity did not match/);
  assert.equal(worked, false);
  assert.deepEqual(db.calls, [query, query, 'end']);
});

test('verifies each supplied connection independently', async () => {
  const first = connection();
  const second = connection([[{ uuid: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', connectionId: 43 }], []]);
  assert.deepEqual(await verifyEndpoint(first, uuid), { uuid, connectionId: 42 });
  await assert.rejects(verifyEndpoint(second, uuid), { message: 'MySQL endpoint verification failed' });
  assert.deepEqual(first.calls, [query]);
  assert.deepEqual(second.calls, [query]);
});
