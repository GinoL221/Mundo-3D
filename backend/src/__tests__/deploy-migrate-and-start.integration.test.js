/**
 * Real-process integration test for scripts/deploy/migrate-and-start.js —
 * spawns the actual script (no mocks) against a real MySQL, exercising the
 * genuine `pnpm --filter backend db:migrate` -> `pnpm --filter backend
 * start` sequence and index.js's full non-test boot path (ensureDatabase ->
 * authenticate -> checkNoPendingMigrations -> seedInitialData -> listen).
 *
 * Runs only via `pnpm --filter backend test:integration` (excluded from
 * `test:fast` by jest.config.js's testPathIgnorePatterns, matching the
 * `*.integration.test.(ts|js)` convention).
 *
 * Requires a reachable MySQL — set DB_HOST/DB_USER/DB_PASS/DB_NAME to point
 * at it (see CI's "Real-DB integration tests" job for the exact pattern:
 * DB_HOST=127.0.0.1, DB_USER=root, DB_PASS="").
 */
const { spawn } = require('child_process');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');

// db:migrate (Umzug) does not create the database itself — only the app's
// own boot sequence (ensureDatabaseExists, inside index.js) does, and that
// runs AFTER migrate is expected to have already succeeded. Real deploy
// targets are expected to already have their database provisioned (a
// managed DB service typically creates one on setup) — this mirrors CI's
// own separate "create database" step ahead of its migrate verification.
//
// DROP + CREATE (not just CREATE IF NOT EXISTS) so the baseline migration
// always runs against a genuinely fresh schema, whether this is CI's first
// run or a repeated local run against a scratch DB left over from before.
async function ensureFreshDatabase(env) {
  const mysql = require('mysql2/promise');
  const connection = await mysql.createConnection({
    host: env.DB_HOST,
    user: env.DB_USER,
    password: env.DB_PASS,
  });
  await connection.query(`DROP DATABASE IF EXISTS \`${env.DB_NAME}\`;`);
  await connection.query(`CREATE DATABASE \`${env.DB_NAME}\`;`);
  await connection.end();
}

function waitFor(getValue, timeoutMs) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const check = () => {
      const value = getValue();
      if (value !== null && value !== undefined) {
        resolve(value);
        return;
      }
      if (Date.now() - start > timeoutMs) {
        reject(new Error(`Timed out after ${timeoutMs}ms waiting for a value`));
        return;
      }
      setTimeout(check, 100);
    };
    check();
  });
}

function extractPort(output) {
  const lines = output.split('\n').filter(Boolean);
  for (const line of lines) {
    let parsed;
    try {
      parsed = JSON.parse(line);
    } catch {
      continue;
    }
    if (parsed && typeof parsed.port === 'number' && parsed.port > 0) {
      return parsed.port;
    }
  }
  return null;
}

// Every child a test spawns is registered here and torn down in afterEach.
// Cleaning up there rather than inline after the assertions means a failing
// expectation can never skip it and leave the runner a live process plus a
// pipe that never reaches EOF.
const spawnedChildren = [];

function spawnMigrateAndStart(envOverrides) {
  const env = { ...process.env, ...envOverrides };
  delete env.JEST_WORKER_ID;
  // 'production' (not 'development'): both exercise the real DB/migrate/
  // seed boot path (index.js only special-cases NODE_ENV === 'test'), but
  // logger.ts only emits single-line JSON — parseable by extractPort() —
  // outside test/development; development's pino-pretty transport prints
  // multi-line, ANSI-colored text that silently never matches. This is
  // also the more representative choice: it is the actual target scenario.
  env.NODE_ENV = 'production';
  env.PORT = '0';
  env.LOG_LEVEL = 'info';
  env.CORS_ORIGIN = 'http://localhost:4321';

  const child = spawn('node', [path.join(REPO_ROOT, 'scripts', 'deploy', 'migrate-and-start.js')], {
    cwd: REPO_ROOT,
    env,
    shell: false,
  });
  spawnedChildren.push(child);
  return child;
}

