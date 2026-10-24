'use strict';

const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { mkdir, mkdtemp, readFile, rm, writeFile } = require('node:fs/promises');
const path = require('node:path');
const { test } = require('node:test');

const backendPackage = require('../package.json');
const temporaryRoot = path.resolve(__dirname, '../../.tmp');

test('backend development script uses Node’s built-in watcher', () => {
  assert.equal(backendPackage.scripts.dev, 'node --watch index.js');
  assert.equal(backendPackage.devDependencies.nodemon, undefined);
});

test('the development watcher restarts after an entrypoint change', async (t) => {
  await mkdir(temporaryRoot, { recursive: true });
  const temporaryDirectory = await mkdtemp(path.join(temporaryRoot, 'backend-dev-watch-'));
  const entrypoint = path.join(temporaryDirectory, 'index.js');
  const marker = path.join(temporaryDirectory, 'starts.log');
  const commandParts = backendPackage.scripts.dev.split(/\s+/);
  const command = commandParts[0];
  const args = commandParts.slice(1);
  assert.ok(command === 'node' || command === 'nodemon');
  args[args.length - 1] = entrypoint;

  const executable = command === 'node'
    ? process.execPath
    : path.resolve(__dirname, '../node_modules/.bin/nodemon');
  await writeEntrypoint(entrypoint, marker, 1);
  const child = spawn(executable, args, {
    cwd: temporaryDirectory,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  let spawnError;
  child.stdout.setEncoding('utf8').on('data', (chunk) => { output += chunk; });
  child.stderr.setEncoding('utf8').on('data', (chunk) => { output += chunk; });
  child.on('error', (error) => { spawnError = error; });

  t.after(async () => {
    await stop(child);
    await rm(temporaryDirectory, { recursive: true, force: true });
  });

  await waitForStarts(marker, 1, child, () => spawnError, () => output);
  await writeEntrypoint(entrypoint, marker, 2);
  await waitForStarts(marker, 2, child, () => spawnError, () => output);
});

async function writeEntrypoint(entrypoint, marker, startNumber) {
  const contents = [
    "'use strict';",
    "const { appendFileSync } = require('node:fs');",
    `appendFileSync(${JSON.stringify(marker)}, ${JSON.stringify(`start-${startNumber}\n`)});`,
    '',
  ].join('\n');
  await writeFile(entrypoint, contents);
}

async function waitForStarts(marker, expected, child, getSpawnError, getOutput) {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    const spawnError = getSpawnError();
    if (spawnError) throw spawnError;
    if (child.exitCode !== null || child.signalCode !== null) {
      throw new Error(`watch process exited before ${expected} starts:\n${getOutput()}`);
    }
    if ((await readStartCount(marker)) >= expected) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`watch process did not reach ${expected} starts:\n${getOutput()}`);
}

async function readStartCount(marker) {
  try {
    const contents = await readFile(marker, 'utf8');
    return contents.split(/\r?\n/).filter(Boolean).length;
  } catch (error) {
    if (error.code === 'ENOENT') return 0;
    throw error;
  }
}

async function stop(child) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  const exited = new Promise((resolve) => child.once('exit', resolve));
  child.kill('SIGTERM');
  const stopped = await Promise.race([
    exited.then(() => true),
    new Promise((resolve) => setTimeout(() => resolve(false), 2_000)),
  ]);
  if (!stopped) {
    child.kill('SIGKILL');
    await exited;
  }
}
