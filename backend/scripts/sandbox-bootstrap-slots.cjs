'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { QueryTypes, Sequelize } = require('sequelize');
const { Umzug, SequelizeStorage } = require('umzug');

const BACKEND_ROOT = path.resolve(__dirname, '..');
const MIGRATIONS_DIR = path.join(BACKEND_ROOT, 'src/database/migrations');
const SLOT_MIGRATIONS_DIR = path.join(BACKEND_ROOT, 'src/database/slot-migrations');
const SYSTEM_DATABASES = new Set(['mysql', 'information_schema', 'performance_schema', 'sys']);
const SLOT_ID_RE = /^[a-zA-Z0-9_-]{1,64}$/;
const HOST_RE = /^[a-zA-Z0-9.:-]+$/;
const BUSINESS_MIGRATIONS = Object.freeze([
  '20260724000000-baseline.js',
  '20260828000000-orders.js',
  '20260901000000-refresh-token-rotation.js',
  '20260902000000-email-confirmation.js',
  '20260927000000-custom-commission-requests.js',
]);
const isSqlIdentifier = (v, max) => typeof v === 'string' && v.length <= max && /^[a-zA-Z0-9_]+$/.test(v);
const isSqlUsername = (v, max) =>
  typeof v === 'string' && v.length <= max && /^[a-zA-Z0-9_]+(?:\.[a-zA-Z0-9_]+)?$/.test(v);
const isRootSqlUsername = (userLower) => userLower === 'root' || userLower.endsWith('.root');

function normalizeCaCert(env) {
  const raw = env.DEMO_SANDBOX_DB_CA_CERT || env.DB_CA_CERT || undefined;
  if (raw === undefined) return undefined;
  const normalized = String(raw).replace(/\\n/g, '\n');
  if (!normalized.trim()) throw new Error('DEMO_SANDBOX_DB_CA_CERT (or fallback DB_CA_CERT) cannot be blank');
  return normalized;
}

function parseSlotsJson(raw, controlPlaneDb, controlPlaneUser) {
  if (!raw || !String(raw).trim()) throw new Error('DEMO_SANDBOX_SLOTS_JSON is required');
  let parsed;
  try { parsed = JSON.parse(raw); } catch { throw new Error('DEMO_SANDBOX_SLOTS_JSON must be valid JSON'); }
  if (!Array.isArray(parsed) || parsed.length < 3 || parsed.length > 5) {
    throw new Error('DEMO_SANDBOX_SLOTS_JSON must contain between 3 and 5 slots');
  }
  const slotIds = new Set(), databases = new Set(), usernames = new Set();
  const controlDbLower = (controlPlaneDb || '').trim().toLowerCase();
  const controlUserLower = (controlPlaneUser || '').trim().toLowerCase();

  return parsed.map((entry) => {
    if (
      !entry || typeof entry !== 'object' || Array.isArray(entry) ||
      typeof entry.slotId !== 'string' || entry.slotId !== entry.slotId.trim() ||
      !SLOT_ID_RE.test(entry.slotId) || !isSqlIdentifier(entry.database, 64) ||
      !isSqlUsername(entry.username, 32) || typeof entry.password !== 'string' || !entry.password.length
    ) {
      throw new Error('DEMO_SANDBOX_SLOTS_JSON contains an invalid slot definition');
    }
    const dbLower = entry.database.toLowerCase();
    const userLower = entry.username.toLowerCase();
    if (
      slotIds.has(entry.slotId) || databases.has(dbLower) || usernames.has(userLower) ||
      (controlDbLower && dbLower === controlDbLower) ||
      (controlUserLower && userLower === controlUserLower) ||
      SYSTEM_DATABASES.has(dbLower) || isRootSqlUsername(userLower)
    ) {
      throw new Error('DEMO_SANDBOX_SLOTS_JSON contains colliding, root, or reserved database/account values');
    }
    slotIds.add(entry.slotId);
    databases.add(dbLower);
    usernames.add(userLower);
    return { slotId: entry.slotId, database: entry.database, username: entry.username, password: entry.password };
  });
}

