'use strict';
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { setTimeout: delay } = require('node:timers/promises');
const { assertResourceBinding, MYSQL_IMAGE, MAILPIT_IMAGE } = require('./e2e-resource-binding.cjs');
const { parseInternalUuid } = require('./refresh-mysql-internal-uuid.cjs');
const execFileAsync = promisify(execFile);

// A first-boot temporary MySQL answers on its local socket with the final
// server UUID while TCP is disabled, and Docker's userland proxy can accept a
// loopback TCP connection before MySQL listens. Readiness therefore proves the
// identity over the published TCP endpoint itself.
async function probeTcpIdentity(port, signal, expectedUuid) {
  const mysql = require('mysql2/promise');
  let connection;
  try {
    connection = await mysql.createConnection({ host: '127.0.0.1', port: Number(port),
      user: 'root', password: '', connectTimeout: 3000 });
    const [rows] = await connection.query('SELECT @@server_uuid AS uuid');
    if (String(rows?.[0]?.uuid).toLowerCase() !== expectedUuid.toLowerCase()) {
      throw new Error('TCP identity mismatch');
    }
  } finally {
    if (connection) await connection.end().catch(() => {});
  }
}

// Image pulls are network-bound; every other command keeps the short budget.
function timeoutFor(args) {
  return args[0] === 'pull' ? 600_000 : 30_000;
}

// One bounded line of the daemon's own message is enough to diagnose a failure;
// the original error is kept as `cause`, never printed wholesale.
function describeFailure(args, error) {
  const line = String(error?.stderr || '').split(/\r?\n/).find(item => item.trim());
  const code = Number.isInteger(error?.code) ? ` (exit ${error.code})` : '';
  const detail = line ? `: ${line.trim().slice(0, 200)}` : '';
  return `E2E Docker ${args[0]} failed${code}${detail}`;
}

async function execDocker(args, signal, runner = execFileAsync) {
  let result;
  try {
    result = await runner('docker', args, { encoding: 'utf8', timeout: timeoutFor(args),
      maxBuffer: 1024 * 1024, signal });
  } catch (error) {
    throw new Error(describeFailure(args, error), { cause: error });
  }
  if (args[0] === 'exec' && result.stderr) throw new Error('Ambiguous MySQL identity transcript');
  return result.stdout;
}
async function inspectContainer(id, exec = execDocker) {
  const result = JSON.parse(await exec(['inspect', id]));
  if (!Array.isArray(result) || result.length !== 1) throw new Error('E2E inspection ambiguous');
  return result[0];
}

