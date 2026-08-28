const test = require('node:test');
const assert = require('node:assert/strict');
const { checkEnv, REQUIRED, WARN_ONLY } = require('./env-preflight');

function buildFullEnv() {
  const env = {};
  for (const key of REQUIRED) env[key] = 'value';
  for (const key of WARN_ONLY) env[key] = 'value';
  return env;
}

test('all required vars and COOKIE_DOMAIN present -> no missing, no warnings', () => {
  const result = checkEnv(buildFullEnv());
  assert.deepEqual(result, { missing: [], warnings: [] });
});

test('all required present, COOKIE_DOMAIN absent -> warns, does not fail', () => {
  const env = buildFullEnv();
  delete env.COOKIE_DOMAIN;
  const result = checkEnv(env);
  assert.deepEqual(result, { missing: [], warnings: ['COOKIE_DOMAIN'] });
});

test('3 required vars missing -> reported in REQUIRED array order', () => {
  const env = buildFullEnv();
  delete env.JWT_SECRET;
  delete env.DB_PASS;
  delete env.PUBLIC_API_URL;
  const result = checkEnv(env);
  assert.deepEqual(result.missing, ['JWT_SECRET', 'DB_PASS', 'PUBLIC_API_URL']);
});

test('an empty-string value counts as unset', () => {
  const env = buildFullEnv();
  env.DB_HOST = '';
  const result = checkEnv(env);
  assert.deepEqual(result.missing, ['DB_HOST']);
});
