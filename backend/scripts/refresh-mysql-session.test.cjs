'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { withPinnedSession } = require('./refresh-mysql-session.cjs');

const identity = { uuid: '12345678-1234-1234-1234-123456789abc', connectionId: 42 };
function fakeConnection(responses = [identity, identity]) {
  const calls = [];
  return {
    calls,
    async query(sql) { calls.push(['query', sql]); const next = responses.shift(); if (next instanceof Error) throw next; return [[next], []]; },
    async end() { calls.push(['end']); },
  };
}
const query = 'SELECT @@server_uuid AS uuid, CONNECTION_ID() AS connectionId';

test('pins work to one connection and verifies stable identity before and after work', async () => {
  const connection = fakeConnection();
  let received;
  assert.equal(await withPinnedSession(connection, async pinned => { received = pinned; return 'ok'; }), 'ok');
  assert.equal(received, connection);
  assert.deepEqual(connection.calls, [['query', query], ['query', query], ['end']]);
});

test('fails closed on malformed identity before work and changed identity after work', async () => {
  for (const first of [{ uuid: 'not-a-uuid', connectionId: 42 }, { ...identity, uuid: identity.uuid + '\n' }, { ...identity, connectionId: '42\n' }, { ...identity, connectionId: 0 }]) {
    const connection = fakeConnection([first, identity]);
    let worked = false;
    await assert.rejects(withPinnedSession(connection, async () => { worked = true; }));
    assert.equal(worked, false);
    assert.equal(connection.calls.at(-1)[0], 'end');
  }
  for (const last of [
    { ...identity, connectionId: 43 },
    { ...identity, uuid: '87654321-1234-1234-1234-123456789abc' },
    null,
  ]) {
    const connection = fakeConnection([identity, last]);
    let worked = false;
    await assert.rejects(withPinnedSession(connection, async () => { worked = true; }));
    assert.equal(worked, true);
    assert.equal(connection.calls.at(-1)[0], 'end');
  }
});

test('closes after query and work errors; close failure remains a failure', async () => {
  const queryError = new Error('query failed');
  const brokenQuery = fakeConnection([queryError]);
  await assert.rejects(withPinnedSession(brokenQuery, async () => {}), /query failed/);
  assert.deepEqual(brokenQuery.calls.map(call => call[0]), ['query', 'end']);

  const workError = new Error('work failed');
  const brokenWork = fakeConnection();
  await assert.rejects(withPinnedSession(brokenWork, async () => { throw workError; }), /work failed/);
  assert.equal(brokenWork.calls.at(-1)[0], 'end');

  const undefinedFailure = fakeConnection();
  let didReject = false;
  try { await withPinnedSession(undefinedFailure, async () => { throw undefined; }); }
  catch { didReject = true; }
  assert.equal(didReject, true);
  assert.equal(undefinedFailure.calls.at(-1)[0], 'end');

  const invalidWork = fakeConnection();
  await assert.rejects(withPinnedSession(invalidWork, null), TypeError);
  assert.deepEqual(invalidWork.calls.map(call => call[0]), ['end']);

  const closeError = new Error('close failed');
  const brokenClose = fakeConnection();
  brokenClose.end = async () => { brokenClose.calls.push(['end']); throw closeError; };
  await assert.rejects(withPinnedSession(brokenClose, async () => 'ok'), /close failed/);
});
