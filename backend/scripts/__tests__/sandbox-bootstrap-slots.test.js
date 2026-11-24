'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const SCRIPT_PATH = path.resolve(__dirname, '../sandbox-bootstrap-slots.cjs');
const {
  BUSINESS_MIGRATIONS,
  parseBootstrapConfig,
  resolveSlotMigrations,
  buildDryRunPlan,
  formatMissingDatabaseError,
} = require(SCRIPT_PATH);

const makeSlots = (count = 3) =>
  Array.from({ length: count }, (_, idx) => ({
    slotId: `slot-${idx + 1}`,
    database: `m3d_demo_slot_${idx + 1}`,
    username: `m3d_demo_user_${idx + 1}`,
    password: `super-secret-slot-pass-${idx + 1}`,
  }));

const makeEnv = (overrides = {}) => ({
  DB_HOST: '127.0.0.1',
  DB_PORT: '3306',
  DB_NAME: 'mundo_3d_prod',
  DB_USER: 'mundo_3d_app',
  SANDBOX_BOOTSTRAP_ADMIN_USER: 'tidb_admin',
  SANDBOX_BOOTSTRAP_ADMIN_PASS: 'super-secret-admin-pass',
  DEMO_SANDBOX_SLOTS_JSON: JSON.stringify(makeSlots(3)),
  ...overrides,
});

