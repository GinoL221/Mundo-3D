'use strict';
const { createE2ESupervisor } = require('./e2e-run-supervisor.cjs');
const { createDockerProvider } = require('./e2e-docker-provider.cjs');
const { runCommand } = require('./e2e-child-process.cjs');
const path = require('node:path');
const net = require('node:net');
const ROOT = path.resolve(__dirname, '../..');

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      server.close(error => error ? reject(error) : resolve(port));
    });
  });
}

async function runE2EIsolated(args = process.argv.slice(2), dependencies = {}) {
  if (args.length === 1 && args[0] === '--help') {
    (dependencies.printHelp || printHelp)();
    return;
  }
  const helpOnly = args[0] === '--playwright' && args.slice(1).some(arg => arg === '--help' || arg === '-h');
  const supervisor = dependencies.supervisor || createE2ESupervisor({
    dockerProvider: createDockerProvider(), portFinder: getFreePort,
  });
  const execute = dependencies.runCommand || runCommand;
  const signals = dependencies.signals || process;
  const controller = new AbortController();
  const cancel = name => {
    const error = new Error(`E2E cancelled by ${name}`);
    error.exitCode = name === 'SIGINT' ? 130 : 143;
    controller.abort(error);
  };
  const onInt = () => cancel('SIGINT');
  const onTerm = () => cancel('SIGTERM');
  signals.on('SIGINT', onInt); signals.on('SIGTERM', onTerm);
  try {
    const automatic = args.length === 0 || args[0] === '--playwright';
    const command = automatic ? 'pnpm' : args[0];
    const commandArgs = automatic
      ? ['--dir', ROOT, '--filter', 'e2e', 'exec', 'playwright', 'test', ...args.slice(args[0] === '--playwright' ? 1 : 0)]
      : args.slice(1);
    if (helpOnly) {
      // Help reads no configuration state and needs no per-run resources.
      return await execute(command, commandArgs, { env: { ...process.env }, signal: controller.signal });
    }
    return await supervisor.run(async ({ env }) => execute(command, commandArgs, {
      env: { ...process.env, ...env }, signal: controller.signal,
    }), { signal: controller.signal });
  } finally {
    signals.removeListener('SIGINT', onInt); signals.removeListener('SIGTERM', onTerm);
  }
}

function printHelp() {
  console.log('Usage: node backend/scripts/run-e2e-isolated.cjs [--playwright <Playwright arguments> | <command> <arguments>]');
  console.log('Creates per-run MySQL/Mailpit; validates ownership; reports cancellation and cleanup failures. Requires Docker.');
}

function reportFailure(error) {
  console.error('[E2E Runner]', error.message);
  if (error instanceof AggregateError) for (const cause of error.errors) reportFailure(cause);
}
if (require.main === module) {
  runE2EIsolated().catch(error => {
    reportFailure(error);
    const failures = error instanceof AggregateError ? error.errors : [error];
    process.exitCode = failures.find(item => item.exitCode)?.exitCode || 1;
  });
}
module.exports = { runE2EIsolated, getFreePort, printHelp };
