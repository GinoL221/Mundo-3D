const test = require('node:test');
const { mock } = require('node:test');
const assert = require('node:assert/strict');
const childProcess = require('node:child_process');
const os = require('node:os');
const path = require('node:path');
const EventEmitter = require('node:events');

const REPO_ROOT = path.resolve(__dirname, '..', '..');

function fakeSpawnedChild() {
  const child = new EventEmitter();
  child.pid = 4242;
  child.kill = mock.fn();
  return child;
}

test.beforeEach(() => {
  mock.restoreAll();
});

test('successful migrate runs start next, with the exact expected argv/cwd', async () => {
  const spawnSyncMock = mock.method(childProcess, 'spawnSync', () => ({ status: 0 }));
  const child = fakeSpawnedChild();
  const spawnMock = mock.method(childProcess, 'spawn', () => child);

  const { run } = require('./migrate-and-start');
  const resultPromise = run();
  child.emit('exit', 0);
  const result = await resultPromise;

  assert.equal(spawnSyncMock.mock.calls.length, 1);
  assert.deepEqual(spawnSyncMock.mock.calls[0].arguments[0], 'pnpm');
  assert.deepEqual(spawnSyncMock.mock.calls[0].arguments[1], ['--filter', 'backend', 'db:migrate']);
  assert.equal(spawnSyncMock.mock.calls[0].arguments[2].cwd, REPO_ROOT);

  assert.equal(spawnMock.mock.calls.length, 1);
  assert.deepEqual(spawnMock.mock.calls[0].arguments[0], 'pnpm');
  assert.deepEqual(spawnMock.mock.calls[0].arguments[1], ['--filter', 'backend', 'start']);
  assert.equal(spawnMock.mock.calls[0].arguments[2].cwd, REPO_ROOT);
  assert.equal(result, 0);
});

test('a failed migration blocks start entirely and propagates the exit code', async () => {
  const spawnSyncMock = mock.method(childProcess, 'spawnSync', () => ({ status: 1 }));
  const spawnMock = mock.method(childProcess, 'spawn', () => fakeSpawnedChild());

  const { run } = require('./migrate-and-start');
  const result = await run();

  assert.equal(spawnSyncMock.mock.calls.length, 1);
  assert.equal(spawnMock.mock.calls.length, 0);
  assert.equal(result, 1);
});

test('spawn calls use a fixed argv array with no shell interpolation', async () => {
  mock.method(childProcess, 'spawnSync', () => ({ status: 0 }));
  const child = fakeSpawnedChild();
  const spawnMock = mock.method(childProcess, 'spawn', () => child);

  const { run } = require('./migrate-and-start');
  const resultPromise = run();
  child.emit('exit', 0);
  await resultPromise;

  const spawnOptions = spawnMock.mock.calls[0].arguments[2];
  assert.notEqual(spawnOptions.shell, true);
  assert.equal(typeof spawnMock.mock.calls[0].arguments[1], 'object');
  assert.ok(Array.isArray(spawnMock.mock.calls[0].arguments[1]));
});

// pnpm is not a reliable signal relay: on CI it dies from SIGTERM without
// ever passing it to the `node index.js` it spawned, which orphans the real
// server instead of draining it (and is what hung the integration suite).
// Signalling the whole process group — negative pid — reaches that server
// directly whether or not pnpm survives long enough to forward anything.
test('starts the child in its own process group so signals can reach the server', async () => {
  mock.method(childProcess, 'spawnSync', () => ({ status: 0 }));
  const child = fakeSpawnedChild();
  const spawnMock = mock.method(childProcess, 'spawn', () => child);

  const { run } = require('./migrate-and-start');
  const resultPromise = run();
  child.emit('exit', 0);
  await resultPromise;

  assert.equal(spawnMock.mock.calls[0].arguments[2].detached, true);
});

test('forwards SIGTERM to the whole start process group while it is active', async () => {
  mock.method(childProcess, 'spawnSync', () => ({ status: 0 }));
  const child = fakeSpawnedChild();
  mock.method(childProcess, 'spawn', () => child);
  const killMock = mock.method(process, 'kill', () => true);

  const { run } = require('./migrate-and-start');
  const resultPromise = run();
  process.emit('SIGTERM');
  child.emit('exit', null, 'SIGTERM');
  await resultPromise;

  assert.equal(killMock.mock.calls.length, 1);
  assert.deepEqual(killMock.mock.calls[0].arguments, [-child.pid, 'SIGTERM']);
});

test('forwards SIGINT to the whole start process group while it is active', async () => {
  mock.method(childProcess, 'spawnSync', () => ({ status: 0 }));
  const child = fakeSpawnedChild();
  mock.method(childProcess, 'spawn', () => child);
  const killMock = mock.method(process, 'kill', () => true);

  const { run } = require('./migrate-and-start');
  const resultPromise = run();
  process.emit('SIGINT');
  child.emit('exit', null, 'SIGINT');
  await resultPromise;

  assert.equal(killMock.mock.calls.length, 1);
  assert.deepEqual(killMock.mock.calls[0].arguments, [-child.pid, 'SIGINT']);
});

test('a signal arriving after the group is already gone is swallowed', async () => {
  mock.method(childProcess, 'spawnSync', () => ({ status: 0 }));
  const child = fakeSpawnedChild();
  mock.method(childProcess, 'spawn', () => child);
  mock.method(process, 'kill', () => {
    const gone = new Error('kill ESRCH');
    gone.code = 'ESRCH';
    throw gone;
  });

  const { run } = require('./migrate-and-start');
  const resultPromise = run();
  process.emit('SIGTERM');
  child.emit('exit', null, 'SIGTERM');

  assert.equal(await resultPromise, 128 + os.constants.signals.SIGTERM);
});

// A child killed by a signal is reported by Node as `code === null`, with the
// signal name in the second argument — it never surfaces as an exit code.
// Passing that null through to `process.exitCode` would reset it to "unset"
// and this wrapper would exit 0, telling the orchestrator that a deploy it
// actually tore down had succeeded.
test('a start child killed by a signal reports a non-zero, signal-derived exit code', async () => {
  mock.method(childProcess, 'spawnSync', () => ({ status: 0 }));
  const child = fakeSpawnedChild();
  mock.method(childProcess, 'spawn', () => child);

  const { run } = require('./migrate-and-start');
  const resultPromise = run();
  child.emit('exit', null, 'SIGTERM');
  const result = await resultPromise;

  assert.equal(result, 128 + os.constants.signals.SIGTERM);
});

test('a migration killed by a signal blocks start and reports a non-zero exit code', async () => {
  mock.method(childProcess, 'spawnSync', () => ({ status: null, signal: 'SIGKILL' }));
  const spawnMock = mock.method(childProcess, 'spawn', () => fakeSpawnedChild());

  const { run } = require('./migrate-and-start');
  const result = await run();

  assert.equal(spawnMock.mock.calls.length, 0);
  assert.equal(result, 128 + os.constants.signals.SIGKILL);
});

test('a migration that never spawns at all reports a non-zero exit code', async () => {
  mock.method(childProcess, 'spawnSync', () => ({
    status: null,
    signal: null,
    error: new Error('spawn pnpm ENOENT'),
  }));
  const spawnMock = mock.method(childProcess, 'spawn', () => fakeSpawnedChild());

  const { run } = require('./migrate-and-start');
  const result = await run();

  assert.equal(spawnMock.mock.calls.length, 0);
  assert.equal(result, 1);
});