// Returned records are authority only within this provider instance and only
// after its exact create output is reconciled with independent live inspection.
// Uncertain creates are preserved, with the scoped candidate name in the error.
function createDockerProvider({ exec = execDocker, fetchImpl = globalThis.fetch, tcpProbe = probeTcpIdentity,
  readinessAttempts = 30 } = {}) {
  const owned = new WeakSet();
  const assertOwned = (record) => {
    if (!record || !owned.has(record)) throw new Error('Unowned E2E resource');
  };
  return Object.freeze({
    async create({ kind, runId, signal }) {
      if (!['mysql', 'mailpit'].includes(kind) || !/^[a-f0-9]{32}(?![\s\S])/.test(runId || '')) {
        throw new Error('E2E create input rejected');
      }
      const name = `m3d-e2e-${kind}-${runId}`;
      const image = kind === 'mysql' ? MYSQL_IMAGE : MAILPIT_IMAGE;
      const ports = kind === 'mysql' ? ['3306'] : ['8025', '1025'];
      const args = ['create', '--name', name, '--label', `m3d.e2e.run=${runId}`,
        '--label', `m3d.e2e.kind=${kind}`, '--network', 'bridge',
        ...ports.flatMap(port => ['--publish', `127.0.0.1::${port}`]),
        ...(kind === 'mysql' ? ['--env', 'MYSQL_ALLOW_EMPTY_PASSWORD=yes', '--mount', 'type=volume,dst=/var/lib/mysql', MYSQL_IMAGE]
          : ['--env', 'MP_ENABLE_CHAOS=true', MAILPIT_IMAGE])];
      const cancelError = () => new AggregateError(
        [signal.reason, new Error(`E2E creation interrupted; preserve candidate ${name} for run ${runId}`)],
        'E2E creation cancelled',
      );
      if (signal?.aborted) throw cancelError();
      // Pull outside the create budget: a cold image must not look like an
      // uncertain creation.
      try {
        await exec(['image', 'inspect', image], signal);
      } catch {
        if (signal?.aborted) throw cancelError();
        try {
          await exec(['pull', image], signal);
        } catch (pullError) {
          if (signal?.aborted) throw cancelError();
          throw pullError;
        }
      }
      try {
        if (signal?.aborted) throw cancelError();
        const containerId = (await exec(args, signal)).trim();
        const record = { containerId, kind, runId };
        const binding = assertResourceBinding(record, await inspectContainer(containerId, exec));
        const confirmed = Object.freeze({ ...record, ...binding });
        owned.add(confirmed);
        return confirmed;
      } catch (error) {
        if (signal?.aborted) throw cancelError();
        throw new Error(`E2E creation uncertain for run ${runId}; preserve candidate ${name}`);
      }
    },
    async ready(record, signal) {
      assertOwned(record);
      signal?.throwIfAborted();
      assertResourceBinding(record, await inspectContainer(record.containerId, exec));
      await exec(['start', record.containerId], signal);
      for (let attempt = 0; attempt < readinessAttempts; attempt++) {
        signal?.throwIfAborted();
        try {
          const binding = assertResourceBinding(record, await inspectContainer(record.containerId, exec), true);
          if (record.kind === 'mysql') {
            const stdout = await exec(['exec', record.containerId, 'mysql', '-NBe', 'SELECT @@server_uuid;'], signal);
            const serverUuid = parseInternalUuid(record.containerId, { containerId: record.containerId, code: 0, stdout, stderr: '' });
            await tcpProbe(binding.dbPort, signal, serverUuid);
            return Object.freeze({ ...binding, serverUuid });
          }
          const response = await fetchImpl(`http://127.0.0.1:${binding.httpPort}/api/v1/info`,
            { redirect: 'error', signal: AbortSignal.any([...(signal ? [signal] : []), AbortSignal.timeout(2000)]) });
          if (!response.ok) throw new Error('Mailpit not ready');
          const info = await response.json();
          if (typeof info?.Version !== 'string' || !info.Version) throw new Error('Invalid Mailpit response');
          return binding;
        } catch {
          signal?.throwIfAborted();
          if (attempt === readinessAttempts - 1) break;
          await delay(1000, undefined, { signal });
        }
      }
      throw new Error(`E2E ${record.kind} readiness failed for run ${record.runId}`);
    },
    async cleanup(record) {
      assertOwned(record);
      // Never remove a candidate selected by name, nor a drifted mount/label.
      assertResourceBinding(record, await inspectContainer(record.containerId, exec));
      await exec(['stop', record.containerId]).catch(error => {
        throw new Error(`${error.message} (container ${record.containerId}, run ${record.runId})`);
      });
      const stopped = await inspectContainer(record.containerId, exec);
      assertResourceBinding(record, stopped);
      if (stopped.State?.Running !== false) throw new Error(`E2E resource is still running: ${record.containerId}`);
      await exec(['rm', '-v', record.containerId]);
      const containers = (await exec(['container', 'ls', '-a', '--no-trunc', '--format', '{{.ID}}'])).split(/\s+/);
      if (containers.includes(record.containerId)) throw new Error(`E2E container remains: ${record.containerId}`);
      if (record.volumeName) {
        const volumes = (await exec(['volume', 'ls', '--format', '{{.Name}}'])).split(/\s+/);
        if (volumes.includes(record.volumeName)) throw new Error(`E2E volume remains: ${record.volumeName} for run ${record.runId}`);
      }
      owned.delete(record);
    },
  });
}
module.exports = { createDockerProvider, inspectContainer, execDocker, timeoutFor };
