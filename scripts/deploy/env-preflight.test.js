const test = require('node:test');
const assert = require('node:assert/strict');
const childProcess = require('node:child_process');
const path = require('node:path');
const { checkEnv, REQUIRED, WARN_ONLY } = require('./env-preflight');

const SCRIPT = path.join(__dirname, 'env-preflight.js');

function buildFullEnv() {
  // NODE_ENV is checked by value rather than presence, so it is not in
  // REQUIRED, but a correctly configured deploy environment still has it.
  const env = { NODE_ENV: 'production' };
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
  assert.deepEqual(result, { missing: [], warnings: [], nodeEnv: null });
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
    'R2_ENDPOINT',
    'R2_ACCESS_KEY_ID',
    'R2_SECRET_ACCESS_KEY',
    'R2_BUCKET_NAME',
    'R2_PUBLIC_URL_BASE',
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

// NODE_ENV is not a "present or absent" variable like the rest: setting it to
// `test` makes the app fall back to secrets that are committed in this
// repository and disables both rate limiters. It must equal `production`.
test('NODE_ENV=production -> no nodeEnv problem reported', () => {
  const { nodeEnv } = checkEnv({ ...buildFullEnv(), NODE_ENV: 'production' });
  assert.equal(nodeEnv, null);
});

test('NODE_ENV=test -> reported as a nodeEnv problem', () => {
  const { nodeEnv } = checkEnv({ ...buildFullEnv(), NODE_ENV: 'test' });
  assert.ok(nodeEnv, 'expected a nodeEnv problem to be reported');
  assert.match(nodeEnv, /NODE_ENV/);
});

test('NODE_ENV=development -> reported as a nodeEnv problem', () => {
  const { nodeEnv } = checkEnv({ ...buildFullEnv(), NODE_ENV: 'development' });
  assert.ok(nodeEnv);
});

test('NODE_ENV unset -> reported as a nodeEnv problem', () => {
  const env = buildFullEnv();
  delete env.NODE_ENV;
  const { nodeEnv } = checkEnv(env);
  assert.ok(nodeEnv);
});

test('all required present, COOKIE_DOMAIN absent -> warns, does not fail', () => {
  const env = buildFullEnv();
  delete env.COOKIE_DOMAIN;
  const result = checkEnv(env);
  assert.deepEqual(result, { missing: [], warnings: ['COOKIE_DOMAIN'], nodeEnv: null });
});

test('all required present, PUBLIC_API_URL absent -> warns, does not fail', () => {
  const env = buildFullEnv();
  delete env.PUBLIC_API_URL;
  const result = checkEnv(env);
  assert.deepEqual(result, { missing: [], warnings: ['PUBLIC_API_URL'], nodeEnv: null });
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

for (const r2Var of [
  'R2_ENDPOINT',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'R2_BUCKET_NAME',
  'R2_PUBLIC_URL_BASE',
]) {
  test(`${r2Var} missing -> reported in missing, not warnings`, () => {
    const env = buildFullEnv();
    delete env[r2Var];
    const result = checkEnv(env);
    assert.deepEqual(result.missing, [r2Var]);
    assert.ok(!result.warnings.includes(r2Var));
  });

  test(`script exits non-zero and names ${r2Var} when it is unset`, () => {
    const env = buildFullEnv();
    delete env[r2Var];
    const result = runPreflight(env);
    assert.notEqual(result.status, 0);
    assert.match(result.stdout, new RegExp(r2Var));
  });
}

test('script exits 0 with only a warning when PUBLIC_API_URL is the sole unset var', () => {
  const env = buildFullEnv();
  delete env.PUBLIC_API_URL;
  const result = runPreflight(env);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /WARN:.*PUBLIC_API_URL/);
});

test('script exits non-zero and explains the risk when NODE_ENV is test', () => {
  const result = runPreflight({ ...buildFullEnv(), NODE_ENV: 'test' });
  assert.notEqual(result.status, 0);
  assert.match(result.stdout, /NODE_ENV must be "production"/);
  assert.match(result.stdout, /committed in this repository/);
});

test('script exits 0 when every hard-required var is set', () => {
  const result = runPreflight(buildFullEnv());
  assert.equal(result.status, 0);
});
