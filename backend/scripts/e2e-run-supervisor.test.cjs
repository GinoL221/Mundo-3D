'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createE2ESupervisor } = require('./e2e-run-supervisor.cjs');
function harness() {
  const events = [], faults = {};
  let port = 34000;
  const provider = {
    create: async ({ kind, runId }) => {
      events.push(`create:${kind}`);
      if (faults[kind]) throw new Error(`${kind} creation uncertain`);
      return Object.freeze({ kind, runId, containerId: (kind === 'mysql' ? 'a' : 'b').repeat(64) });
    },
    ready: async record => record.kind === 'mysql'
      ? { dbPort: '34567', serverUuid: '12345678-1234-1234-1234-123456789abc' }
      : { httpPort: '34568', smtpPort: '34569' },
    cleanup: async record => { events.push(`cleanup:${record.kind}`); if (faults.cleanup) throw new Error('cleanup failed'); },
  };
  return { events, faults, supervisor: createE2ESupervisor({ dockerProvider: provider, portFinder: async () => ++port }) };
}

test('runs both owned resources, frozen per-run env and reverse-order cleanup without mutating process.env', async () => {
  const fingerprint = () => require('node:crypto').createHash('sha256')
    .update(JSON.stringify(Object.entries(process.env).sort())).digest('hex');
  const h = harness(); const before = fingerprint();
  const outcome = await h.supervisor.run(async ({ env }) => {
    h.events.push('work');
    assert.equal(env.DB_PORT, '34567'); assert.equal(env.DB_USER, 'root'); assert.equal(env.DB_PASS, '');
    assert.equal(env.M3D_E2E_MAILPIT_HTTP_PORT, '34568');
    assert.equal(env.SMTP_PORT, '34569'); assert.equal(env.SMTP_HOST, '127.0.0.1');
    assert.equal(env.M3D_E2E_BACKEND_PORT, '34001'); assert.equal(env.M3D_E2E_FRONTEND_PORT, '34002');
    assert.match(env.M3D_E2E_RUN_ID, /^[a-f0-9]{32}$/);
    assert.ok(Object.isFrozen(env));
    return 'test-suite-ok';
  });
  assert.equal(outcome, 'test-suite-ok');
  assert.equal(fingerprint(), before, 'supervisor must not change the process environment');
  assert.deepEqual(h.events, ['create:mysql', 'create:mailpit', 'work', 'cleanup:mailpit', 'cleanup:mysql']);
});

test('uncertain second creation preserves its candidate but cleans the confirmed first resource', async () => {
  const h = harness(); h.faults.mailpit = true;
  await assert.rejects(h.supervisor.run(() => { throw new Error('must not run'); }), /mailpit creation uncertain/);
  assert.deepEqual(h.events, ['create:mysql', 'create:mailpit', 'cleanup:mysql']);
});

test('work failure still cleans all resources and retains work and cleanup failures', async () => {
  const h = harness(); h.faults.cleanup = true;
  await assert.rejects(h.supervisor.run(() => { throw new Error('work failed'); }), error => {
    assert.ok(error instanceof AggregateError);
    assert.deepEqual(error.errors.map(item => item.message), ['work failed', 'cleanup failed', 'cleanup failed']);
    return true;
  });
  assert.deepEqual(h.events.slice(-2), ['cleanup:mailpit', 'cleanup:mysql']);
});

test('an already cancelled run creates no resources', async () => {
  const h = harness(); const controller = new AbortController(); controller.abort(new Error('cancelled'));
  await assert.rejects(h.supervisor.run(() => {}, { signal: controller.signal }), /cancelled/);
  assert.deepEqual(h.events, []);
});

test('missing allocator or provider methods never fall back to shared ports', () => {
  assert.throws(() => createE2ESupervisor({ dockerProvider: { create() {} } }), /E2E supervisor dependencies/);
});
