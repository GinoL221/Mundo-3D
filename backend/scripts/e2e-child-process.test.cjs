'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { runCommand } = require('./e2e-child-process.cjs');

test('preserves command arguments, environment and successful exit', async () => {
  const env = { TEST_ONLY: 'yes' };
  await runCommand('runner', ['test', '--ui', '--grep', 'two words'], { env, spawnImpl(cmd, args, options) {
    assert.equal(cmd, 'runner'); assert.deepEqual(args, ['test', '--ui', '--grep', 'two words']);
    assert.equal(options.env, env); assert.equal(options.detached, process.platform !== 'win32');
    const child = new EventEmitter(); process.nextTick(() => child.emit('close', 0, null)); return child;
  } });
});
test('nonzero child exit remains nonzero, and spawn errors reject', async () => {
  await assert.rejects(runCommand('runner', [], { spawnImpl() {
    const child = new EventEmitter(); process.nextTick(() => child.emit('close', 7)); return child;
  } }), error => error.exitCode === 7);
  await assert.rejects(runCommand('missing', [], { spawnImpl() {
    const child = new EventEmitter(); process.nextTick(() => child.emit('error', new Error('ENOENT'))); return child;
  } }), /E2E child could not start/);
});
test('a second grace period escalates a child that ignores SIGINT to SIGKILL', async () => {
  const controller = new AbortController(); const kills = [];
  const promise = runCommand('runner', [], { signal: controller.signal, graceMs: 5,
    killImpl(pid, name) { kills.push([pid, name]); },
    spawnImpl() { const c = new EventEmitter(); c.pid = 21; process.nextTick(() => controller.abort(new Error('cancelled')));
      setTimeout(() => c.emit('close', null, 'SIGKILL'), 20); return c; } });
  await assert.rejects(promise, /cancelled/);
  assert.deepEqual(kills, [[process.platform === 'win32' ? 21 : -21, 'SIGINT'], [process.platform === 'win32' ? 21 : -21, 'SIGKILL']]);
});

test('cancellation sends Playwright the SIGINT it handles, then escalates to SIGKILL', async () => {
  const controller = new AbortController(); const events = [];
  const child = new EventEmitter(); child.pid = 17;
  await assert.rejects(runCommand('runner', [], { signal: controller.signal,
    killImpl(pid, signal) { events.push([pid, signal]); process.nextTick(() => { events.push('close'); child.emit('close', null, 'SIGTERM'); }); },
    spawnImpl() { process.nextTick(() => controller.abort(new Error('cancelled'))); return child; },
  }), /cancelled/);
  assert.deepEqual(events, [[process.platform === 'win32' ? 17 : -17, 'SIGINT'], 'close']);
});
