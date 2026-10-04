const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { spawn } = require('node:child_process');
const { createRequire } = require('node:module');

const REPO_ROOT = path.resolve(__dirname, '../..');
const FRONTEND_ROOT = path.join(REPO_ROOT, 'frontend');
const consumerRequire = createRequire(require.resolve('astro', { paths: [FRONTEND_ROOT] }));
const unstorageCjs = consumerRequire.resolve('unstorage');
const fsDriverCjs = consumerRequire.resolve('unstorage/drivers/fs');
const fsDriverEsm = fsDriverCjs.replace(/\.cjs$/, '.mjs');

function fixtureDirectory(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function captureChildOutput(child) {
  let stdout = '';
  let stderr = '';
  let terminalError;
  const waiters = new Set();
  const notify = () => waiters.forEach((wake) => wake());
  const onData = (stream) => (chunk) => { stream(chunk.toString()); notify(); };
  child.stdout.on('data', onData((text) => { stdout += text; }));
  child.stderr.on('data', onData((text) => { stderr += text; }));
  child.on('error', (error) => {
    terminalError = new Error(`Watcher process error: ${error.message}\nstdout:\n${stdout}\nstderr:\n${stderr}`);
    notify();
  });
  child.on('close', (code, signal) => {
    terminalError ||= new Error([
      `Watcher closed before expected output (exitCode=${code}, signal=${signal}).`,
      'Captured stdout:',
      stdout,
      'Captured stderr:',
      stderr,
    ].join('\n'));
    notify();
  });
  const output = () => `${stdout}${stderr}`;
  return {
    waitFor(matches) {
      if (matches(output())) return Promise.resolve(output());
      if (terminalError) return Promise.reject(terminalError);
      return new Promise((resolve, reject) => {
        const check = () => {
          if (matches(output())) {
            waiters.delete(check);
            resolve(output());
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

function stopOwnedProcess(child) {
  if (child.exitCode !== null || child.signalCode !== null) return Promise.resolve();
  return new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('close', () => resolve());
    child.kill('SIGTERM');
  });
}

async function watchAstroFixture(t) {
  const root = fixtureDirectory('mundo-astro-check-watch-');
  fs.mkdirSync(path.join(root, 'src'));
  fs.mkdirSync(path.join(root, 'node_modules'));
  fs.symlinkSync(path.join(FRONTEND_ROOT, 'node_modules/astro'), path.join(root, 'node_modules/astro'), 'dir');
  fs.writeFileSync(path.join(root, 'astro.config.mjs'), 'export default {};\n');
  const tsconfig = path.join(root, 'tsconfig.json');
  fs.writeFileSync(tsconfig, JSON.stringify({
    compilerOptions: { target: 'ESNext', module: 'ESNext', moduleResolution: 'Bundler', strict: true, skipLibCheck: true },
    include: ['src/**/*.ts'],
  }));
  const source = path.join(root, 'src/value.ts');
  fs.writeFileSync(source, 'export const value: string = "initial";\n');
  const checkModule = path.join(FRONTEND_ROOT, 'node_modules/@astrojs/check/dist/index.js');
  const launcher = path.join(root, 'astro-check-fixture.mjs');
  fs.writeFileSync(launcher, [
    `import { check, parseArgsAsCheckConfig } from ${JSON.stringify(pathToFileURL(checkModule).href)};`,
    '// Pass full process.argv because parseArgsAsCheckConfig applies hideBin itself.',
    'await check(parseArgsAsCheckConfig(process.argv));',
    '',
  ].join('\n'));
  const child = spawn(process.execPath, [launcher, '--watch', '--preserve-watch-output', '--root', root, '--tsconfig', tsconfig], {
    cwd: root,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, CI: '1' },
  });
  const capture = captureChildOutput(child);
  t.after(async () => {
    await stopOwnedProcess(child);
    fs.rmSync(root, { recursive: true, force: true });
  });
  return { child, root, source, capture };
}

test('installed @astrojs/check watch mode observes a directory fixture and rechecks a changed TypeScript file', { timeout: 65000 }, async (t) => {
  const fixture = await watchAstroFixture(t);
  const initialOutput = await fixture.capture.waitFor((output) => output.includes('Watching for changes...'));
  const resultCount = (output) => (output.match(/Result \(/g) || []).length;
  const initialResults = resultCount(initialOutput);
  assert.ok(initialResults >= 1, 'watch mode must finish its initial check before editing the fixture');
  fs.writeFileSync(fixture.source, 'export const value: string = 123;\n');
  const changedOutput = await fixture.capture.waitFor((output) => resultCount(output) > initialResults);
  assert.ok(resultCount(changedOutput) > initialResults, 'directory change must trigger another checker result');
  assert.match(changedOutput, /Type 'number' is not assignable to type 'string'/, 'recheck must report the introduced TypeScript error');
});

async function exerciseUnstorageFilesystemDriver(format, base) {
  const unstorage = format === 'esm'
    ? await import(pathToFileURL(unstorageCjs.replace(/\.cjs$/, '.mjs')).href)
    : require(unstorageCjs);
  const module = format === 'esm'
    ? await import(pathToFileURL(fsDriverEsm).href)
    : require(fsDriverCjs);
  const createStorage = unstorage.createStorage || unstorage.default?.createStorage;
  const fsDriver = module.default || module;
  assert.equal(typeof createStorage, 'function');
  assert.equal(typeof fsDriver, 'function');

  const driver = fsDriver({ base });
  let driverClosed = false;
  const watchDriver = driver.watch.bind(driver);
  driver.watch = async (callback) => {
    const closeWatcher = await watchDriver(callback);
    return async () => {
      await closeWatcher();
      driverClosed = true;
    };
  };
  const storage = createStorage({ driver });
  const events = [];
  let notify;
  const changed = new Promise((resolve) => { notify = resolve; });
  const unwatch = await storage.watch((event, key) => {
    events.push({ event, key });
    if (event === 'update' && key === 'added.txt') notify();
  });
  try {
    fs.writeFileSync(path.join(base, 'added.txt'), 'created');
    await Promise.race([
      changed,
      new Promise((_, reject) => setTimeout(() => reject(new Error(`${format} unstorage watcher missed the add event; got ${JSON.stringify(events)}`)), 20000)),
    ]);
    assert.ok(events.some(({ event, key }) => event === 'update' && key === 'added.txt'));
  } finally {
    await unwatch();
    await storage.dispose();
  }
  assert.equal(driverClosed, true, `${format} filesystem watcher must close through unwatch`);
}

test('installed Unstorage filesystem driver watches and closes in both ESM and CommonJS consumers', { timeout: 55000 }, async (t) => {
  const root = fixtureDirectory('mundo-unstorage-watch-');
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const format of ['esm', 'commonjs']) {
    const base = path.join(root, format);
    fs.mkdirSync(base);
    await exerciseUnstorageFilesystemDriver(format, base);
  }
});