function parseBootstrapConfig(env = process.env) {
  const host = (env.DEMO_SANDBOX_DB_HOST || env.DB_HOST || '').trim();
  if (!host || !HOST_RE.test(host)) {
    throw new Error('DEMO_SANDBOX_DB_HOST (or fallback DB_HOST) must be a valid hostname or IP');
  }
  const portRaw = (env.DEMO_SANDBOX_DB_PORT || env.DB_PORT || '').trim();
  const port = Number(portRaw);
  if (!/^\d+$/.test(portRaw) || !Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('DEMO_SANDBOX_DB_PORT (or fallback DB_PORT) must be an integer between 1 and 65535');
  }
  const adminUser = (env.SANDBOX_BOOTSTRAP_ADMIN_USER || '').trim();
  if (!adminUser) throw new Error('SANDBOX_BOOTSTRAP_ADMIN_USER is required');
  const adminPass = env.SANDBOX_BOOTSTRAP_ADMIN_PASS;
  if (typeof adminPass !== 'string' || adminPass.length === 0) {
    throw new Error('SANDBOX_BOOTSTRAP_ADMIN_PASS is required');
  }
  const controlPlaneDb = (env.DB_NAME || '').trim();
  if (!isSqlIdentifier(controlPlaneDb, 64)) {
    throw new Error('DB_NAME must be a valid SQL identifier to guard against control-plane collisions');
  }
  const controlPlaneUser = (env.DB_USER || '').trim();
  if (!isSqlUsername(controlPlaneUser, 32)) {
    throw new Error('DB_USER must be a valid SQL username to guard against control-plane collisions');
  }
  return {
    host,
    port,
    caCert: normalizeCaCert(env),
    adminUser,
    adminPass,
    slots: parseSlotsJson(env.DEMO_SANDBOX_SLOTS_JSON, controlPlaneDb, controlPlaneUser),
  };
}

