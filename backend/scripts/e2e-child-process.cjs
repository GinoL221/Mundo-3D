'use strict';
const { spawn, execFileSync } = require('node:child_process');

function parseProcessTable(table) {
  if (typeof table !== 'string') return Array.isArray(table) ? table : [];
  const entries = [];
  for (const line of table.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const parts = trimmed.split(/\s+/);
    const pid = Number(parts[0]);
    const ppid = Number(parts[1]);
    const identity = parts.slice(2).join(' ');
    if (Number.isInteger(pid) && Number.isInteger(ppid) && identity) {
      entries.push({ pid, ppid, identity });
    }
  }
  return entries;
}

function readProcessTable() {
  if (process.platform === 'win32') return [];
  try {
    return parseProcessTable(execFileSync('ps', ['-eo', 'pid=,ppid=,lstart='], { encoding: 'utf8' }));
  } catch {
    return [];
  }
}

function toIdentityMap(entries) {
  const map = new Map();
  for (const entry of entries) {
    if (entry && Number.isInteger(entry.pid)) {
      const id = entry.identity ?? entry.start ?? entry.lstart;
      if (id !== undefined && id !== null && String(id).trim()) {
        map.set(entry.pid, String(id).trim());
      }
    }
  }
  return map;
}

// Playwright starts its webServers as detached groups, so a group signal sent to
// the Playwright process never reaches them. Cancellation therefore records the
// descendant tree first and reaps whatever survived Playwright's own teardown.
function listDescendants(rootPid, tableEntries) {
  if (process.platform === 'win32' || !Number.isInteger(rootPid)) return new Map();
  const byParent = new Map();
  const byPid = new Map();
  for (const entry of tableEntries) {
    if (!entry || !Number.isInteger(entry.pid)) continue;
    const id = entry.identity ?? entry.start ?? entry.lstart;
    if (id !== undefined && id !== null && String(id).trim()) {
      byPid.set(entry.pid, String(id).trim());
    }
    const ppid = Number(entry.ppid);
    if (Number.isInteger(ppid)) {
      if (!byParent.has(ppid)) byParent.set(ppid, []);
      byParent.get(ppid).push(entry.pid);
    }
  }
  const descendants = new Map();
  const queue = [rootPid];
  while (queue.length > 0) {
    for (const pid of byParent.get(queue.shift()) ?? []) {
      const identity = byPid.get(pid);
      if (identity) descendants.set(pid, identity);
      queue.push(pid);
    }
  }
  return descendants;
}

// Playwright's CLI handles SIGINT (and tears down its own detached webServer
// groups from that handler); SIGTERM would kill it before teardown.
async function runCommand(command, args, { env, signal, spawnImpl = spawn, killImpl = process.kill,
  graceMs = 5000, reapGraceMs = 500, readProcessTableImpl = readProcessTable } = {}) {
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
    let escaped = new Map();
    const cancel = () => {
      let entries = [];
      try {
        const raw = readProcessTableImpl();
        entries = typeof raw === 'string' ? parseProcessTable(raw) : (Array.isArray(raw) ? raw : []);
      } catch {
        // No process table means no identities to confirm, so nothing is reaped
        // and behaviour degrades to the group signal alone.
        entries = [];
      }
      escaped = listDescendants(child.pid, entries);
      group('SIGINT');
      // Escalation is not cancelled by graceful progress inside the child: its
      // detached webServers are separate groups that may ignore the first signal.
      timer = setTimeout(() => group('SIGKILL'), graceMs);
      timer.unref();
    };
    const escalate = () => {
      if (timer) clearTimeout(timer);
      group('SIGKILL');
    };
    signal?.addEventListener('escalate', escalate);
    // The escalation timer targets only the Playwright process group and is
    // cleared once that child closes. Playwright's detached webServer groups are
    // outside that group, so cancellation reaps the recorded descendants itself:
    // a graceful SIGTERM first, SIGKILL for the survivors.
    const dispose = () => {
      signal?.removeEventListener('abort', cancel);
      signal?.removeEventListener('escalate', escalate);
      if (timer) clearTimeout(timer);
    };
    child.once('error', () => { dispose(); reject(new Error('E2E child could not start')); });
    const reap = async () => {
      if (escaped.size === 0) return;
      const getIdentities = () => {
        try {
          const raw = readProcessTableImpl();
          return toIdentityMap(typeof raw === 'string' ? parseProcessTable(raw) : (Array.isArray(raw) ? raw : []));
        } catch {
          return new Map();
        }
      };
      const signalPid = (pid, expected, currentIdentities, name) => {
        if (!expected || currentIdentities.get(pid) !== expected) return;
        try {
          killImpl(pid, name);
        } catch (error) {
          if (error.code !== 'ESRCH') killFailure = new Error('E2E descendant termination failed');
        }
      };
      const termIdentities = getIdentities();
      for (const [pid, expected] of escaped) signalPid(pid, expected, termIdentities, 'SIGTERM');
      // The reap timer must keep the process alive: an unref'd timer lets the
      // parent exit mid-cleanup, which skips both the rejection and the
      // supervisor's Docker cleanup.
      await new Promise((done) => setTimeout(done, reapGraceMs));
      const killIdentities = getIdentities();
      for (const [pid, expected] of escaped) signalPid(pid, expected, killIdentities, 'SIGKILL');
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
