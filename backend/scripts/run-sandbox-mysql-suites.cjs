'use strict';

const crypto = require('node:crypto');
const path = require('node:path');
const { execFile, spawn } = require('node:child_process');
const { promisify } = require('node:util');
const { setTimeout: delay } = require('node:timers/promises');

const execFileAsync = promisify(execFile);

const BACKEND_DIR = path.resolve(__dirname, '..');
const DEFAULT_MYSQL_IMAGE =
  'mysql@sha256:7dcddc01f13bab2f15cde676d44d01f61fc9f99fe7785e86196dfc07d358ae2b';
const CONTAINER_PREFIX = 'm3d-sandbox-mysql';
const HEX_64_RE = /^[a-f0-9]{64}$/;
const UUID_RE = /^[a-f0-9-]{36}$/i;

const SUITE_GROUPS = Object.freeze([
  Object.freeze({
    id: 'isolation',
    port: 33316,
    authorization: 'm3d-sandbox-isolation-01a10377',
    env: Object.freeze({
      M3D_SANDBOX_TEST_CONTROL_DATABASE: 'm3d_sandbox_verify_control',
      M3D_SANDBOX_TEST_DATABASE_A: 'm3d_sandbox_verify_a',
      M3D_SANDBOX_TEST_DATABASE_B: 'm3d_sandbox_verify_b',
      M3D_SANDBOX_TEST_PINNING_DATABASE: 'm3d_sandbox_verify_pinning',
    }),
    suites: Object.freeze([
      'src/infrastructure/database/__tests__/DemoSandboxProductRepositories.mysql.ts',
      'src/infrastructure/database/__tests__/sandboxReleasePinning.mysql.ts',
    ]),
  }),
  Object.freeze({
    id: 'cut1',
    port: 33317,
    authorization: 'm3d-sandbox-cut1-mysql',
    env: Object.freeze({
      M3D_SANDBOX_TEST_CONTROL_DATABASE: 'm3d_sandbox_cut1_control',
      M3D_SANDBOX_TEST_DATABASE_A: 'm3d_sandbox_cut1_slot_a',
      M3D_SANDBOX_TEST_DATABASE_B: 'm3d_sandbox_cut1_slot_b',
    }),
    suites: Object.freeze(['src/infrastructure/database/__tests__/DemoSandboxResetAdapter.mysql.ts']),
  }),
  Object.freeze({
    id: 'cut2',
    port: 33318,
    authorization: 'm3d-sandbox-cut2-mysql',
    env: Object.freeze({
      M3D_SANDBOX_TEST_CONTROL_DATABASE: 'm3d_sandbox_cut2_control',
      M3D_SANDBOX_TEST_DATABASE_A: 'm3d_sandbox_cut2_slot_1',
      M3D_SANDBOX_TEST_DATABASE_B: 'm3d_sandbox_cut2_slot_2',
    }),
    suites: Object.freeze(['src/infrastructure/database/__tests__/DemoSandboxHttpIsolation.mysql.ts']),
  }),
]);

const log = (message) => process.stdout.write(`${message}\n`);
const generateRunId = (randomBytes = crypto.randomBytes) => randomBytes(6).toString('hex');

function generateDistinctPasswords(randomBytes = crypto.randomBytes) {
  const [admin, slotA, slotB] = [0, 1, 2].map(() => randomBytes(32).toString('hex'));
  const values = [admin, slotA, slotB];
  if (values.some((v) => !HEX_64_RE.test(v))) throw new Error('Passwords must be 64 lowercase hex chars');
  if (new Set(values).size !== 3) throw new Error('Generated sandbox passwords must be distinct');
  return Object.freeze({ admin, slotA, slotB });
}

function buildContainerName(runId, groupId) {
  if (!/^[a-f0-9]+$/.test(runId || '')) throw new Error('Invalid sandbox runId');
  if (!/^[a-z0-9-]+$/.test(groupId || '')) throw new Error('Invalid sandbox groupId');
  return `${CONTAINER_PREFIX}-${runId}-${groupId}`;
}

function buildDockerCreateArgs({ containerName, runId, groupId, port, image = DEFAULT_MYSQL_IMAGE }) {
  return [
    'create', '--name', containerName,
    '--label', `m3d.sandbox.run=${runId}`,
    '--label', `m3d.sandbox.group=${groupId}`,
    '--network', 'bridge',
    '--publish', `127.0.0.1:${port}:3306`,
    '--env', 'MYSQL_ROOT_PASSWORD',
    '--mount', 'type=volume,dst=/var/lib/mysql',
    image,
  ];
}

