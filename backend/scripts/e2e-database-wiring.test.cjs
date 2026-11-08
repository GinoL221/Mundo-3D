'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const { IDENTITY_QUERY } = require('./refresh-mysql-session.cjs');
const UUID = '12345678-1234-1234-1234-123456789abc';
const OTHER_UUID = 'aaaaaaaa-1234-1234-1234-123456789abc';
const env = () => ({ NODE_ENV: 'test', M3D_E2E_RUN_ID: 'a'.repeat(32),
  M3D_E2E_EXPECTED_SERVER_UUID: UUID, DB_HOST: '127.0.0.1', DB_PORT: '33317' });

// Evaluate the real entry modules with entirely fake drivers. No network,
// process environment changes or real database handles are available here.
function load(relative, environment, mocks) {
  const filename = path.resolve(__dirname, relative);
  const nativeRequire = createRequire(filename);
  const module = { exports: {} };
  const events = [];
  const requireFake = (id) => Object.hasOwn(mocks, id) ? mocks[id] : nativeRequire(id);
  requireFake.main = null;
  const context = vm.createContext({
    require: requireFake, module, exports: module.exports,
    process: { env: environment, exit: (code) => events.push(['exit', code]) },
    console: { log: (...args) => events.push(['stdout', ...args]),
      error: (...args) => events.push(['stderr', ...args]) },
  });
  new vm.Script(fs.readFileSync(filename, 'utf8'), { filename }).runInContext(context);
  return { exports: module.exports, events };
}

function mysqlHarness(environment, observed = UUID, failCreate = false) {
  const events = [];
  const connection = {
    query: async (sql) => {
      events.push(['query', sql]);
      if (sql === IDENTITY_QUERY) return [[{ uuid: observed, connectionId: 7 }]];
      if (failCreate) throw new Error('DDL failed');
      return [[]];
    },
    end: async () => { events.push(['end']); },
  };
  const { exports } = load('../src/database/config/ensureDatabase.js', environment, {
    'mysql2/promise': { createConnection: async () => { events.push(['connect']); return connection; } },
    './config': { test: { database: 'mundo_3d_test', username: 'root', host: '127.0.0.1', port: 33317 },
      production: {} },
  });
  return { events, ensure: exports.ensureDatabaseExists };
}

test('DDL validates the actual connection before CREATE and always closes it', async () => {
  const h = mysqlHarness(env());
  await h.ensure('test');
  assert.deepEqual(h.events, [['connect'], ['query', IDENTITY_QUERY],
    ['query', 'CREATE DATABASE IF NOT EXISTS `mundo_3d_test`;'], ['end']]);
});

test('a mismatching UUID cannot issue DDL and the connection is closed', async () => {
  const h = mysqlHarness(env(), OTHER_UUID);
  await assert.rejects(h.ensure('test'), /MySQL endpoint verification failed/);
  assert.deepEqual(h.events, [['connect'], ['query', IDENTITY_QUERY], ['end']]);
});

test('a partial or malformed supervised context cannot even open a DDL connection', async () => {
  for (const change of [
    { M3D_E2E_RUN_ID: undefined }, { M3D_E2E_EXPECTED_SERVER_UUID: undefined },
    { M3D_E2E_RUN_ID: 'a'.repeat(32) + '\n' },
    { M3D_E2E_EXPECTED_SERVER_UUID: UUID + '\n' },
    { DB_HOST: 'shared-db' }, { DB_PORT: '3306\n' }, { NODE_ENV: 'production' },
  ]) {
    const h = mysqlHarness({ ...env(), ...change });
    await assert.rejects(h.ensure('test'), /E2E database context rejected/);
    assert.deepEqual(h.events, []);
  }
});

test('DDL failures also close the physical connection', async () => {
  const h = mysqlHarness(env(), UUID, true);
  await assert.rejects(h.ensure('test'), /DDL failed/);
  assert.deepEqual(h.events.at(-1), ['end']);
});

test('operator-provided integration DB and production retain their existing behavior', async () => {
  const h = mysqlHarness({ NODE_ENV: 'test' });
  await h.ensure('test');
  assert.deepEqual(h.events, [['connect'], ['query', 'CREATE DATABASE IF NOT EXISTS `mundo_3d_test`;'], ['end']]);
  h.events.length = 0;
  await h.ensure('production');
  assert.deepEqual(h.events, []);
});

