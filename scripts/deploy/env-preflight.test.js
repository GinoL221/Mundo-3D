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
  assert.deepEqual(result, {
    missing: [],
    warnings: [],
    nodeEnv: null,
    storageDriver: null,
    demoSandbox: null,
  });
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
  assert.deepEqual(result, {
    missing: [],
    warnings: ['COOKIE_DOMAIN'],
    nodeEnv: null,
    storageDriver: null,
    demoSandbox: null,
  });
});

test('all required present, PUBLIC_API_URL absent -> warns, does not fail', () => {
  const env = buildFullEnv();
  delete env.PUBLIC_API_URL;
  const result = checkEnv(env);
  assert.deepEqual(result, {
    missing: [],
    warnings: ['PUBLIC_API_URL'],
    nodeEnv: null,
    storageDriver: null,
    demoSandbox: null,
  });
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

test('STORAGE_DRIVER=r2 explicit requires R2 vars and passes when set', () => {
  const env = { ...buildFullEnv(), STORAGE_DRIVER: 'r2' };
  assert.deepEqual(checkEnv(env), {
    missing: [],
    warnings: [],
    nodeEnv: null,
    storageDriver: null,
    demoSandbox: null,
  });
  assert.equal(runPreflight(env).status, 0);
});

test('STORAGE_DRIVER=cloudinary requires CLOUDINARY_* vars and does not require R2_* vars', () => {
  const env = {
    NODE_ENV: 'production',
    STORAGE_DRIVER: '  CLOUDINARY ',
    JWT_SECRET: 'value',
    CORS_ORIGIN: 'value',
    COOKIE_SECRET: 'value',
    DB_USER: 'value',
    DB_PASS: 'value',
    DB_NAME: 'value',
    DB_HOST: 'value',
    DB_PORT: 'value',
    DB_CA_CERT: 'value',
    COOKIE_DOMAIN: 'value',
    PUBLIC_API_URL: 'value',
    CLOUDINARY_CLOUD_NAME: 'cloud',
    CLOUDINARY_API_KEY: 'key',
    CLOUDINARY_API_SECRET: 'secret',
  };
  assert.deepEqual(checkEnv(env), {
    missing: [],
    warnings: [],
    nodeEnv: null,
    storageDriver: null,
    demoSandbox: null,
  });
  assert.equal(runPreflight(env).status, 0);
});

for (const cloudVar of ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET']) {
  test(`STORAGE_DRIVER=cloudinary reports missing ${cloudVar} and exits non-zero`, () => {
    const env = {
      NODE_ENV: 'production',
      STORAGE_DRIVER: 'cloudinary',
      JWT_SECRET: 'value',
      CORS_ORIGIN: 'value',
      COOKIE_SECRET: 'value',
      DB_USER: 'value',
      DB_PASS: 'value',
      DB_NAME: 'value',
      DB_HOST: 'value',
      DB_PORT: 'value',
      DB_CA_CERT: 'value',
      CLOUDINARY_CLOUD_NAME: 'cloud',
      CLOUDINARY_API_KEY: 'key',
      CLOUDINARY_API_SECRET: 'secret',
    };
    delete env[cloudVar];
    assert.deepEqual(checkEnv(env).missing, [cloudVar]);
    const res = runPreflight(env);
    assert.notEqual(res.status, 0);
    assert.match(res.stdout, new RegExp(cloudVar));
  });
}

test('STORAGE_DRIVER=disabled requires no storage provider vars and exits 0', () => {
  const env = {
    NODE_ENV: 'production',
    STORAGE_DRIVER: 'disabled',
    JWT_SECRET: 'value',
    CORS_ORIGIN: 'value',
    COOKIE_SECRET: 'value',
    DB_USER: 'value',
    DB_PASS: 'value',
    DB_NAME: 'value',
    DB_HOST: 'value',
    DB_PORT: 'value',
    DB_CA_CERT: 'value',
    COOKIE_DOMAIN: 'value',
    PUBLIC_API_URL: 'value',
  };
  assert.deepEqual(checkEnv(env), {
    missing: [],
    warnings: [],
    nodeEnv: null,
    storageDriver: null,
    demoSandbox: null,
  });
  assert.equal(runPreflight(env).status, 0);
});

test('invalid STORAGE_DRIVER fails closed with explicit STORAGE_DRIVER error and exits non-zero', () => {
  const env = { ...buildFullEnv(), STORAGE_DRIVER: 's3-typo' };
  const result = checkEnv(env);
  assert.ok(result.storageDriver);
  assert.match(result.storageDriver, /STORAGE_DRIVER/);
  const res = runPreflight(env);
  assert.notEqual(res.status, 0);
  assert.match(res.stdout, /STORAGE_DRIVER/);
});

const VALID_SANDBOX_SLOTS = JSON.stringify([
  { slotId: 'slot-1', database: 'demo_slot_1', username: 'demo_u1', password: 'p1' },
  { slotId: 'slot-2', database: 'demo_slot_2', username: 'demo_u2', password: 'p2' },
  { slotId: 'slot-3', database: 'demo_slot_3', username: 'demo_u3', password: 'p3' },
]);

test('DEMO_SANDBOX_ENABLED=false keeps sandbox vars unrequired and exits 0', () => {
  const env = { ...buildFullEnv(), DEMO_SANDBOX_ENABLED: 'false' };
  assert.deepEqual(checkEnv(env), {
    missing: [],
    warnings: [],
    nodeEnv: null,
    storageDriver: null,
    demoSandbox: null,
  });
  assert.equal(runPreflight(env).status, 0);
});

test('DEMO_SANDBOX_ENABLED=true passes when secret is distinct and 3-5 slots are valid', () => {
  const env = {
    ...buildFullEnv(),
    DB_NAME: 'mundo_3d_control',
    DB_PORT: '4000',
    DEMO_SANDBOX_ENABLED: 'true',
    DEMO_SANDBOX_JWT_SECRET: 'sandbox-distinct-secret-at-least-32-chars',
    DEMO_SANDBOX_SLOTS_JSON: VALID_SANDBOX_SLOTS,
  };
  assert.deepEqual(checkEnv(env), {
    missing: [],
    warnings: [],
    nodeEnv: null,
    storageDriver: null,
    demoSandbox: null,
  });
  assert.equal(runPreflight(env).status, 0);
});

test('DEMO_SANDBOX_ENABLED=true requires DEMO_SANDBOX_JWT_SECRET and DEMO_SANDBOX_SLOTS_JSON', () => {
  const env = { ...buildFullEnv(), DEMO_SANDBOX_ENABLED: 'true' };
  assert.deepEqual(checkEnv(env).missing, ['DEMO_SANDBOX_JWT_SECRET', 'DEMO_SANDBOX_SLOTS_JSON']);
  const res = runPreflight(env);
  assert.notEqual(res.status, 0);
  assert.match(res.stdout, /DEMO_SANDBOX_JWT_SECRET/);
});

for (const [label, override] of [
  ['invalid DEMO_SANDBOX_ENABLED', { DEMO_SANDBOX_ENABLED: 'yes' }],
  ['invalid DEMO_SANDBOX_RECOVER_ON_BOOT', { DEMO_SANDBOX_RECOVER_ON_BOOT: '1' }],
  ['invalid DEMO_SANDBOX_DB_HOST', { DEMO_SANDBOX_DB_HOST: 'https://bad host/path' }],
  ['blank DEMO_SANDBOX_DB_HOST', { DEMO_SANDBOX_DB_HOST: '   ' }],
  ['invalid fallback DB_PORT', { DB_PORT: 'not-a-port' }],
  ['invalid DEMO_SANDBOX_DB_PORT', { DEMO_SANDBOX_DB_PORT: '4000abc' }],
  ['invalid DB_NAME identifier', { DB_NAME: 'bad-db!' }],
  ['blank DEMO_SANDBOX_DB_CA_CERT', { DEMO_SANDBOX_DB_CA_CERT: '   ' }],
  ['blank DEMO_SANDBOX_JWT_SECRET', { DEMO_SANDBOX_JWT_SECRET: '   ' }],
  ['short DEMO_SANDBOX_JWT_SECRET', { DEMO_SANDBOX_JWT_SECRET: 'a'.repeat(31) }],
  [
    'secret equal to JWT_SECRET',
    {
      JWT_SECRET: 'shared-secret-at-least-32-chars-long-0001',
      DEMO_SANDBOX_JWT_SECRET: 'shared-secret-at-least-32-chars-long-0001',
    },
  ],
  [
    'fewer than 3 slots',
    { DEMO_SANDBOX_SLOTS_JSON: JSON.stringify(JSON.parse(VALID_SANDBOX_SLOTS).slice(0, 2)) },
  ],
  [
    'more than 5 slots',
    {
      DEMO_SANDBOX_SLOTS_JSON: JSON.stringify(
        Array.from({ length: 6 }, (_, i) => ({
          slotId: `slot-${i + 1}`,
          database: `demo_slot_${i + 1}`,
          username: `demo_u${i + 1}`,
          password: `p${i + 1}`,
        })),
      ),
    },
  ],
  [
    'root slot account',
    { DEMO_SANDBOX_SLOTS_JSON: VALID_SANDBOX_SLOTS.replace('demo_u3', 'root') },
  ],
  ['slot user colliding with DB_USER', { DB_USER: 'demo_u2' }],
  [
    'slot DB colliding with DB_NAME',
    { DEMO_SANDBOX_SLOTS_JSON: VALID_SANDBOX_SLOTS.replace('demo_slot_3', 'value') },
  ],
]) {
  test(`demo sandbox preflight fails closed on ${label}`, () => {
    const env = {
      ...buildFullEnv(),
      DB_PORT: '4000',
      DEMO_SANDBOX_ENABLED: 'true',
      DEMO_SANDBOX_JWT_SECRET: 'sandbox-distinct-secret-at-least-32-chars',
      DEMO_SANDBOX_SLOTS_JSON: VALID_SANDBOX_SLOTS,
      ...override,
    };
    const result = checkEnv(env);
    assert.ok(result.demoSandbox);
    const res = runPreflight(env);
    assert.notEqual(res.status, 0);
    assert.match(res.stdout, /FAIL:/);
  });
}

test('demo sandbox preflight distinguishes short secret from JWT_SECRET collision', () => {
  const base = {
    ...buildFullEnv(),
    DB_PORT: '4000',
    DEMO_SANDBOX_ENABLED: 'true',
    DEMO_SANDBOX_SLOTS_JSON: VALID_SANDBOX_SLOTS,
  };
  assert.match(
    checkEnv({ ...base, DEMO_SANDBOX_JWT_SECRET: 'a'.repeat(31) }).demoSandbox,
    /at least 32 characters/,
  );
  const shared = 'shared-secret-at-least-32-chars-long-0001';
  assert.match(
    checkEnv({ ...base, JWT_SECRET: shared, DEMO_SANDBOX_JWT_SECRET: shared }).demoSandbox,
    /must differ from JWT_SECRET/,
  );
});
