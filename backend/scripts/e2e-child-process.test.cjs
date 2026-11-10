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
  const promise = runCommand('runner', [], { signal: controller.signal, graceMs: 5, readProcessTableImpl: () => '',
    killImpl(pid, name) { kills.push([pid, name]); },
    spawnImpl() { const c = new EventEmitter(); c.pid = 21; process.nextTick(() => controller.abort(new Error('cancelled')));
      setTimeout(() => c.emit('close', null, 'SIGKILL'), 20); return c; } });
  await assert.rejects(promise, /cancelled/);
  assert.deepEqual(kills, [[process.platform === 'win32' ? 21 : -21, 'SIGINT'], [process.platform === 'win32' ? 21 : -21, 'SIGKILL']]);
});

test('cancellation sends Playwright the SIGINT it handles, then escalates to SIGKILL', async () => {
  const controller = new AbortController(); const events = [];
  const child = new EventEmitter(); child.pid = 17;
  await assert.rejects(runCommand('runner', [], { signal: controller.signal, readProcessTableImpl: () => '',
    killImpl(pid, signal) { events.push([pid, signal]); process.nextTick(() => { events.push('close'); child.emit('close', null, 'SIGTERM'); }); },
    spawnImpl() { process.nextTick(() => controller.abort(new Error('cancelled'))); return child; },
  }), /cancelled/);
  assert.deepEqual(events, [[process.platform === 'win32' ? 17 : -17, 'SIGINT'], 'close']);
});

test('cancellation reaps webServer-like descendants that detach into their own group', { skip: process.platform === 'win32' }, async () => {
  const fs = require('node:fs'); const os = require('node:os'); const path = require('node:path');
  const pidFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-reap-')), 'grandchild.pid');
  const controller = new AbortController();
  const script = `const { spawn } = require('node:child_process'); const fs = require('node:fs');
process.on('SIGINT', () => {}); process.on('SIGTERM', () => {});
const grandchild = spawn(process.execPath, ['-e', 'process.on("SIGINT", () => {}); process.on("SIGTERM", () => {}); setInterval(() => {}, 1000)'], { detached: true, stdio: 'ignore' });
grandchild.unref(); fs.writeFileSync(process.env.E2E_REAP_PIDFILE, String(grandchild.pid));
setInterval(() => {}, 1000);`;
  const running = runCommand(process.execPath, ['-e', script], {
    env: { ...process.env, E2E_REAP_PIDFILE: pidFile }, signal: controller.signal, graceMs: 200 });
  await new Promise((resolve) => { const poll = setInterval(() => { if (fs.existsSync(pidFile) && fs.readFileSync(pidFile, 'utf8')) { clearInterval(poll); resolve(); } }, 20); });
  const grandchildPid = Number(fs.readFileSync(pidFile, 'utf8'));
  controller.abort(new Error('cancelled'));
  await assert.rejects(running, /cancelled/);
  const deadline = Date.now() + 3000;
  let alive = true;
  while (Date.now() < deadline) {
    try { process.kill(grandchildPid, 0); await new Promise((done) => setTimeout(done, 50)); } catch { alive = false; break; }
  }
  assert.equal(alive, false, `detached grandchild ${grandchildPid} survived cancellation`);
});

test('cancellation stays alive long enough to finish reaping and reject', { skip: process.platform === 'win32' }, async () => {
  const { spawn } = require('node:child_process'); const fs = require('node:fs'); const os = require('node:os'); const path = require('node:path');
  const marker = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-reap-alive-')), 'rejected.txt');
  const modulePath = path.resolve(__dirname, 'e2e-child-process.cjs');
  const script = `const { runCommand } = require(${JSON.stringify(modulePath)});
const { EventEmitter } = require('node:events'); const fs = require('node:fs');
const controller = new AbortController();
runCommand('runner', [], { signal: controller.signal, killImpl: () => {},
  readProcessTableImpl: () => [{ pid: 2, ppid: 999999, identity: 'T0' }],
  reapGraceMs: 300, spawnImpl() { const child = new EventEmitter(); child.pid = 999999;
    setTimeout(() => controller.abort(new Error('cancelled')), 10);
    setTimeout(() => child.emit('close', null, 'SIGINT'), 20); return child; } })
  .catch(error => { fs.writeFileSync(process.env.E2E_REAP_MARKER, error.message); });`;
  const child = spawn(process.execPath, ['-e', script], { env: { ...process.env, E2E_REAP_MARKER: marker }, stdio: 'inherit' });
  const exited = await new Promise((resolve) => child.once('exit', (code) => resolve(code)));
  assert.equal(exited, 0);
  assert.equal(fs.existsSync(marker), true, 'the cancellation rejection was abandoned when the event loop drained');
});

test('reap verifies descendant identity before signalling and skips reused PIDs', async () => {
  const controller = new AbortController();
  const kills = [];
  let tablePhase = 1;
  const readProcessTableImpl = () => {
    if (tablePhase === 1) {
      return [
        { pid: 10, ppid: 1, identity: 'T0' },
        { pid: 20, ppid: 10, identity: 'T1' },
      ];
    }
    return [
      { pid: 20, ppid: 1, identity: 'T2' },
    ];
  };
  const promise = runCommand('runner', [], {
    signal: controller.signal,
    reapGraceMs: 5,
    readProcessTableImpl,
    killImpl(pid, name) { kills.push([pid, name]); },
    spawnImpl() {
      const child = new EventEmitter();
      child.pid = 10;
      process.nextTick(() => {
        controller.abort(new Error('cancelled'));
        tablePhase = 2;
        child.emit('close', null, 'SIGINT');
      });
      return child;
    },
  });
  await assert.rejects(promise, /cancelled/);
  assert.equal(kills.some(([pid]) => pid === 20), false, 'reused PID 20 should not be signalled');
});

