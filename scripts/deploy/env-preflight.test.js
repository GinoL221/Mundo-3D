const test = require('node:test');
const assert = require('node:assert/strict');
const childProcess = require('node:child_process');
const path = require('node:path');
const { checkEnv, REQUIRED, WARN_ONLY } = require('./env-preflight');

const SCRIPT = path.join(__dirname, 'env-preflight.js');

function buildFullEnv() {
  const env = {};
  for (const key of REQUIRED) env[key] = 'value';
  for (const key of WARN_ONLY) env[key] = 'value';
  return env;
}

// Runs env-preflight.js as its own process (the real deploy entrypoint) with a
// fully controlled environment, so the assertions are on the actual exit code
// the deploy `&&` chain short-circuits on.
function runPreflight(env) {
  return childProcess.spawnSync(process.execPath, [SCRIPT], {
    env,
    encoding: 'utf8',
  });
}

test('all required vars and every warn-only var present -> no missing, no warnings', () => {
  const result = checkEnv(buildFullEnv());
  assert.deepEqual(result, { missing: [], warnings: [] });
});

test('the hard-required list matches the deploy-pipeline spec contract, in order', () => {
  assert.deepEqual(REQUIRED, [
    'JWT_SECRET',
    'CORS_ORIGIN',
    'COOKIE_SECRET',
    'DB_USER',
    'DB_PASS',
    'DB_NAME',
    'DB_HOST',
    'DB_PORT',
    'DB_CA_CERT',
  ]);
});

test('PUBLIC_API_URL is warn-only, not hard-required', () => {
  assert.ok(WARN_ONLY.includes('PUBLIC_API_URL'));
  assert.ok(!REQUIRED.includes('PUBLIC_API_URL'));
});

test('DB_PORT missing -> reported in missing', () => {
  const env = buildFullEnv();
  delete env.DB_PORT;
  assert.deepEqual(checkEnv(env).missing, ['DB_PORT']);
});

test('DB_CA_CERT missing -> reported in missing', () => {
  const env = buildFullEnv();
  delete env.DB_CA_CERT;
  assert.deepEqual(checkEnv(env).missing, ['DB_CA_CERT']);
});

test('3 required vars missing -> reported in REQUIRED array order', () => {
  const env = buildFullEnv();
  delete env.JWT_SECRET;
  delete env.DB_PASS;
  delete env.DB_CA_CERT;
  const result = checkEnv(env);
  assert.deepEqual(result.missing, ['JWT_SECRET', 'DB_PASS', 'DB_CA_CERT']);
});

test('an empty-string value counts as unset', () => {
  const env = buildFullEnv();
  env.DB_HOST = '';
  const result = checkEnv(env);
  assert.deepEqual(result.missing, ['DB_HOST']);
});

test('all required present, COOKIE_DOMAIN absent -> warns, does not fail', () => {
  const env = buildFullEnv();
  delete env.COOKIE_DOMAIN;
  const result = checkEnv(env);
  assert.deepEqual(result, { missing: [], warnings: ['COOKIE_DOMAIN'] });
});

test('all required present, PUBLIC_API_URL absent -> warns, does not fail', () => {
  const env = buildFullEnv();
  delete env.PUBLIC_API_URL;
  const result = checkEnv(env);
  assert.deepEqual(result, { missing: [], warnings: ['PUBLIC_API_URL'] });
});

test('script exits non-zero and names DB_PORT when it is unset', () => {
  const env = buildFullEnv();
  delete env.DB_PORT;
  const result = runPreflight(env);
  assert.notEqual(result.status, 0);
  assert.match(result.stdout, /DB_PORT/);
});

test('script exits non-zero and names DB_CA_CERT when it is unset', () => {
  const env = buildFullEnv();
  delete env.DB_CA_CERT;
  const result = runPreflight(env);
  assert.notEqual(result.status, 0);
  assert.match(result.stdout, /DB_CA_CERT/);
});

test('script exits 0 with only a warning when PUBLIC_API_URL is the sole unset var', () => {
  const env = buildFullEnv();
  delete env.PUBLIC_API_URL;
  const result = runPreflight(env);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /WARN:.*PUBLIC_API_URL/);
});

test('script exits 0 when every hard-required var is set', () => {
  const result = runPreflight(buildFullEnv());
  assert.equal(result.status, 0);
});