describe('sandbox-bootstrap-slots', () => {
  it('parses valid config with host/port/TLS fallbacks and expands escaped newlines in CA cert', () => {
    const cfg = parseBootstrapConfig(makeEnv({
      DEMO_SANDBOX_DB_HOST: 'gateway01.us-east-1.prod.aws.tidbcloud.com',
      DEMO_SANDBOX_DB_PORT: '4000',
      DEMO_SANDBOX_DB_CA_CERT: '-----BEGIN CERTIFICATE-----\\nABC\\n-----END CERTIFICATE-----',
    }));
    assert.equal(cfg.host, 'gateway01.us-east-1.prod.aws.tidbcloud.com');
    assert.equal(cfg.port, 4000);
    assert.equal(cfg.adminUser, 'tidb_admin');
    assert.equal(cfg.slots.length, 3);
    assert.equal(cfg.caCert, '-----BEGIN CERTIFICATE-----\nABC\n-----END CERTIFICATE-----');

    const fallbackTls = parseBootstrapConfig(makeEnv({ DB_CA_CERT: '-----BEGIN CERTIFICATE-----\\nFB\\n-----END CERTIFICATE-----' }));
    assert.equal(fallbackTls.caCert, '-----BEGIN CERTIFICATE-----\nFB\n-----END CERTIFICATE-----');
    assert.equal(parseBootstrapConfig(makeEnv()).caCert, undefined);
    assert.throws(() => parseBootstrapConfig(makeEnv({ DB_NAME: '' })), /DB_NAME/);
    assert.throws(() => parseBootstrapConfig(makeEnv({ DB_USER: '' })), /DB_USER/);
  });

  it('rejects missing/invalid slots JSON, <3 or >5 slots, and duplicate/invalid identifiers', () => {
    assert.throws(() => parseBootstrapConfig(makeEnv({ DEMO_SANDBOX_SLOTS_JSON: '' })), /DEMO_SANDBOX_SLOTS_JSON/);
    assert.throws(() => parseBootstrapConfig(makeEnv({ DEMO_SANDBOX_SLOTS_JSON: '{bad' })), /valid JSON/i);
    assert.throws(() => parseBootstrapConfig(makeEnv({ DEMO_SANDBOX_SLOTS_JSON: JSON.stringify(makeSlots(2)) })), /between 3 and 5/i);
    assert.throws(() => parseBootstrapConfig(makeEnv({ DEMO_SANDBOX_SLOTS_JSON: JSON.stringify(makeSlots(6)) })), /between 3 and 5/i);
    const dupDb = makeSlots(3);
    dupDb[1].database = dupDb[0].database.toUpperCase();
    assert.throws(() => parseBootstrapConfig(makeEnv({ DEMO_SANDBOX_SLOTS_JSON: JSON.stringify(dupDb) })), /colliding|invalid/i);
    const badSql = makeSlots(3);
    badSql[0].database = 'bad-db-name';
    assert.throws(() => parseBootstrapConfig(makeEnv({ DEMO_SANDBOX_SLOTS_JSON: JSON.stringify(badSql) })), /invalid/i);
  });

  it('rejects collisions with DB_NAME, DB_USER, root, and MySQL system databases', () => {
    const dbCollision = makeSlots(3);
    dbCollision[0].database = 'MUNDO_3D_PROD';
    assert.throws(() => parseBootstrapConfig(makeEnv({ DEMO_SANDBOX_SLOTS_JSON: JSON.stringify(dbCollision) })), /colliding|reserved/i);
    const userCollision = makeSlots(3);
    userCollision[1].username = 'MUNDO_3D_APP';
    assert.throws(() => parseBootstrapConfig(makeEnv({ DEMO_SANDBOX_SLOTS_JSON: JSON.stringify(userCollision) })), /colliding|reserved/i);
    const rootUser = makeSlots(3);
    rootUser[2].username = 'ROOT';
    assert.throws(() => parseBootstrapConfig(makeEnv({ DEMO_SANDBOX_SLOTS_JSON: JSON.stringify(rootUser) })), /colliding|reserved/i);
    for (const sysDb of ['mysql', 'information_schema', 'performance_schema', 'sys']) {
      const sysSlots = makeSlots(3);
      sysSlots[0].database = sysDb;
      assert.throws(() => parseBootstrapConfig(makeEnv({ DEMO_SANDBOX_SLOTS_JSON: JSON.stringify(sysSlots) })), /colliding|reserved/i);
    }
  });

  it('rejects missing admin credentials, invalid port/host, and blank CA cert', () => {
    assert.throws(() => parseBootstrapConfig(makeEnv({ SANDBOX_BOOTSTRAP_ADMIN_USER: '' })), /SANDBOX_BOOTSTRAP_ADMIN_USER/);
    assert.throws(() => parseBootstrapConfig(makeEnv({ SANDBOX_BOOTSTRAP_ADMIN_PASS: '' })), /SANDBOX_BOOTSTRAP_ADMIN_PASS/);
    assert.throws(() => parseBootstrapConfig(makeEnv({ DB_PORT: '70000' })), /port/i);
    assert.throws(() => parseBootstrapConfig(makeEnv({ DB_HOST: 'bad host!' })), /host/i);
    assert.throws(() => parseBootstrapConfig(makeEnv({ DEMO_SANDBOX_DB_CA_CERT: '   ' })), /CA_CERT/i);
  });

  it('resolves exact business + slot migrations in order and excludes control-plane migration', () => {
    const migrations = resolveSlotMigrations();
    const names = migrations.map((m) => m.name);
    assert.deepEqual(names.slice(0, BUSINESS_MIGRATIONS.length), [
      '20260724000000-baseline.js',
      '20260828000000-orders.js',
      '20260901000000-refresh-token-rotation.js',
      '20260902000000-email-confirmation.js',
      '20260927000000-custom-commission-requests.js',
    ]);
    assert.equal(names.includes('20261026000000-demo-sandbox-slots.js'), false);
    assert.deepEqual(names.slice(BUSINESS_MIGRATIONS.length), [
      '20261102000000-demo-sandbox-fence.js',
      '20261103000000-demo-sandbox-reset-receipt.js',
      '20261104000000-demo-sandbox-release-operation.js',
      '20261105000000-demo-sandbox-release-session.js',
    ]);
    for (const mig of migrations) assert.equal(fs.existsSync(mig.filePath), true);
  });

  it('builds --dry-run plan and CLI output without leaking any passwords', () => {
    const env = makeEnv({ DEMO_SANDBOX_DB_CA_CERT: '---CERT---' });
    const plan = buildDryRunPlan(parseBootstrapConfig(env), resolveSlotMigrations());
    assert.equal(plan.tlsEnabled, true);
    assert.equal(plan.slots.length, 3);
    assert.equal('password' in plan.slots[0], false);
    assert.equal('adminPass' in plan, false);

    const stdout = execFileSync(process.execPath, [SCRIPT_PATH, '--dry-run'], {
      env: { ...process.env, ...env },
      encoding: 'utf8',
    });
    assert.match(stdout, /DRY-RUN/);
    assert.match(stdout, /m3d_demo_slot_1/);
    assert.match(stdout, /20261105000000-demo-sandbox-release-session\.js/);
    assert.equal(stdout.includes('super-secret-admin-pass'), false);
    assert.equal(stdout.includes('super-secret-slot-pass-1'), false);
  });

  it('formats actionable SQL guidance when a slot database does not exist without leaking secrets', () => {
    const slot = makeSlots(3)[0];
    const msg = formatMissingDatabaseError(slot);
    assert.match(msg, /CREATE DATABASE `m3d_demo_slot_1`/);
    assert.match(msg, /GRANT SELECT, INSERT, UPDATE, DELETE ON `m3d_demo_slot_1`\.\* TO 'm3d_demo_user_1'@'%'/);
    assert.equal(msg.includes(slot.password), false);
  });
});
