const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { createRequire } = require('node:module');

const REPO_ROOT = path.resolve(__dirname, '../..');
const packageJson = require('../package.json');
const astroRequire = createRequire(require.resolve('astro', { paths: [path.join(REPO_ROOT, 'frontend')] }));
const yaml = astroRequire('yaml');

function temporaryFixture(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function captureChildOutput(child) {
  const output = [];
  const waiters = new Set();
  let terminalError;
  const notify = () => waiters.forEach((wake) => wake());
  const onData = (chunk) => {
    output.push(chunk.toString());
    notify();
  };
  child.stdout.on('data', onData);
  child.stderr.on('data', onData);
  child.on('error', (error) => { terminalError = error; notify(); });
  child.on('close', (code, signal) => {
    terminalError ||= new Error(`Child closed before expected output (code=${code}, signal=${signal}).`);
    notify();
  });
  return {
    output,
    waitForOutput(predicate) {
      const current = output.join('');
      if (predicate(current)) return Promise.resolve(current);
      if (terminalError) return Promise.reject(terminalError);
      return new Promise((resolve, reject) => {
        const check = () => {
          const text = output.join('');
          if (predicate(text)) {
            waiters.delete(check);
            resolve(text);
          } else if (terminalError) {
            waiters.delete(check);
            reject(terminalError);
          }
        };
        waiters.add(check);
        check();
      });
    },
  };
}

function closeChild(child, signal = 'SIGTERM') {
  if (child.exitCode !== null || child.signalCode !== null) return Promise.resolve();
  return new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('close', () => resolve());
    child.kill(signal);
  });
}

function startWatchedTypeScriptFixture(root) {
  const entry = path.join(root, 'index.ts');
  const loaded = path.join(root, 'loaded.ts');
  fs.writeFileSync(entry, "import { value } from './loaded';\nconsole.log(`FIXTURE_RUN:${value}`);\nconst lifeline = setInterval(() => {}, 1000);\nprocess.on('SIGTERM', () => { clearInterval(lifeline); console.log('FIXTURE_SIGTERM_CLOSED'); });\n");
  fs.writeFileSync(loaded, "export const value = 'before';\n");
  const tsNodeRegister = require.resolve('ts-node/register', { paths: [path.join(REPO_ROOT, 'backend')] });
  const child = spawn(process.execPath, [
    '--watch',
    '--watch-preserve-output',
    '--watch-kill-signal=SIGTERM',
    '-r',
    tsNodeRegister,
    entry,
  ], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, TS_NODE_COMPILER_OPTIONS: '{"module":"CommonJS"}' } });
  return { entry, loaded, child, capture: captureChildOutput(child) };
}

test('dev-watch contract uses Node native watch without Nodemon or a global Chokidar override', () => {
  const workspace = yaml.parse(fs.readFileSync(path.join(REPO_ROOT, 'pnpm-workspace.yaml'), 'utf8'));
  const lock = yaml.parse(fs.readFileSync(path.join(REPO_ROOT, 'pnpm-lock.yaml'), 'utf8'));
  const unstorageEntry = astroRequire.resolve('unstorage');
  const unstoragePackage = JSON.parse(fs.readFileSync(path.resolve(path.dirname(unstorageEntry), '../package.json'), 'utf8'));

  assert.equal(packageJson.scripts.dev, 'node --watch --watch-preserve-output --watch-kill-signal=SIGTERM index.js');
  assert.equal(packageJson.devDependencies?.nodemon, undefined, 'Nodemon must not remain a backend dev dependency');
  assert.equal(workspace.overrides?.chokidar, undefined, 'Chokidar must not be pinned globally');
  assert.equal(workspace.overrides?.['@astrojs/check>chokidar'], '5.0.0');
  assert.deepEqual(Object.keys(lock.packages).filter((key) => key.startsWith('chokidar@')), ['chokidar@5.0.0']);
  assert.deepEqual(Object.keys(lock.snapshots).filter((key) => key.startsWith('chokidar@')), ['chokidar@5.0.0']);
  assert.equal(lock.snapshots['unstorage@1.17.5'].dependencies.chokidar, '5.0.0');
  assert.equal(unstoragePackage.dependencies.chokidar, '^5.0.0');
});

test('Node watch reloads a loaded TypeScript module and forwards SIGTERM for graceful fixture shutdown', { timeout: 35000 }, async (t) => {
  const root = temporaryFixture('mundo-node-watch-');
  const fixture = startWatchedTypeScriptFixture(root);
  const { output, waitForOutput } = fixture.capture;
  t.after(async () => {
    await closeChild(fixture.child);
    fs.rmSync(root, { recursive: true, force: true });
  });

  assert.equal(fixture.child.spawnargs.at(-1), fixture.entry);
  assert.equal(fixture.child.spawnargs.includes('--watch-path'), false);
  await waitForOutput((text) => text.includes('FIXTURE_RUN:before'));
  fs.writeFileSync(fixture.loaded, "export const value = 'after';\n");
  const restartedOutput = await waitForOutput((text) => text.includes('FIXTURE_RUN:after') && text.includes('FIXTURE_SIGTERM_CLOSED'));
  assert.ok(
    restartedOutput.indexOf('FIXTURE_SIGTERM_CLOSED') < restartedOutput.indexOf('FIXTURE_RUN:after'),
    'the old fixture must handle configured SIGTERM gracefully before the restarted module runs'
  );
  await closeChild(fixture.child);
});