function resolveSlotMigrations() {
  const business = BUSINESS_MIGRATIONS.map((name) => ({ name, filePath: path.join(MIGRATIONS_DIR, name) }));
  const slotFiles = fs
    .readdirSync(SLOT_MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.js') && !f.endsWith('.test.js'))
    .sort()
    .map((name) => ({ name, filePath: path.join(SLOT_MIGRATIONS_DIR, name) }));
  const all = [...business, ...slotFiles];
  for (const mig of all) {
    if (!fs.existsSync(mig.filePath)) throw new Error(`Required slot migration not found: ${mig.name}`);
  }
  return all;
}

function buildDryRunPlan(config, migrations) {
  return {
    mode: 'dry-run',
    host: config.host,
    port: config.port,
    tlsEnabled: Boolean(config.caCert),
    adminUser: config.adminUser,
    slots: config.slots.map(({ slotId, database, username }) => ({ slotId, database, username })),
    migrations: migrations.map((m) => m.name),
  };
}

function formatMissingDatabaseError(slot) {
  return [
    `Slot "${slot.slotId}" database \`${slot.database}\` does not exist.`,
    'Provision it first as a TiDB/MySQL admin (never touch the production DB_NAME):',
    `  CREATE DATABASE \`${slot.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`,
    `  CREATE USER '${slot.username}'@'%' IDENTIFIED BY '<STRONG_UNIQUE_PASSWORD>';`,
    `  GRANT SELECT, INSERT, UPDATE, DELETE ON \`${slot.database}\`.* TO '${slot.username}'@'%';`,
  ].join('\n');
}

function isMissingDatabaseError(err) {
  const orig = err?.original || err?.parent || err;
  return orig?.code === 'ER_BAD_DB_ERROR' || orig?.errno === 1049 || /Unknown database/i.test(String(err?.message || ''));
}

function createSequelizeConnection({ host, port, caCert, database, username, password }) {
  return new Sequelize(database, username, password, {
    dialect: 'mysql', host, port, logging: false, pool: { min: 0, max: 1 }, retry: { max: 0 },
    ...(caCert ? { dialectOptions: { ssl: { ca: caCert, rejectUnauthorized: true } } } : {}),
  });
}

function loadResetAdapterClass() {
  const compiledPath = path.join(BACKEND_ROOT, 'dist/infrastructure/persistence/SequelizeDemoSandboxResetAdapter.js');
  const sourcePath = path.join(BACKEND_ROOT, 'src/infrastructure/persistence/SequelizeDemoSandboxResetAdapter.ts');
  if (process.env.RUN_COMPILED === 'true') return require(compiledPath).SequelizeDemoSandboxResetAdapter;
  try {
    require('ts-node').register({ project: path.join(BACKEND_ROOT, 'tsconfig.json'), transpileOnly: true });
    return require(sourcePath).SequelizeDemoSandboxResetAdapter;
  } catch (err) {
    if (fs.existsSync(compiledPath)) return require(compiledPath).SequelizeDemoSandboxResetAdapter;
    throw err;
  }
}

async function runSlotBootstrap(config, slot, migrations, ResetAdapterClass, log) {
  const opened = [];
  try {
    const adminConn = createSequelizeConnection({
      host: config.host, port: config.port, caCert: config.caCert,
      database: slot.database, username: config.adminUser, password: config.adminPass,
    });
    opened.push(adminConn);
    try {
      await adminConn.authenticate();
    } catch (err) {
      if (isMissingDatabaseError(err)) throw new Error(formatMissingDatabaseError(slot), { cause: err });
      throw err;
    }

    const migrator = new Umzug({
      migrations: migrations.map(({ name, filePath }) => ({
        name,
        up: async (params) => require(filePath).up(params),
        down: async (params) => require(filePath).down(params),
      })),
      context: adminConn.getQueryInterface(),
      storage: new SequelizeStorage({ sequelize: adminConn }),
      logger: undefined,
    });
    const applied = await migrator.up();
    log(`[sandbox-bootstrap] ${slot.slotId} (${slot.database}): ${applied.length} migration(s) applied`);

    const slotConn = createSequelizeConnection({
      host: config.host, port: config.port, caCert: config.caCert,
      database: slot.database, username: slot.username, password: slot.password,
    });
    opened.push(slotConn);
    await slotConn.query('SELECT 1 AS ok', { type: QueryTypes.SELECT });

    const fenceRows = await slotConn.query(
      'SELECT generation FROM `DemoSandboxFence` WHERE slot_id = ? LIMIT 1',
      { replacements: [slot.slotId], type: QueryTypes.SELECT },
    );
    const generation = fenceRows.length > 0 ? Number(fenceRows[0].generation) : 0;
    const attemptId = crypto.randomUUID();
    const adapter = new ResetAdapterClass({
      get(requestedSlotId) {
        if (requestedSlotId !== slot.slotId) throw new Error(`Unexpected slot connection request: ${requestedSlotId}`);
        return slotConn;
      },
    });
    await adapter.reset(slot.slotId, generation, attemptId);
    if (!(await adapter.verify(slot.slotId, generation, attemptId))) {
      throw new Error(`Slot "${slot.slotId}" failed post-bootstrap verification`);
    }
    log(`[sandbox-bootstrap] ${slot.slotId} (${slot.database}): DML user verified & seed clean (gen=${generation})`);
  } finally {
    await Promise.allSettled(opened.map((conn) => conn.close()));
  }
}

async function main(argv = process.argv.slice(2), env = process.env) {
  const dryRun = argv.includes('--dry-run');
  const unknownArgs = argv.filter((arg) => arg !== '--dry-run');
  if (unknownArgs.length > 0) {
    throw new Error(`Unsupported argument(s): ${unknownArgs.join(', ')}. Supported: --dry-run`);
  }
  const config = parseBootstrapConfig(env);
  const migrations = resolveSlotMigrations();
  const log = (msg) => process.stdout.write(`${msg}\n`);
  if (dryRun) {
    log(`[sandbox-bootstrap] DRY-RUN plan:\n${JSON.stringify(buildDryRunPlan(config, migrations), null, 2)}`);
    return;
  }
  const ResetAdapterClass = loadResetAdapterClass();
  for (const slot of config.slots) await runSlotBootstrap(config, slot, migrations, ResetAdapterClass, log);
  log(`[sandbox-bootstrap] Completed bootstrap for ${config.slots.length} slot(s).`);
}

if (require.main === module) {
  main().catch((err) => {
    process.stderr.write(`[sandbox-bootstrap] ERROR: ${err.message}\n`);
    process.exitCode = 1;
  });
}

module.exports = { BUSINESS_MIGRATIONS, parseBootstrapConfig, resolveSlotMigrations, buildDryRunPlan, formatMissingDatabaseError, main };
