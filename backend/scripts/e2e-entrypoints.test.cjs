'use strict';
const test = require('node:test');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const path = require('node:path');
const { EventEmitter } = require('node:events');
const { runE2EIsolated } = require('./run-e2e-isolated.cjs');
const root = path.resolve(__dirname, '../..');

test('standard, UI and debug scripts enter supervision; root Chromium forwarding is preserved', () => {
  const scripts = JSON.parse(fs.readFileSync(path.join(root, 'e2e/package.json'), 'utf8')).scripts;
  assert.equal(scripts.test, 'node ../backend/scripts/run-e2e-isolated.cjs --playwright');
  assert.equal(scripts['test:ui'], `${scripts.test} --ui`);
  assert.equal(scripts['test:debug'], `${scripts.test} --debug`);
  const rootScripts = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).scripts;
  assert.equal(rootScripts['test:e2e'], 'pnpm --filter e2e test --project=chromium');
  assert.ok(rootScripts['test:deploy-scripts'].includes('backend/scripts/**/*.test.cjs'));
});

test('automatic runner forwards flags exactly once without recursing into the package test script', async () => {
  const signals = new EventEmitter(); let calls = 0;
  await runE2EIsolated(['--playwright', '--ui', '--grep', 'two words'], { signals,
    supervisor: { run: async work => work({ env: { M3D_E2E_RUN_ID: 'test-run' } }) },
    runCommand: async (cmd, args, options) => {
      calls++;
      assert.equal(cmd, 'pnpm');
      assert.deepEqual(args, ['--dir', root, '--filter', 'e2e', 'exec', 'playwright', 'test', '--ui', '--grep', 'two words']);
      assert.equal(options.env.M3D_E2E_RUN_ID, 'test-run');
    } });
  assert.equal(calls, 1);
  assert.equal(signals.listenerCount('SIGINT') + signals.listenerCount('SIGTERM'), 0);
});

test('help never provisions resources through the public runner', async () => {
  let printed = 0;
  await runE2EIsolated(['--help'], { printHelp: () => { printed++; },
    supervisor: { run: () => { throw new Error('must not provision'); } } });
  assert.equal(printed, 1);
});

test('manual runner command remains supported; signal handlers are removed on failure', async () => {
  const signals = new EventEmitter();
  await assert.rejects(runE2EIsolated(['node', '-e', 'example'], { signals,
    supervisor: { run: async work => work({ env: {} }) },
    runCommand: async (command, args) => {
      assert.equal(command, 'node'); assert.deepEqual(args, ['-e', 'example']); throw new Error('child failed');
    },
  }), /child failed/);
  assert.equal(signals.listenerCount('SIGINT') + signals.listenerCount('SIGTERM'), 0);
});

