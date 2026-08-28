const childProcess = require('node:child_process');
const os = require('node:os');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');

// Node reports a signal-killed child as `code === null`, naming the signal
// separately — never as an exit code. Forwarding that null to
// `process.exitCode` resets it to "unset" and this wrapper exits 0, so an
// orchestrator would read a deploy that was actually torn down as a clean
// success. Map it the way a shell does (128 + signal number) instead. A child
// that never spawned at all (status and signal both absent) is a failure too.
function exitCodeFrom(code, signal) {
  if (typeof code === 'number') {
    return code;
  }
  const signalNumber = signal ? os.constants.signals[signal] : undefined;
  return typeof signalNumber === 'number' ? 128 + signalNumber : 1;
}

// Runs `pnpm --filter backend db:migrate`, then only if that succeeds,
// `pnpm --filter backend start`. index.js already refuses to auto-migrate
// at boot (checkNoPendingMigrations fails closed) — this is the pipeline
// step that actually runs migrations before the new app version serves
// traffic. Resolves with the eventual process's exit code; never throws.
function run() {
  const migrate = childProcess.spawnSync('pnpm', ['--filter', 'backend', 'db:migrate'], {
    cwd: REPO_ROOT,
    stdio: 'inherit',
    shell: false,
  });

  if (migrate.status !== 0) {
    return Promise.resolve(exitCodeFrom(migrate.status, migrate.signal));
  }

  return new Promise((resolve) => {
    const child = childProcess.spawn('pnpm', ['--filter', 'backend', 'start'], {
      cwd: REPO_ROOT,
      stdio: 'inherit',
      shell: false,
    });

    // A container/PaaS orchestrator signals PID 1 (this wrapper), not the
    // grandchild `node index.js` — without forwarding, index.js's graceful
    // shutdown drain (SHUTDOWN_TIMEOUT_MS) would never run on deploy/restart.
    const forward = (signal) => () => child.kill(signal);
    const onSigterm = forward('SIGTERM');
    const onSigint = forward('SIGINT');
    process.on('SIGTERM', onSigterm);
    process.on('SIGINT', onSigint);

    child.on('exit', (code, signal) => {
      process.off('SIGTERM', onSigterm);
      process.off('SIGINT', onSigint);
      resolve(exitCodeFrom(code, signal));
    });
  });
}

if (require.main === module) {
  run().then((code) => {
    process.exitCode = code;
  });
}

module.exports = { run };