function buildGroupEnv(group, { passwords, serverUuid }) {
  if (!UUID_RE.test(serverUuid || '')) throw new Error('Invalid disposable sandbox server UUID');
  return {
    ...group.env,
    M3D_SANDBOX_TEST_AUTHORIZATION: group.authorization,
    M3D_SANDBOX_TEST_HOST: '127.0.0.1',
    M3D_SANDBOX_TEST_PORT: String(group.port),
    M3D_SANDBOX_TEST_ADMIN_PASSWORD: passwords.admin,
    M3D_SANDBOX_TEST_PASSWORD_A: passwords.slotA,
    M3D_SANDBOX_TEST_PASSWORD_B: passwords.slotB,
    M3D_SANDBOX_TEST_SERVER_UUID: serverUuid,
  };
}

function buildJestArgs(group) {
  return ['exec', 'jest', '--config', 'jest.sandbox.config.js', '--runInBand', '--detectOpenHandles', ...group.suites];
}

function describeDockerError(args, error) {
  const firstLine = String(error?.stderr || '').split(/\r?\n/).find((l) => l.trim());
  const code = Number.isInteger(error?.code) ? ` (exit ${error.code})` : '';
  return `Docker ${args[0]} failed${code}${firstLine ? `: ${firstLine.trim().slice(0, 200)}` : ''}`;
}

async function execDocker(args, { env = process.env, timeout, signal } = {}) {
  try {
    const { stdout } = await execFileAsync('docker', args, {
      encoding: 'utf8',
      env,
      timeout: timeout ?? (args[0] === 'pull' ? 600_000 : 30_000),
      maxBuffer: 1024 * 1024,
      signal,
    });
    return stdout.trim();
  } catch (error) {
    throw new Error(describeDockerError(args, error), { cause: error });
  }
}

async function ensureImagePresent(image, signal) {
  try {
    await execDocker(['image', 'inspect', image], { signal });
  } catch {
    signal?.throwIfAborted();
    log(`[sandbox-mysql] Pulling pinned MySQL image ${image}...`);
    await execDocker(['pull', image], { signal });
  }
}

async function probeTcpUuid(port, adminPassword, expectedUuid) {
  const mysql = require('mysql2/promise');
  let connection;
  try {
    connection = await mysql.createConnection({
      host: '127.0.0.1', port: Number(port), user: 'root', password: adminPassword, connectTimeout: 3000,
    });
    const [rows] = await connection.query('SELECT @@server_uuid AS uuid');
    const tcpUuid = String(rows?.[0]?.uuid || '').trim();
    if (tcpUuid.toLowerCase() !== expectedUuid.toLowerCase()) {
      throw new Error('Published MySQL TCP server_uuid mismatch');
    }
    return tcpUuid;
  } finally {
    if (connection) await connection.end().catch(() => {});
  }
}

async function waitForMysqlReady({ containerId, port, adminPassword, signal, maxAttempts = 90 }) {
  const execEnv = { ...process.env, MYSQL_PWD: adminPassword };
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    signal?.throwIfAborted();
    try {
      await execDocker(
        ['exec', '-e', 'MYSQL_PWD', containerId, 'mysqladmin', 'ping', '-h', '127.0.0.1', '-u', 'root', '--silent'],
        { env: execEnv, signal },
      );
      const execUuid = await execDocker(
        ['exec', '-e', 'MYSQL_PWD', containerId, 'mysql', '-h', '127.0.0.1', '-u', 'root', '-NBe', 'SELECT @@server_uuid;'],
        { env: execEnv, signal },
      );
      if (!UUID_RE.test(execUuid)) throw new Error('Unexpected @@server_uuid format');
      return await probeTcpUuid(port, adminPassword, execUuid);
    } catch {
      signal?.throwIfAborted();
      if (attempt === maxAttempts) break;
      await delay(1000, undefined, { signal });
    }
  }
  throw new Error(`Disposable MySQL container on port ${port} did not become ready in time`);
}

