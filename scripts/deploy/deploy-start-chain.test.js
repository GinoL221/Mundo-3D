const test = require('node:test');
const assert = require('node:assert/strict');
const childProcess = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const BACKEND_PKG = path.join(REPO_ROOT, 'backend', 'package.json');

const { REQUIRED } = require('./env-preflight');

function readStartCommand() {
  const pkg = JSON.parse(fs.readFileSync(BACKEND_PKG, 'utf8'));
  return pkg.scripts['deploy:start'];
}

test('backend exposes a deploy:start script that chains preflight into migrate-and-start', () => {
  const cmd = readStartCommand();
  assert.ok(cmd, 'expected backend package.json to define scripts["deploy:start"]');
  assert.match(cmd, /env-preflight/);
  assert.match(cmd, /migrate-and-start/);
});

test('deploy:start runs the preflight before migrate-and-start, joined by a short-circuiting &&', () => {
  const cmd = readStartCommand();
  const preflightAt = cmd.indexOf('env-preflight');
  const migrateAt = cmd.indexOf('migrate-and-start');
  assert.ok(preflightAt < migrateAt, 'preflight must be invoked before migrate-and-start');
  const between = cmd.slice(preflightAt, migrateAt);
  // Joined by && so a non-zero preflight short-circuits and the app never starts.
  assert.match(between, /&&/);
});

test('a missing required var makes deploy:start exit non-zero without reaching migrate/start', () => {
  const env = { PATH: process.env.PATH, HOME: process.env.HOME };
  for (const key of REQUIRED) env[key] = 'value';
  delete env.DB_PORT;

  const result = childProcess.spawnSync('pnpm', ['--filter', 'backend', 'deploy:start'], {
    cwd: REPO_ROOT,
    env,
    encoding: 'utf8',
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stdout, /DB_PORT/);
  assert.doesNotMatch(result.stdout + result.stderr, /db:migrate/);
});
