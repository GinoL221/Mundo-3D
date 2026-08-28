const test = require('node:test');
const { mock } = require('node:test');
const assert = require('node:assert/strict');
const childProcess = require('node:child_process');
const path = require('node:path');
const EventEmitter = require('node:events');

const REPO_ROOT = path.resolve(__dirname, '..', '..');

function fakeSpawnedChild() {
  const child = new EventEmitter();
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

test('forwards SIGTERM to the spawned start child while it is active', async () => {
  mock.method(childProcess, 'spawnSync', () => ({ status: 0 }));
  const child = fakeSpawnedChild();
  mock.method(childProcess, 'spawn', () => child);

  const { run } = require('./migrate-and-start');
  const resultPromise = run();
  process.emit('SIGTERM');
  child.emit('exit', 143);
  await resultPromise;

  assert.equal(child.kill.mock.calls.length, 1);
  assert.equal(child.kill.mock.calls[0].arguments[0], 'SIGTERM');
});

test('forwards SIGINT to the spawned start child while it is active', async () => {
  mock.method(childProcess, 'spawnSync', () => ({ status: 0 }));
  const child = fakeSpawnedChild();
  mock.method(childProcess, 'spawn', () => child);

  const { run } = require('./migrate-and-start');
  const resultPromise = run();
  process.emit('SIGINT');
  child.emit('exit', 130);
  await resultPromise;

  assert.equal(child.kill.mock.calls.length, 1);
  assert.equal(child.kill.mock.calls[0].arguments[0], 'SIGINT');
});