describe('deploy-migrate-and-start.integration: real migrate-then-start against a live DB', () => {
  const dbEnv = {
    DB_HOST: process.env.DB_HOST || '127.0.0.1',
    DB_USER: process.env.DB_USER || 'root',
    DB_PASS: process.env.DB_PASS ?? '',
    // Dedicated scratch DB (matching database/__tests__/migrate.integration.test.js's
    // convention) — NOT `mundo_3d_test`, which other integration files share via
    // testDb.ts's `sequelize.sync()`. Reusing that shared DB made the baseline
    // migration's CREATE TABLE collide with tables sync() already created,
    // since sync() never records anything in SequelizeMeta.
    DB_NAME: 'mundo_3d_migrate_scratch',
    JWT_SECRET: 'integration-test-secret',
    COOKIE_SECRET: 'integration-test-cookie-secret',
  };

  beforeAll(async () => {
    await ensureFreshDatabase(dbEnv);
  });

  // `migrate-and-start.js` exiting only proves ITS process is gone. The
  // `pnpm --filter backend start` grandchild inherits this pipe's write end
  // (stdio: 'inherit'), so any descendant outliving it keeps our read end from
  // ever seeing EOF — Jest reports that as a lingering PIPEWRAP and then waits
  // on it forever (observed on CI via --detectOpenHandles, never reproducible
  // locally). Destroying our own read end releases it regardless of who still
  // holds the writer.
  //
  // SIGTERM, never SIGKILL: SIGKILL cannot be intercepted, so it would orphan
  // migrate-and-start.js's own spawned `start` child instead of letting that
  // script's signal-forwarding logic shut the real server down.
  afterEach(() => {
    for (const child of spawnedChildren.splice(0)) {
      if (child.exitCode === null && child.signalCode === null) {
        child.kill('SIGTERM');
      }
      child.stdout.destroy();
      child.stderr.destroy();
    }
  });

  it(
    'migrates then boots the real server, reaching a healthy /health/ready',
    async () => {
      const child = spawnMigrateAndStart(dbEnv);

      let stdout = '';
      let stderr = '';
      child.stdout.on('data', (chunk) => (stdout += chunk.toString()));
      child.stderr.on('data', (chunk) => (stderr += chunk.toString()));

      let port;
      try {
        // A cold, uncompiled boot (two separate pnpm workspace resolutions
        // — db:migrate then start — each cold-starting ts-node/register,
        // plus a real migrate and full-catalog seed insert) is meaningfully
        // slower than the already-compiled path boot.integration.test.js
        // exercises (~25-35s observed locally). Generous on purpose.
        port = await waitFor(() => extractPort(stdout), 45000);
      } catch (waitErr) {
        // No cleanup here: afterEach owns it, and runs on this failure path too.
        throw new Error(
          `Never reported a listening port.\n--- stdout ---\n${stdout}\n--- stderr ---\n${stderr}\n${waitErr.message}`,
          { cause: waitErr }
        );
      }

      const response = await fetch(`http://127.0.0.1:${port}/health/ready`);
      expect(response.status).toBe(200);

      const { exitCode, signal } = await new Promise((resolve) => {
        child.once('exit', (code, exitSignal) => resolve({ exitCode: code, signal: exitSignal }));
        child.kill('SIGTERM');
      });
      // A signal-killed child reports `code === null`, so asserting on the code
      // alone would read that null as a clean exit. Requiring a null SIGNAL is
      // what actually proves the wrapper shut itself down under its own
      // control after forwarding SIGTERM, rather than being torn down by it.
      expect(signal).toBeNull();
      expect(exitCode).toBe(0);
    },
    60000
  );

  it(
    'never starts the server when migrate fails (bad DB credentials)',
    async () => {
      const child = spawnMigrateAndStart({ ...dbEnv, DB_PASS: 'definitely-wrong-password' });

      let stdout = '';
      child.stdout.on('data', (chunk) => (stdout += chunk.toString()));

      const exitCode = await new Promise((resolve) => {
        child.once('exit', (code) => resolve(code));
      });

      expect(exitCode).not.toBe(0);
      expect(extractPort(stdout)).toBeNull();
    },
    30000
  );
});
