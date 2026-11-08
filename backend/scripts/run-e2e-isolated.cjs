'use strict';
const { createE2ESupervisor } = require('./e2e-run-supervisor.cjs');
const { spawnSync } = require('node:child_process');
const net = require('node:net');

function getFreePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, '127.0.0.1', () => {
      const port = srv.address().port;
      srv.close(() => resolve(port));
    });
    srv.on('error', reject);
  });
}

function createRealDockerProvider() {
  const { execFileSync } = require('node:child_process');
  const IMAGE = 'mysql@sha256:7dcddc01f13bab2f15cde676d44d01f61fc9f99fe7785e86196dfc07d358ae2b';

  return {
    async create({ runId, port }) {
      const containerName = `m3d-refresh-test-${runId}`;
      const containerId = execFileSync('docker', [
        'create',
        '--name', containerName,
        '--label', `m3d.refresh.run=${runId}`,
        '--network', 'bridge',
        '--publish', `127.0.0.1:${port}:3306`,
        '--env', 'MYSQL_ALLOW_EMPTY_PASSWORD=yes',
        '--mount', 'type=volume,dst=/var/lib/mysql',
        IMAGE,
      ], { encoding: 'utf8' }).trim();

      return { containerId };
    },
    async start(containerId) {
      execFileSync('docker', ['start', containerId]);
      // Wait for mysqld ready
      for (let i = 0; i < 30; i++) {
        try {
          execFileSync('docker', ['exec', containerId, 'mysqladmin', 'ping', '-h', 'localhost', '--silent']);
          return;
        } catch {
          await new Promise(r => setTimeout(r, 1000));
        }
      }
      throw new Error('MySQL container did not become ready');
    },
    async readInternalUuid(containerId) {
      const { parseInternalUuid } = require('./refresh-mysql-internal-uuid.cjs');
      const stdout = execFileSync('docker', ['exec', containerId, 'mysql', '-NBe', 'SELECT @@server_uuid;'], { encoding: 'utf8' });
      return parseInternalUuid(containerId, { containerId, code: 0, stdout, stderr: '' });
    },
    async stop(containerId) {
      try {
        execFileSync('docker', ['stop', containerId]);
      } catch (err) {
        console.error(`Warning: failed to stop container ${containerId}:`, err.message);
      }
    },
    async remove(containerId) {
      try {
        execFileSync('docker', ['rm', '-v', containerId]);
      } catch (err) {
        console.error(`Warning: failed to remove container ${containerId}:`, err.message);
      }
    },
  };
}

async function runE2EIsolated(args = process.argv.slice(2)) {
  const supervisor = createE2ESupervisor({
    dockerProvider: createRealDockerProvider(),
    portFinder: getFreePort,
  });

  return supervisor.run(async ({ env }) => {
    console.log(`[E2E Runner] Ephemeral MySQL ready on port ${env.DB_PORT} (runId: ${env.M3D_E2E_RUN_ID})`);
    const cmd = args.length > 0 ? args[0] : 'pnpm';
    const cmdArgs = args.length > 0 ? args.slice(1) : ['test:e2e'];

    const result = spawnSync(cmd, cmdArgs, {
      stdio: 'inherit',
      env: {
        ...process.env,
        ...env,
      },
    });

    if (result.status !== 0) {
      process.exitCode = result.status ?? 1;
      throw new Error(`E2E command exited with code ${process.exitCode}`);
    }
  });
}

if (require.main === module) {
  runE2EIsolated().catch(err => {
    console.error('[E2E Runner] Execution failed:', err.message);
    process.exit(process.exitCode || 1);
  });
}

module.exports = { runE2EIsolated, getFreePort };
