'use strict';
const { spawn } = require('node:child_process');

// Playwright's CLI handles SIGINT (and tears down its own detached webServer
// groups from that handler); SIGTERM would kill it before teardown.
async function runCommand(command, args, { env, signal, spawnImpl = spawn, killImpl = process.kill,
  graceMs = 5000 } = {}) {
  signal?.throwIfAborted();
  return new Promise((resolve, reject) => {
    const child = spawnImpl(command, args, { env, stdio: 'inherit', detached: process.platform !== 'win32' });
    let timer;
    let killFailure;
    const group = (name) => {
      try {
        if (child.pid) killImpl(process.platform === 'win32' ? child.pid : -child.pid, name);
      } catch (error) {
        if (error.code !== 'ESRCH') killFailure = new Error('E2E child group termination failed');
      }
    };
    const cancel = () => {
      group('SIGINT');
      // Escalation is not cancelled by graceful progress inside the child: its
      // detached webServers are separate groups that may ignore the first signal.
      timer = setTimeout(() => group('SIGKILL'), graceMs);
      timer.unref();
    };
    // The escalation timer targets only the Playwright process group and is
    // cleared once that child closes. Playwright's detached webServer groups are
    // NOT covered by it: their teardown relies on Playwright handling SIGINT.
    const dispose = () => {
      signal?.removeEventListener('abort', cancel);
      if (timer) clearTimeout(timer);
    };
    child.once('error', () => { dispose(); reject(new Error('E2E child could not start')); });
    child.once('close', (code, childSignal) => {
      dispose();
      if (signal?.aborted) {
        return reject(killFailure || (signal.reason instanceof Error ? signal.reason : new Error('E2E cancellation failed')));
      }
      if (code === 0) return resolve();
      const error = new Error(`E2E command failed: ${code ?? childSignal ?? 'unknown'}`);
      error.exitCode = Number.isInteger(code) && code > 0 ? code : 1;
      reject(error);
    });
    signal?.addEventListener('abort', cancel, { once: true });
    if (signal?.aborted) cancel();
  });
}
module.exports = { runCommand };