function poolHarness(environment) {
  const events = [];
  let sequelize;
  class Sequelize {
    constructor() { this.hooks = {}; sequelize = this; events.push('construct'); }
    addHook(name, callback) { this.hooks[name] = callback; }
  }
  const { exports } = load('../src/database/models/index.js', environment, {
    sequelize: Sequelize,
    './registerModels': { initializeModelsForConnection: (instance) => ({ sequelize: instance }) },
    '../config/config.js': { test: { database: 'mundo_3d_test' }, production: {} },
  });
  return { initialize: exports.initializeModels, events, instance: () => sequelize };
}

test('the real model factory validates every new/replacement physical pool connection', async () => {
  const h = poolHarness(env());
  h.initialize();
  const hook = h.instance().hooks.afterConnect;
  assert.equal(typeof hook, 'function');
  for (const observed of [UUID, UUID, OTHER_UUID]) {
    const events = [];
    const connection = {
      promise: () => ({ query: async (sql) => { events.push(sql); return [[{ uuid: observed, connectionId: 8 }]]; } }),
      destroy: () => events.push('destroy'),
    };
    if (observed === UUID) {
      await hook(connection);
      assert.deepEqual(events, [IDENTITY_QUERY]);
    } else {
      await assert.rejects(hook(connection), /MySQL endpoint verification failed/);
      assert.deepEqual(events, [IDENTITY_QUERY, 'destroy']);
    }
  }
});

test('model factory rejects partial E2E context before constructing a pool', () => {
  const h = poolHarness({ ...env(), M3D_E2E_EXPECTED_SERVER_UUID: undefined });
  assert.throws(h.initialize, /E2E database context rejected/);
  assert.deepEqual(h.events, []);
});

test('ordinary integration model initialization does not acquire an E2E-only hook', () => {
  const h = poolHarness({ NODE_ENV: 'test' });
  h.initialize();
  assert.deepEqual(Object.keys(h.instance().hooks), []);
});

test('authorized preparation preserves sync, seed and fixture behavior', async () => {
  const effects = [];
  const { exports, events } = load('../src/database/test-prepare.js', env(), {
    bcryptjs: {},
    './config/ensureDatabase': { ensureDatabaseExists: async (mode) => { effects.push(['ensure', mode]); } },
    './models/db': {
      sequelize: { sync: async (options) => effects.push(['sync', options.force]),
        close: async () => effects.push(['close']) },
      Product: { count: async () => 2 }, User: { findOne: async () => ({ idUser: 1 }) },
    },
    './seed': { seedInitialData: async () => { effects.push(['seed']); } },
  });
  await exports.prepare();
  assert.deepEqual(effects, [['ensure', 'test'], ['sync', true], ['seed'], ['close']]);
  assert.deepEqual(events, [
    ['stdout', 'Preparing test database...'],
    ['stdout', '✔ Database schema recreated successfully.'],
    ['stdout', 'Test database preparation complete.'], ['exit', 0],
  ]);
});

test('public preparation CLI rejects without context with exact exit and output', () => {
  const { spawnSync } = require('node:child_process');
  const result = spawnSync(process.execPath, [path.resolve(__dirname, '../src/database/test-prepare.js')],
    { env: {}, encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.equal(result.stdout, '');
  assert.equal(result.stderr, 'Error preparing test database: E2E database context rejected\n');
});

test('direct preparation rejects missing context without opening, syncing or seeding', async () => {
  const effects = [];
  const { exports, events } = load('../src/database/test-prepare.js', {}, {
    bcryptjs: { hashSync: () => { effects.push('hash'); } },
    './config/ensureDatabase': { ensureDatabaseExists: async () => { effects.push('ensure'); } },
    './models/db': { sequelize: { sync: async () => { effects.push('sync'); }, close: async () => {} } },
    './seed': { seedInitialData: async () => { effects.push('seed'); } },
  });
  assert.equal(typeof exports.prepare, 'function');
  await exports.prepare();
  assert.deepEqual(effects, []);
  assert.deepEqual(events, [['stderr', 'Error preparing test database:', 'E2E database context rejected'], ['exit', 1]]);
});

test('unexpected preparation failures keep the full error for diagnosis', async () => {
  const failure = new Error('database exploded');
  const { exports, events } = load('../src/database/test-prepare.js', env(), {
    bcryptjs: {},
    './config/ensureDatabase': { ensureDatabaseExists: async () => { throw failure; } },
    './models/db': { sequelize: {} }, './seed': { seedInitialData: async () => {} },
  });
  await exports.prepare();
  const stderr = events.find(event => event[0] === 'stderr');
  assert.deepEqual(stderr.slice(0, 2), ['stderr', 'Error preparing test database:']);
  assert.equal(stderr[2], failure);
  assert.deepEqual(events.at(-1), ['exit', 1]);
});
