import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, readlinkSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import test from 'node:test';

const workspace = resolve(import.meta.dirname, '..');
const e2e = import.meta.dirname;

// Hash only; never print historical report contents or follow their symlinks.
function snapshot(path) {
  if (!existsSync(path)) return null;
  const stat = lstatSync(path);
  const metadata = [stat.ino, stat.mode, stat.size, stat.mtimeMs];
  if (stat.isSymbolicLink()) return [metadata, readlinkSync(path)];
  if (stat.isDirectory()) {
    return [metadata, readdirSync(path).sort().map((name) => [name, snapshot(join(path, name))])];
  }
  assert.ok(stat.isFile(), 'historical outputs must contain only regular files or symlinks');
  return [metadata, createHash('sha256').update(readFileSync(path)).digest('hex')];
}

test('nested pnpm routes artifacts, JSON and HTML independently without historical overwrite', () => {
  const runtimeBin = process.env.VERIFICATION_RUNTIME_BIN;
  assert.ok(runtimeBin && isAbsolute(runtimeBin), 'set VERIFICATION_RUNTIME_BIN to the approved absolute runtime bin directory');
  const identity = spawnSync(join(runtimeBin, 'node'), ['-p', 'process.execPath'], {
    env: { PATH: `${runtimeBin}:/usr/bin:/bin` },
    encoding: 'utf8', timeout: 2_000,
  });
  assert.equal(identity.error, undefined);
  assert.equal(identity.signal, null);
  assert.equal(identity.status, 0);
  assert.equal(identity.stderr, '');
  assert.equal(identity.stdout, `${process.execPath}\n`, 'the approved wrapper must execute the current Node binary');
  const pnpm = join(runtimeBin, 'pnpm');
  assert.ok(lstatSync(pnpm).isFile(), 'expected the approved pnpm wrapper');
  const rootPackage = JSON.parse(readFileSync(join(workspace, 'package.json'), 'utf8'));
  const e2ePackage = JSON.parse(readFileSync(join(e2e, 'package.json'), 'utf8'));
  assert.equal(rootPackage.scripts['test:e2e'], 'pnpm --filter e2e test --project=chromium');
  assert.equal(e2ePackage.scripts.test, 'playwright test');
  assert.equal(rootPackage.scripts['pretest:e2e'], undefined);
  assert.equal(rootPackage.scripts['posttest:e2e'], undefined);
  assert.equal(e2ePackage.scripts.pretest, undefined);
  assert.equal(e2ePackage.scripts.posttest, undefined);

  const protectedPaths = ['test-results', 'playwright-report', 'results.json'].map((name) => join(e2e, name));
  const before = protectedPaths.map(snapshot);
  const scratch = mkdtempSync(join(e2e, '.verification-routing-'));
  let completed = false;
  try {
    // Both cases select an inert config BEFORE the optional terminator. Even
    // the bad recipe's fallback paths belong exclusively to this fresh fixture.
    for (const separator of [true, false]) {
      const directory = join(scratch, separator ? 'bad-separator' : 'correct-options');
      mkdirSync(directory);
      const output = join(directory, 'requested-artifacts');
      const fallback = join(directory, 'fallback-artifacts');
      const json = join(directory, 'isolated-results.json');
      const html = join(directory, 'isolated-html');
      const receipt = join(directory, 'routing.json');
      const config = join(directory, 'inert.config.cjs');
      const recorder = join(directory, 'recorder.cjs');
      mkdirSync(fallback);
      writeFileSync(join(fallback, 'keep.txt'), 'fixture-only historical artifact');
      mkdirSync(join(directory, 'test-results'));
      writeFileSync(join(directory, 'test-results', 'results.json'), 'fixture-only historical JSON');
      mkdirSync(join(directory, 'playwright-report'));
      writeFileSync(join(directory, 'playwright-report', 'keep.txt'), 'fixture-only historical HTML');
      writeFileSync(recorder, `const fs = require('node:fs');
module.exports = class {
  onBegin(config) {
    fs.writeFileSync(${JSON.stringify(receipt)}, JSON.stringify({
      argv: process.argv,
      configFile: config.configFile,
      outputs: config.projects.map(project => project.outputDir),
      servicesConfigured: Boolean(config.webServer) || Boolean(config.globalSetup),
    }));
  }
};
`);
      writeFileSync(config, `module.exports = {
  testDir: ${JSON.stringify(directory)}, testMatch: 'probe.spec.cjs',
  outputDir: ${JSON.stringify(fallback)}, workers: 1, retries: 0,
  reporter: [['list'], ['html', { open: 'never' }],
    ['json', { outputFile: 'test-results/results.json' }], [${JSON.stringify(recorder)}]],
  projects: [{ name: 'chromium' }],
};
`);
      writeFileSync(join(directory, 'probe.spec.cjs'), `const { test } = require('@playwright/test');
const fs = require('node:fs');
test('inert routing attachment', async ({}, info) => {
  const path = info.outputPath('routing-attachment.txt');
  fs.writeFileSync(path, 'inert-routing-only');
  await info.attach('routing', { path, contentType: 'text/plain' });
});
`);
      const home = join(directory, 'home');
      mkdirSync(home);
      const args = ['test:e2e', '--config', config, ...(separator ? ['--'] : []), '--output', output];
      const result = spawnSync(pnpm, args, {
        cwd: workspace,
        env: {
          PATH: `${runtimeBin}:${dirname(process.execPath)}:/usr/bin:/bin`, HOME: home,
          XDG_CACHE_HOME: join(directory, 'cache'), TMPDIR: directory,
          PLAYWRIGHT_JSON_OUTPUT_FILE: json, PLAYWRIGHT_HTML_OUTPUT_DIR: html,
          PLAYWRIGHT_HTML_OPEN: 'never',
        },
        encoding: 'utf8', timeout: 12_000,
      });
      process.stdout.write(`CASE=${separator ? 'bad-separator' : 'correct-options'}\n${result.stdout ?? ''}`);
      process.stderr.write(result.stderr ?? '');
      assert.equal(result.error, undefined);
      assert.equal(result.signal, null);
      assert.equal(result.status, 0);
      const forwardedArgs = args.slice(1).join(' ');
      assert.equal(result.stderr,
        `$ pnpm --filter e2e test --project=chromium ${forwardedArgs}\n` +
        `$ playwright test --project=chromium ${forwardedArgs}\n`);
      const route = JSON.parse(readFileSync(receipt, 'utf8'));
      assert.equal(route.configFile, config);
      assert.equal(route.servicesConfigured, false);
      assert.deepEqual(route.outputs, [separator ? fallback : output]);
      assert.equal(route.argv.includes('--'), separator);
      assert.equal(existsSync(join(fallback, 'keep.txt')), !separator);
      const report = JSON.parse(readFileSync(json, 'utf8'));
      assert.equal(report.stats.expected, 1);
      assert.equal(report.stats.unexpected, 0);
      assert.equal(report.stats.skipped, 0);
      assert.equal(report.stats.flaky, 0);
      assert.deepEqual(report.errors, []);
      const attachment = report.suites[0].specs[0].tests[0].results[0].attachments[0];
      assert.ok(attachment.path.startsWith(`${separator ? fallback : output}/`));
      assert.equal(readFileSync(attachment.path, 'utf8'), 'inert-routing-only');
      assert.ok(existsSync(join(html, 'index.html')));
      assert.equal(readFileSync(join(directory, 'test-results', 'results.json'), 'utf8'), 'fixture-only historical JSON');
      assert.equal(readFileSync(join(directory, 'playwright-report', 'keep.txt'), 'utf8'), 'fixture-only historical HTML');
      assert.deepEqual(protectedPaths.map(snapshot), before);
    }
    completed = true;
  } finally {
    // Remove only our newly created fixture after success; retain diagnostics
    // on failure. Never remove or restore an existing output directory.
    if (completed) rmSync(scratch, { recursive: true });
    else process.stderr.write(`Routing diagnostics retained at ${scratch}\n`);
  }
});