function runJestGroup(group, groupEnv, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason || new Error('Aborted'));
    const child = spawn('pnpm', buildJestArgs(group), {
      cwd: BACKEND_DIR,
      env: { ...process.env, ...groupEnv },
      stdio: 'inherit',
    });
    const onAbort = () => { if (!child.killed) child.kill('SIGTERM'); };
    signal?.addEventListener('abort', onAbort, { once: true });
    child.on('error', (error) => { signal?.removeEventListener('abort', onAbort); reject(error); });
    child.on('close', (code, termSignal) => {
      signal?.removeEventListener('abort', onAbort);
      if (code === 0) return resolve();
      const error = new Error(
        `Sandbox MySQL group "${group.id}" failed (${termSignal ? `signal ${termSignal}` : `exit ${code}`})`,
      );
      error.exitCode = code || 1;
      reject(error);
    });
  });
}

async function removeOwnedContainer(containerId, ownedContainers) {
  if (!ownedContainers.has(containerId)) return;
  try {
    await execDocker(['rm', '-f', '-v', containerId]);
  } finally {
    ownedContainers.delete(containerId);
  }
}

async function verifyZeroLeftoverContainers(runId) {
  const output = await execDocker([
    'ps', '-a', '--filter', `name=${CONTAINER_PREFIX}-${runId}-`, '--format', '{{.Names}}',
  ]);
  const remaining = output.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (remaining.length > 0) {
    throw new Error(`Leftover sandbox MySQL containers detected for run ${runId}: ${remaining.join(', ')}`);
  }
}

async function runSandboxMysqlSuites() {
  const image = process.env.M3D_SANDBOX_MYSQL_IMAGE || DEFAULT_MYSQL_IMAGE;
  const runId = generateRunId();
  const ownedContainers = new Map();
  const controller = new AbortController();
  const onSignal = (name) => {
    const error = new Error(`Sandbox MySQL run cancelled by ${name}`);
    error.exitCode = name === 'SIGINT' ? 130 : 143;
    controller.abort(error);
  };
  const onInt = () => onSignal('SIGINT');
  const onTerm = () => onSignal('SIGTERM');
  process.on('SIGINT', onInt);
  process.on('SIGTERM', onTerm);

  let primaryError = null;
  const cleanupErrors = [];
  try {
    await ensureImagePresent(image, controller.signal);
    for (const group of SUITE_GROUPS) {
      controller.signal.throwIfAborted();
      const containerName = buildContainerName(runId, group.id);
      const passwords = generateDistinctPasswords();
      let containerId = null;
      log(`[sandbox-mysql] Starting ${containerName} on 127.0.0.1:${group.port} (group "${group.id}")...`);
      try {
        containerId = await execDocker(
          buildDockerCreateArgs({ containerName, runId, groupId: group.id, port: group.port, image }),
          { env: { ...process.env, MYSQL_ROOT_PASSWORD: passwords.admin }, signal: controller.signal },
        );
        ownedContainers.set(containerId, containerName);
        await execDocker(['start', containerId], { signal: controller.signal });
        const serverUuid = await waitForMysqlReady({
          containerId, port: group.port, adminPassword: passwords.admin, signal: controller.signal,
        });
        log(`[sandbox-mysql] Group "${group.id}" ready (uuid=${serverUuid}); running ${group.suites.length} suite(s)...`);
        await runJestGroup(group, buildGroupEnv(group, { passwords, serverUuid }), controller.signal);
      } finally {
        if (containerId) {
          log(`[sandbox-mysql] Removing ${containerName}...`);
          await removeOwnedContainer(containerId, ownedContainers);
        }
      }
    }
  } catch (error) {
    primaryError = error;
  } finally {
    process.removeListener('SIGINT', onInt);
    process.removeListener('SIGTERM', onTerm);
    for (const containerId of Array.from(ownedContainers.keys())) {
      try { await removeOwnedContainer(containerId, ownedContainers); } catch (e) { cleanupErrors.push(e); }
    }
    try { await verifyZeroLeftoverContainers(runId); } catch (e) { cleanupErrors.push(e); }
  }

  if (primaryError) {
    for (const err of cleanupErrors) console.error('[sandbox-mysql] Cleanup error:', err.message);
    throw primaryError;
  }
  if (cleanupErrors.length > 0) throw cleanupErrors[0];
}

if (require.main === module) {
  runSandboxMysqlSuites().catch((error) => {
    console.error('[sandbox-mysql]', error.message);
    process.exitCode = error.exitCode || 1;
  });
}

module.exports = {
  DEFAULT_MYSQL_IMAGE,
  CONTAINER_PREFIX,
  SUITE_GROUPS,
  generateRunId,
  generateDistinctPasswords,
  buildContainerName,
  buildDockerCreateArgs,
  buildGroupEnv,
  buildJestArgs,
  runSandboxMysqlSuites,
};
