'use strict';
const { spawn, execFileSync } = require('node:child_process');

// Playwright starts its webServers as detached groups, so a group signal sent to
// the Playwright process never reaches them. Cancellation therefore records the
// descendant tree first and reaps whatever survived Playwright's own teardown.
function listDescendants(rootPid) {
  if (process.platform === 'win32' || !Number.isInteger(rootPid)) return [];
  let table;
  try {
    table = execFileSync('ps', ['-eo', 'pid=,ppid='], { encoding: 'utf8' });
  } catch {
    return [];
  }
  const byParent = new Map();
  for (const line of table.split('\n')) {
    const [pidText, parentText] = line.trim().split(/\s+/);
    const pid = Number(pidText);
    const parent = Number(parentText);
    if (!Number.isInteger(pid) || !Number.isInteger(parent)) continue;
    if (!byParent.has(parent)) byParent.set(parent, []);
    byParent.get(parent).push(pid);
  }
  const descendants = [];
  const queue = [rootPid];
  while (queue.length > 0) {
    for (const pid of byParent.get(queue.shift()) ?? []) {
      descendants.push(pid);
      queue.push(pid);
    }
  }
  return descendants;
}

// Playwright's CLI handles SIGINT (and tears down its own detached webServer
// groups from that handler); SIGTERM would kill it before teardown.
async function runCommand(command, args, { env, signal, spawnImpl = spawn, killImpl = process.kill,
  graceMs = 5000, reapGraceMs = 500, listDescendantsImpl = listDescendants } = {}) {
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
    let escaped = [];
    const cancel = () => {
      escaped = listDescendantsImpl(child.pid);
      group('SIGINT');
      // Escalation is not cancelled by graceful progress inside the child: its
      // detached webServers are separate groups that may ignore the first signal.
      timer = setTimeout(() => group('SIGKILL'), graceMs);
      timer.unref();
    };
    // The escalation timer targets only the Playwright process group and is
    // cleared once that child closes. Playwright's detached webServer groups are
    // outside that group, so cancellation reaps the recorded descendants itself:
    // a graceful SIGTERM first, SIGKILL for the survivors.
    const dispose = () => {
      signal?.removeEventListener('abort', cancel);
      if (timer) clearTimeout(timer);
    };
    child.once('error', () => { dispose(); reject(new Error('E2E child could not start')); });
    const reap = async () => {
      if (escaped.length === 0) return;
      const signalPid = (pid, name) => {
        try {
          killImpl(pid, name);
        } catch (error) {
          if (error.code !== 'ESRCH') killFailure = new Error('E2E descendant termination failed');
        }
      };
      for (const pid of escaped) signalPid(pid, 'SIGTERM');
      // The reap timer must keep the process alive: an unref'd timer lets the
      // parent exit mid-cleanup, which skips both the rejection and the
      // supervisor's Docker cleanup.
      await new Promise((done) => setTimeout(done, reapGraceMs));
      for (const pid of escaped) signalPid(pid, 'SIGKILL');
    };
    child.once('close', async (code, childSignal) => {
      dispose();
      if (signal?.aborted) {
        await reap();
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
